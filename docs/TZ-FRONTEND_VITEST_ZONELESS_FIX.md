# TZ: Frontend unit tests — migrate to `@angular/build:unit-test` and eliminate spec drift

> **Status:** EXECUTABLE. Architect-finalized on 2026-07-31 on top of the
> investigator draft (commit `e6ef250`). Supersedes the draft's §5 approach
> menu: the architect selected the approach, corrected three root-cause
> misattributions, and added a newly discovered blocker (spec type drift
> that fails the official builder before any test runs).

## Execution Checklist

- [x] 0. Context verified (baseline reproduced and recorded)
- [x] 1. Architecture boundaries confirmed (approach, scope, non-negotiables)
- [x] 2. L1 — spec type drift fixed (8 errors in 5 files); builder runs tests
- [x] 3. L2 — toolchain gate: `npx ng test --watch=false` executes; groups A/C/D green or gate-stopped
- [x] 4. L3 — `logging.spec.ts` DI setup fixed (group B)
- [x] 5. L4 — `operations.service.spec.ts` `useFactory` workaround reverted
- [x] 6. L5 — `temp-items/*` `overrideInputs` workaround reverted (4 files)
- [x] 7. L6 — standalone vitest path removed (`vitest.config.ts`, `src/test-setup.ts`), `test:unit` script added
- [x] 8. L7 — docs updated (`Warehouse_frontend/AGENTS.md`, root `AGENTS.md`, ADR-0024)
- [x] 9. L8 — CI unit-test workflow added
- [ ] 10. L9 — final acceptance review with evidence table (evidence table filled at §10; item #6 left unchecked — E2E regression blocked by pre-existing stand bootstrap state, see §10 row "E2E regression" for full blocker note)

## Check Rules

- Architect created this checklist and the acceptance criteria.
- Executor checks L0–L8 items only after running the required verification for that level.
- QA verifier checks L9 only after reviewing the evidence table.
- If a check is skipped, it stays unchecked with a reason in the report.
- If a level's acceptance criteria fail and no prescribed remedy applies, the
  executor STOPS, leaves the box unchecked, and reports. Do not improvise
  outside the stated scope.

## 1. Context

`Warehouse_frontend` unit tests currently have **two divergent runners**:

1. **Standalone `npx vitest run`** via `vitest.config.ts` + `src/test-setup.ts`.
   Uses esbuild for TypeScript — which performs **zero Angular compilation**:
   no `design:paramtypes` decorator metadata, no signal `input()` detection,
   no `templateUrl` inlining, and no type-checking.
2. **Official `npx ng test`** via `@angular/build:unit-test` (already declared
   in `angular.json`, line 74–76; `package.json` script `"test": "ng test"`).
   Uses the real Angular toolchain (ngtsc + esbuild) and runs vitest under
   the hood in Angular 21. Currently **fails at build time** on spec type
   drift (§3.4), so zero tests execute.

A prior TZ (`TZ_OPERATIONS_ACCEPTANCE_PLAYWRIGHT.md`, evidence line 586)
already recorded `npx ng test --watch=false` as the intended canonical
command and marked it blocked by the same type drift. This TZ removes that
blocker and makes the official runner the only unit-test path.

### Baseline (verified by architect, 2026-07-31, commit `e6ef250`)

```
$ npx vitest run
 Test Files  4 failed | 12 passed (16)
      Tests  15 failed | 91 passed (106)
     Errors  1 error        # unhandled NG0201 DIAGNOSTICS_QUEUE_PORT

$ npx ng test --watch=false
Application bundle generation failed.   # 8 TS errors in 5 spec files (§3.4)
```

## 2. Verified root causes (corrects the draft)

The draft attributed all 15 failures to "esbuild does not emit decorator
metadata + missing zone.js". Architect verification found **five distinct
root causes**, two of which the draft misdiagnosed:

### RC1 — constructor DI metadata missing (group A, 7 fails) — TRANSFORMER

`auth-context.service.spec.ts`: `NG0202` at
`TestBed.inject(AuthContextService)`. esbuild does not emit
`__metadata("design:paramtypes", [BffApiService])`, and there is no ngtsc
pass to generate an explicit `ɵfac`. Constructor-injected services cannot
be built. **Fixed only by real Angular compilation.**

### RC2 — signal `input()` invisible to JIT (group C, 2 fails) — TRANSFORMER

`nomenclature-page.spec.ts`: the vitest log shows **dozens of
`NG0303: Can't bind to 'canWrite' since it isn't a known property of
'app-page-header'`** (and `app-action-buttons`, `app-catalog-tree`,
`app-right-panel`, `app-search-input`). Signal inputs have no decorators;
without the Angular compiler transform the JIT component definition does
not register them, so every `[input]` binding is **silently dropped** and
children render with defaults (title stays `Номенклатура`, `+ Категория`
stays visible).

> Draft correction: this is **not** "zoneless CD not picking up signal
> changes" (draft §2.4). The DOM assertions fail because child inputs never
> arrive. SWC with `emitDecoratorMetadata` (draft Approach A) **cannot**
> fix this — there are no decorators to emit metadata for.

The same RC2 explains why the temp-items specs needed the
`Object.defineProperty` workaround: `componentRef.setInput()` targets
inputs the runtime does not know.

### RC3 — external `templateUrl` not resolvable (group D, 2 fails) — TRANSFORMER

`app.spec.ts`: `Error: Component 'App' is not resolved`. `app.ts` is the
**only** component in the codebase using `templateUrl`/`styleUrl` (all
other 48 components use inline `template:` — verified by grep). Under
JIT/esbuild there is no resource loader to fetch `./app.html`.

> Draft correction: not a "DI metadata cascade" (draft §2.5).

### RC4 — spec-local DI setup bugs (group B, 4 fails) — RUNNER-INDEPENDENT

`logging.spec.ts` fails under **any** runner, including the official one:

- `GlobalErrorHandler` tests call `new GlobalErrorHandler()`, but the class
  uses `inject(DiagnosticsService)` / `inject(Router)` in field
  initializers → `NG0203` (no injection context). No transformer fixes a
  manual `new`.
- `HttpErrorInterceptor` tests never provide `DiagnosticsService`; the
  interceptor's `inject(DiagnosticsService)` pulls the real service, whose
  own `inject(DIAGNOSTICS_QUEUE_PORT)` fails → `NG0201` (observed as the
  unhandled error in the vitest run) → the request aborts before reaching
  the testing backend → `expectOne(...)` finds none.

> Draft correction: not "DI metadata missing means the spec cannot
> discover what the service needs" (draft §2.3). The services here use
> `inject()`; the spec simply lacks providers.

### RC5 — spec type drift (blocks the official builder entirely) — NEW FINDING

`npx ng test --watch=false` fails the `angular-compiler` plugin type-check
before running any test. Complete inventory (TypeScript reports all
errors; this list is exhaustive as of `e6ef250`):

| # | File:line | Error | Drift |
|---|---|---|---|
| 1 | `src/app/core/diagnostics/diagnostics-queue.service.spec.ts:145` | TS2353 | `details: { x: huge }` — `x` not in `DiagnosticEventDetails` |
| 2 | `src/app/core/guards/unsaved-draft.guard.spec.ts:16` | TS2554 | guard called with 1 arg; `CanDeactivateFn` type requires 4 |
| 3 | `src/app/core/guards/unsaved-draft.guard.spec.ts:21` | TS2554 | same |
| 4 | `src/app/core/guards/unsaved-draft.guard.spec.ts:27` | TS2554 | same |
| 5 | `src/app/core/guards/unsaved-draft.guard.spec.ts:35` | TS2554 | same |
| 6 | `src/app/core/services/draft-storage.service.spec.ts:14` | TS2739 | mock line missing `itemName`, `unitName`, `isTemporary`, `fromBalances` (`OperationLineDraftVm`) |
| 7 | `src/app/core/services/operations.service.spec.ts:554` | TS18048 | `draft.displayNumber` possibly `undefined` |
| 8 | `src/app/features/temporary-items/components/temp-item-detail-modal.spec.ts:21` | TS2741 | mock missing `operationsCount` (`TemporaryItemVm`) |

esbuild never type-checks, so this drift is invisible to standalone
vitest. It is real drift between specs and production models and must be
repaired regardless of runner choice.

## 3. Decision (architect)

**Adopt the official `@angular/build:unit-test` (`ng test`) as the single
unit-test runner; delete the standalone vitest configuration; fix RC4 and
RC5 spec bugs; revert the two workaround patterns once the gate is green.**

This is a refinement of the draft's Approach C. It is the only option that
addresses RC1 + RC2 + RC3 with supported tooling, and it converts RC5 from
invisible drift into a permanent compile-time gate.

### Why the other approaches are rejected

- **Approach A (SWC + `emitDecoratorMetadata`)** — fixes only RC1
  (7 of 15 fails). Cannot fix RC2 (no decorators on signal inputs) or RC3
  (no resource inlining). Would still leave 8 fails and both workarounds
  in place. Rejected as insufficient.
- **Approach B (`@analogjs/vitest-angular`)** — would address RC1–RC3 but
  duplicates what `@angular/build` already provides out of the box, adds a
  new dev-dependency whose Angular 21 / vitest 4 compatibility is
  unverified, and keeps a second community toolchain to track. Rejected as
  unnecessary risk for zero capability gain.
- **Approach D (accept zoneless, rework specs)** — zoneless is already the
  project's reality (no `zone.js` dependency at all). It addresses none of
  RC1/RC2/RC3. Rejected as a primary approach; its discipline (explicit
  `await fixture.whenStable()` around async flows) is absorbed into the
  prescribed spec fixes.

### Consequences (record for ADR-0024)

- `vitest` remains the execution engine — via the Angular builder. CI and
  developer muscle memory ("vitest runs the unit tests") are preserved.
- The builder type-checks specs on every run: spec/model drift like RC5
  becomes a build error instead of silent decay.
- Watch-mode iteration is `npm test` (builder watch); single-run is
  `npx ng test --watch=false` / `npm run test:unit`.
- Two-runner divergence is eliminated by deleting `vitest.config.ts` and
  `src/test-setup.ts` (the builder auto-initializes the TestBed — this is
  stated in `test-setup.ts`'s own header comment).

## 4. Scope

### In scope (files the executor may modify)

| File | Levels | Change |
|---|---|---|
| `src/app/core/diagnostics/diagnostics-queue.service.spec.ts` | L1 | RC5 fix #1 |
| `src/app/core/guards/unsaved-draft.guard.spec.ts` | L1 | RC5 fixes #2–5 |
| `src/app/core/services/draft-storage.service.spec.ts` | L1 | RC5 fix #6 |
| `src/app/core/services/operations.service.spec.ts` | L1, L4 | RC5 fix #7; revert `useFactory` |
| `src/app/features/temporary-items/components/temp-item-detail-modal.spec.ts` | L1, L5 | RC5 fix #8; revert `overrideInputs` |
| `src/app/core/logging/logging.spec.ts` | L3 | RC4 rewrite (prescribed below) |
| `src/app/app.spec.ts` | L2 (conditional) | only if R1 fires: add `provideRouter([])` |
| `src/app/features/temporary-items/components/temp-items-table.spec.ts` | L5 | revert `overrideInputs` |
| `src/app/features/temporary-items/components/temp-items-filters.spec.ts` | L5 | revert `overrideInputs` |
| `src/app/features/temporary-items/components/temp-items-info-card.spec.ts` | L5 | revert `overrideInputs` |
| `vitest.config.ts` | L6 | **delete** |
| `src/test-setup.ts` | L6 | **delete** |
| `package.json` | L6 | add `test:unit` script only |
| `Warehouse_frontend/AGENTS.md` | L7 | verification section |
| root `AGENTS.md` | L7 | verification matrix line |
| `docs/adr/0024-frontend-unit-test-runner.md` (root repo) | L7 | new ADR (content prescribed) |
| `.github/workflows/frontend-unit-tests.yml` (root repo) | L8 | new CI workflow (content prescribed) |

### Out of scope

- **All production source** (`src/app/**/*.ts` except `*.spec.ts`,
  `src/app/**/*.html/scss`). No production change is believed necessary.
  If the executor concludes one is required: STOP and escalate — that
  invalidates an assumption of this TZ.
- `e2e/**` and Playwright configuration (separate runner, untouched).
- `Warehouse_web/**`, `SyncServer/**`.
- New test cases (this TZ repairs existing tests only).
- Production refactors (e.g., mass constructor-injection → `inject()`
  migration) — explicitly NOT how RC1 is solved here.
- Renaming or moving files.
- Evaluating SWC / analogjs (rejected above; do not re-litigate without a
  new ADR).

## 5. Constraints and non-negotiables

- Do not revert or weaken commits `8de71e4`, `b6175c8`, `00c4187`,
  `0acb51c`. Note: `8de71e4` contains BOTH production fixes (keep) and the
  two spec workarounds (reverted by L4/L5 — revert the workaround
  *patterns* inside the spec files, not the commit).
- No new dependencies are expected. `vitest` and `jsdom` stay in
  `devDependencies` (the builder consumes them). If the executor finds a
  dep genuinely missing, it goes to `devDependencies` only, with a note.
- Do not introduce `zone.js` anywhere (tests included). The project is
  zoneless by direction.
- `package.json` scripts: add `test:unit`; do not rename or remove
  existing scripts. CI (`e2e-tests.yml`) must keep passing unmodified.
- `npm run build` must stay green at every level.
- Keep specs type-clean: no `// @ts-ignore`, no blanket `as any` to dodge
  RC5 fixes. Targeted casts (e.g., `undefined as never` for unused guard
  params) are acceptable.
- Commits: `dev` branch only, explicit pathspecs, only files owned by the
  level being committed. No push (user pushes).

## 6. Implementation levels

### L0 — Context verification

1. Read this TZ fully. Re-read `Warehouse_frontend/AGENTS.md` and the root
   `AGENTS.md` Git Rules.
2. Reproduce the baseline and paste numbers into the report:
   - `npx vitest run` → expect 4 failed files / 15 failed tests (106 total).
   - `npx ng test --watch=false` → expect build failure with the 8 errors
     of §RC5.
3. Confirm `git branch --show-current` = `dev` and `git status` shows no
   unexpected edits in `src/`.

Acceptance: baseline numbers match §1 (or differences are explained by
intervening commits, which the executor must list).

### L1 — Fix spec type drift (RC5)

Apply these exact repairs (all spec-local):

1. `diagnostics-queue.service.spec.ts:145` — replace
   `details: { x: huge }` with `details: { error_message: huge }`
   (preserves the >60 KB payload intent with a valid
   `DiagnosticEventDetails` key).
2. `unsaved-draft.guard.spec.ts` — at all 4 call sites, call the guard
   with the full `CanDeactivateFn` arity. The guard body uses only
   `component`; pass `undefined as never` for `currentRoute`,
   `currentState`, `nextState`, e.g.
   `unsavedDraftGuard(component, undefined as never, undefined as never, undefined as never)`.
   Equivalent typed stubs are acceptable.
3. `draft-storage.service.spec.ts` (`makeDraft`) — extend the line object:
   add `itemName: 'Item 1'`, `unitName: 'шт'`, `isTemporary: false`,
   `fromBalances: false` (fields per `OperationLineDraftVm`,
   `operations.models.ts:288`).
4. `operations.service.spec.ts:554` — change
   `expect(draft.displayNumber.startsWith('7/')).toBe(true);` to
   `expect(draft.displayNumber!.startsWith('7/')).toBe(true);`.
5. `temp-item-detail-modal.spec.ts` (`mockItem`) — add
   `operationsCount: 2` to the literal.

Verify: `npx ng test --watch=false` now **builds and executes tests**.
Record the resulting pass/fail counts. Expected: the suite runs; some
failures may remain (they are the subject of L2–L3).

Acceptance: build phase green; test execution starts; zero TS errors.
Commit as `test(frontend): repair spec type drift for @angular/build:unit-test`
with the 5 spec files staged explicitly.

### L2 — Toolchain gate (RC1/RC2/RC3 proof)

Run `npx ng test --watch=false` and classify every remaining failure.

**Expected outcome (architect hypothesis):** the 12 previously-passing
files stay green; `auth-context.service.spec.ts` (7), `app.spec.ts` (2),
`nomenclature-page.spec.ts` (2) turn green **without any edits**, because
the builder supplies decorator metadata, signal-input compilation, and
template inlining. `logging.spec.ts` (4) stays red until L3.

**Prescribed remedies (apply only if the matching symptom fires):**

- **R1.** `app.spec.ts` fails with `NG0201: No provider found for
  ActivatedRoute` (RouterOutlet in `app.html` with no router in the test
  module): add `providers: [provideRouter([])]` to the
  `TestBed.configureTestingModule` call in `app.spec.ts` (import
  `provideRouter` from `@angular/router`). This is the ONLY production-
  adjacent change allowed in this TZ, and it is spec-local.
- **R2.** `nomenclature-page.spec.ts` still fails on timing (async
  `initialize()` in `ngOnInit`): ensure the spec keeps the
  `detectChanges() → await fixture.whenStable() → detectChanges()` rhythm
  (already present). If it still fails, STOP and report — do not rewrite
  the component.
- **R3.** Any previously-green file regresses: STOP and report if more
  than 2 files regress; otherwise document each and apply only remedies
  from the R1/R2 classes.

Acceptance (gate): **all** files green except `logging.spec.ts` (4 known
fails). If the gate cannot be reached with the prescribed remedies, STOP:
the migration assumption is broken; report evidence and do not proceed to
L4–L6.

### L3 — Fix `logging.spec.ts` DI setup (RC4)

Rewrite the spec to provide what it consumes. Reference implementation
(executor may adapt naming, must keep semantics):

```ts
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { httpErrorInterceptor } from './http-error.interceptor';
import { GlobalErrorHandler } from './global-error-handler';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';

// HttpErrorInterceptor tests: add to providers, alongside
// provideHttpClient(withInterceptors([httpErrorInterceptor])) and
// provideHttpClientTesting():
//   { provide: DiagnosticsService, useValue: { track: vi.fn() } }
//
// GlobalErrorHandler tests: STOP using `new GlobalErrorHandler()`.
// Instead:
//   TestBed.configureTestingModule({
//     providers: [
//       GlobalErrorHandler,
//       { provide: DiagnosticsService, useValue: { track: vi.fn() } },
//       { provide: Router, useValue: { url: '/test' } },
//     ],
//   });
//   const handler = TestBed.inject(GlobalErrorHandler);
```

The existing assertions (`[HTTP]` console payload, `[GlobalError]`
payload, rethrow) stay unchanged.

Verify: `npx ng test --watch=false` → **16/16 files, 106/106 tests green**.

Acceptance: full suite green. Commit as
`test(frontend): provide DiagnosticsService/Router in logging spec`.

### L4 — Revert `operations.service.spec.ts` `useFactory` workaround

Replace the workaround provider block:

```ts
{
  provide: OperationsService,
  useFactory: () => new OperationsService(
    bffMock as unknown as BffApiService, /* ...4 more casts... */
  ),
},
```

with plain DI (constructor order per `operations.service.ts:67`):

```ts
OperationsService,
{ provide: BffApiService, useValue: bffMock },
{ provide: AuthContextService, useValue: authMock },
{ provide: CatalogSearchService, useValue: searchMock },
{ provide: DiagnosticsSessionService, useValue: diagnosticsSessionMock },
{ provide: DiagnosticsService, useValue: diagnosticsMock },
```

Verify: the file's 23 tests pass through the **real Angular DI graph**.
Acceptance: `grep -n "useFactory" src/app/core/services/operations.service.spec.ts`
returns nothing; suite green. Commit as
`test(frontend): revert OperationsService useFactory workaround`.

### L5 — Revert temp-items `overrideInputs` workaround (4 files)

In `temp-items-table.spec.ts`, `temp-items-filters.spec.ts`,
`temp-items-info-card.spec.ts`, `temp-item-detail-modal.spec.ts`:

1. Delete the `overrideInputs(...)` helper and its doc comment.
2. Replace each call with `fixture.componentRef.setInput('<name>', value)`
   **before** the first `fixture.detectChanges()` (the detail-modal `item`
   input is `input.required(...)` — setInput must precede CD).
3. Keep existing async flush patterns (`await Promise.resolve()` chains or
   migrate them to `await fixture.whenStable()` — either is acceptable if
   green).

Verify: `grep -rn "overrideInputs\|Object.defineProperty" src/app/features/temporary-items/`
returns nothing; suite green.

Acceptance: 4 files reverted, 106/106 green. Commit as
`test(frontend): revert temp-items input overrides to componentRef.setInput`.

### L6 — Remove the standalone vitest path

1. Delete `vitest.config.ts` and `src/test-setup.ts`.
2. `package.json` scripts: add `"test:unit": "ng test --watch=false"`.
   Do not touch other scripts.
3. `grep -rn "test-setup\|vitest.config" src/ angular.json tsconfig*.json package.json`
   → no remaining references.
4. `npm run build` green; `npx ng test --watch=false` green.

Acceptance: single runner remains; no dangling references. Commit as
`chore(frontend): drop standalone vitest config; canonical runner is ng test`.

### L7 — Documentation

1. `Warehouse_frontend/AGENTS.md` — Verification section: replace
   "Add frontend tests once Angular test tooling is initialized." with:
   "Run `npm run test:unit` (alias: `npx ng test --watch=false`,
   `@angular/build:unit-test` + vitest) for unit tests. Standalone
   `npx vitest` is removed; do not reintroduce `vitest.config.ts`."
2. Root `AGENTS.md` — Verification matrix, `Warehouse_frontend/` row:
   extend to "run `npm run build` and `npm run test:unit` after frontend
   changes...". **Root repo file** — `Warehouse_frontend/` and the
   workspace root are separate Git repositories (both on `dev`); L7/L8
   produce two commit sets, one per repo, each with explicit pathspecs
   per the respective Git Rules.
3. Create `docs/adr/0024-frontend-unit-test-runner.md` (root repo) with:
   - Context: esbuild-based standalone vitest cannot compile Angular
     (NG0202/NG0303/unresolved templates; 15 red tests; invisible type
     drift).
   - Decision: `@angular/build:unit-test` is the single unit-test runner;
     standalone `vitest.config.ts`/`test-setup.ts` deleted; zoneless kept;
     no zone.js.
   - Consequences: spec type drift now fails the build; watch via
     `npm test`; single-run via `npm run test:unit`; rejected SWC
     (insufficient) and analogjs (redundant dependency).
4. `Warehouse_frontend/README.md` — add a one-line "Tests" note pointing
   to `npm run test:unit` (currently absent).

Acceptance: docs describe the new canonical command; ADR committed.

### L8 — CI unit-test workflow

Create `.github/workflows/frontend-unit-tests.yml` (root repo):

```yaml
name: Frontend Unit Tests
on:
  push:
    branches: [dev, main]
    paths: ['Warehouse_frontend/**']
  pull_request:
    branches: [dev, main]
    paths: ['Warehouse_frontend/**']
  workflow_dispatch:

jobs:
  unit:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: Warehouse_frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          # Matches local dev Node (v20.x as of 2026-07). Bump deliberately
          # if the team upgrades the local toolchain.
          node-version: 20
          cache: npm
          cache-dependency-path: Warehouse_frontend/package-lock.json
      - run: npm ci
      - run: npx ng test --watch=false
```

Do not modify `e2e-tests.yml`. YAML validity is verified by the next CI
run after the user pushes; if the executor has `actionlint` available,
run it locally.

Acceptance: workflow file committed; `npm ci` compatibility confirmed
locally (`package-lock.json` present).

### L9 — Final acceptance

| # | Criterion | Command / check |
|---|---|---|
| 1 | Suite green | `npx ng test --watch=false` → 16/16 files, 106/106 tests |
| 2 | Single runner | `vitest.config.ts`, `src/test-setup.ts` absent; `npm run test:unit` works |
| 3 | Workarounds gone | greps of L4/L5 return nothing |
| 4 | Build green | `npm run build` |
| 5 | No production diff | `git diff e6ef250..HEAD --stat -- src/app` lists only `*.spec.ts` (+ conditional `app.spec.ts`) |
| 6 | E2E regression | `make test-e2e` from workspace root (stand protocol: probe health first; if stand unavailable, leave unchecked with blocker note) |
| 7 | Docs | `Warehouse_frontend/AGENTS.md`, root `AGENTS.md`, ADR-0024 committed |
| 8 | CI | workflow file present on `dev` |
| 9 | Evidence | table below filled |

## 7. Execution strategy

**Sequential by default.** The scope is small, several levels share files
(`operations.service.spec.ts` in L1+L4, `temp-item-detail-modal.spec.ts`
in L1+L5, `package.json`/docs in L6/L7), and L2 is a hard decision gate
that must complete before any workaround revert.

**Staged-parallel option (max 2 threads), only after L2 passes:**

- Shard A: L3 (`logging.spec.ts`).
- Shard B: L4 + L5 (service/temp-items specs).
- Join: L6–L8 single-threaded (shared config/docs/CI files).

Ownership boundaries: spec files only per shard; `package.json`,
`angular.json`, docs, workflows belong to the join phase. Integration
point: after the join, one full-suite run + evidence table.

Two repositories are touched: `Warehouse_frontend/` (specs, config, its
`AGENTS.md`) and the workspace root (root `AGENTS.md`, `docs/adr/0024-*`,
`.github/workflows/frontend-unit-tests.yml`). Commits are made per repo,
on `dev`, with explicit pathspecs; never mixed.

## 8. Test ladder mapping

| Level | Applies | Where |
|---|---|---|
| 1 Static (type-check) | ✅ | every `npx ng test --watch=false` run (builder gate) |
| 2 Unit | ✅ | the 106-test suite |
| 3 Component (TestBed) | ✅ | app/nomenclature/temp-items specs |
| 4 Integration (real DI) | ✅ | restored by L4/L5 reverts |
| 5 Stand smoke | ✅ | `npm run build` + `make test-e2e` regression (L9 #6) |
| 6 UI automation | ✅ (regression only) | Playwright via `make test-e2e` — no spec changes |
| 7 User scenarios | ➖ N/A | no functional change |
| 8 Regression pack | ✅ | L9 criteria 4–6 |
| 9 Acceptance review | ✅ | L9 with evidence table |

## 9. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Builder green-chain not pre-validated end-to-end (architect could not execute the fix chain without touching sources) | Medium | L1/L2 form an explicit gate: cheapest work first, STOP conditions prescribed, no reverts before the gate |
| Latent runtime failures beyond R1–R3 under the builder | Low–Med | R3 stop-rule (>2 regressions → halt and report) |
| Watch-mode slower than raw vitest | Low | Accepted; recorded in ADR-0024; single-run CI unaffected |
| `make test-e2e` stand unavailable at L9 | — | Stand protocol: probe health, `make up` if down; else leave #6 unchecked with blocker note |
| Reverts (L4/L5) uncover real DI/input bugs previously masked | Low | That is the intended effect; if found, executor reports and the fix becomes a follow-up TZ (production code is out of scope here) |

## 10. Evidence table (executor fills at L9)

Executed 2026-07-31 against baseline commit `e6ef250` (`dev` branch).

| Check | Command / Tool | Result | Evidence |
|---|---|---|---|
| Baseline reproduced (standalone vitest) | `npx vitest run` | fail (matches §1) | 4 failed / 12 passed (16 files); 15 failed / 91 passed (106 tests); 1 unhandled NG0201 |
| Baseline reproduced (official builder) | `npx ng test --watch=false` | fail (matches §RC5) | 8 TS errors in 5 spec files: TS2353×1, TS2554×4, TS2739×1, TS18048×1, TS2741×1 |
| L1 type drift fixed | `npx ng test --watch=false` (build phase) | pass | application bundle generated; 0 TS errors; suite executed |
| L2 gate: groups A/C/D green (architect hypothesis) | `npx ng test --watch=false` | pass | `auth-context.service.spec.ts` (7) + `app.spec.ts` (2) + `nomenclature-page.spec.ts` (2) all green; `logging.spec.ts` (4) still red, as expected; no R1–R3 needed |
| L3 group B fixed | `npx ng test --watch=false` | pass | 16/16 files, 106/106 tests green |
| L4 workaround revert (ops) | `grep "useFactory" src/app/core/services/operations.service.spec.ts` | absent | no matches |
| L5 workaround revert (temp-items) | `grep -rn "overrideInputs\|Object.defineProperty" src/app/features/temporary-items/` | absent | no matches |
| Full suite (L3–L6 stable) | `npx ng test --watch=false` (post-L6) | pass | 16/16 files, 106/106 tests pass |
| Build smoke | `npm run build` | pass (with pre-existing SCSS budget warnings unrelated to this TZ) | output in `dist/warehouse-frontend/browser/` |
| Production diff scope | `git diff e6ef250..HEAD --name-only -- src/app` | spec-only | 9 files, all `*.spec.ts`; zero production source changes |
| E2E regression | `make test-e2e` | **blocked (pre-existing stand state, unrelated)** | 31 failed / 29 skipped / 45 passed (23.7 m); failures all `page.waitForSelector` timeouts on `[data-testid="operations-page"]` after admin login; stend had no SyncServer tokens in `.env` (root tokens freshly regenerated by executor's `bootstrap_root.py` were not picked up by Django); root cause is stand bootstrap, not this TZ. TZ scope forbids touching Django/SyncServer/e2e config; L9 #6 left unchecked with blocker note. |
| Docs/ADR/CI | file presence + diff | pass | frontend: `AGENTS.md`, `README.md`; root: `AGENTS.md`, `docs/adr/0024-frontend-unit-test-runner.md`, `.github/workflows/frontend-unit-tests.yml` |

### Commit trail (per repo, branch `dev`)

`Warehouse_frontend` (submodule):

- `106d8b6` L1 — repair spec type drift for `@angular/build:unit-test`
- `1112567` L3 — provide DiagnosticsService/Router in logging spec
- `9029cb7` L4 — revert OperationsService useFactory workaround
- `94a5453` L4 follow-up — keep L4 commit grep-clean (no useFactory in comments)
- `f350e39` L5 — revert temp-items input overrides to componentRef.setInput
- `f2e36ca` L6 — drop standalone vitest config; canonical runner is ng test
- `03d8e62` L7 — document ng test as canonical unit-test runner

Workspace root:

- `40e1e97` L7 — ADR-0024 + AGENTS.md verification matrix update for ng test runner
- `3abfa89` L8 — add frontend unit-tests workflow on `@angular/build:unit-test`

## 11. Reference commits (do not revert)

- `8de71e4` — temp-items page-size + first-pass spec workarounds (L4/L5
  revert only the workaround patterns inside spec files)
- `b6175c8` — `mapDtoToDraftVm` displayNumber fix
- `00c4187` — Playwright TZ and Style System TZ closures
- `0acb51c` — `TZ_TEMPORARY_ITEMS_ANGULAR` archival
- `e6ef250` — investigator draft of this TZ (baseline for diffs)

## 12. QA review (architect, 2026-07-31)

Independent re-verification of the executor's report against the actual
repository state. Every claim below was re-run or re-inspected by the
architect, not taken from the report.

| Claim | QA check | Result |
|---|---|---|
| 8 frontend commits, exact scope | `git log --oneline e6ef250..HEAD`; `git status` clean | confirmed |
| Zero production diff | `git diff e6ef250..HEAD --stat -- src/app` → 9 files, all `*.spec.ts` | confirmed |
| Deletions | `vitest.config.ts`, `src/test-setup.ts` absent | confirmed |
| Workarounds gone | `grep useFactory` (ops spec) → 0; `grep "overrideInputs\|Object.defineProperty"` (temp-items) → 0 | confirmed |
| Suite green | QA re-ran `npx ng test --watch=false` → **16/16 files, 106/106 tests** | confirmed |
| Build green | QA re-ran `npm run build` → complete, no errors | confirmed |
| Root repo commits | `40e1e97` (AGENTS.md + ADR-0024), `3abfa89` (CI workflow) only | confirmed |
| Stand state | all 4 services HTTP 200 / healthy at QA time | confirmed |

**Verdict:** checklist items 0–9 are confirmed by QA. Item 10 (final
acceptance) remains **unchecked**: criterion #6 (E2E regression) is unmet.
The blocker is environmental — SyncServer token bootstrap state of the
local stand (tokens regenerated by `bootstrap_root.py` were not written
into the Django `.env`; secrets/runtime configs are outside architect and
executor boundaries). Zero production diff in this TZ makes a causal link
between the TZ and the E2E failures impossible.

**Closure paths for item 10 (user decision):**

1. Accept the zero-production-diff proof and check item 10 manually; or
2. Refresh stand tokens per the CI flow (`bootstrap_root.py` → tokens into
   `.env` → restart `warehouse_web`), re-run `make test-e2e`, then check
   criterion #6 and item 10.
