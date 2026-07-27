# TZ: Fix vitest zoneless setup for Angular DI + change detection

> **Status:** DRAFT — problem statement for the architect. This file is not an
> executable TZ yet. The architect should expand it into a proper TZ with
> acceptance criteria, levels, evidence, and parallel workstreams.

## Execution Checklist (architect to fill in)

- [ ] 0. Context verified
- [ ] 1. Architecture boundaries confirmed
- [ ] 2. Implementation approach selected (see §5)
- [ ] 3. vitest transformer / config migrated
- [ ] 4. tsconfig.spec.json adjusted (if needed)
- [ ] 5. src/test-setup.ts aligned
- [ ] 6. All 15 currently-failing spec files green
- [ ] 7. Workarounds in operations.service.spec.ts and temp-items/*.spec.ts
      reverted (or kept with explicit justification)
- [ ] 8. `npm run test:unit` (or equivalent) passes locally
- [ ] 9. CI pipeline green
- [ ] 10. Documentation updated (`AGENTS.md`, `README.md`, `package.json` scripts)
- [ ] 11. Final acceptance review

## Context

`Warehouse_frontend` runs `npx vitest` as its unit-test runner (see
`vitest.config.ts`). The runner is configured with `environment: 'jsdom'`
and `setupFiles: ['src/test-setup.ts']`. Vitest uses esbuild as its default
TypeScript transformer, which — for this repo — does not emit
`experimentalDecorators` metadata (`__metadata("design:paramtypes", [...])`)
that Angular DI relies on for constructor-injected services.

The repo also has no `zone.js` import in `src/test-setup.ts` (zone-based
change detection is not initialized), so signal-based inputs and
`fixture.componentRef.setInput(...)` do not trigger change detection
reliably in test runs.

As a result of these two combined issues, **15 unit tests in 4 spec files
are currently red** as of commit `b6175c8` (2026-07-27). Two of the affected
files have already received manual workarounds in earlier passes; the
remaining 4 file groups still need a systematic fix.

This is the leftover from a previous closure pass on
`TZ_FRONTEND_SHARED_STYLE_SYSTEM.md` and
`TZ_OPERATIONS_ACCEPTANCE_PLAYWRIGHT.md` (commits `00c4187`, `8de71e4`,
`b6175c8`). Those TZs marked the vitest issues as out of scope; this TZ
consolidates them.

## Authoritative sources

- `Warehouse_frontend/vitest.config.ts` — current vitest config
- `Warehouse_frontend/src/test-setup.ts` — current test-bed init
- `Warehouse_frontend/tsconfig.spec.json` — current spec tsconfig
- `Warehouse_frontend/package.json` — current `test:unit` script
- `Warehouse_frontend/AGENTS.md` — verification matrix
- `Functional and WorkLogik.md` — domain layer (out of scope for this TZ)

## Scope (in scope)

- `Warehouse_frontend/vitest.config.ts` — may need transformer / plugin changes
- `Warehouse_frontend/src/test-setup.ts` — may need zone.js or zoneless provider
- `Warehouse_frontend/tsconfig.spec.json` — may need `emitDecoratorMetadata`
- `Warehouse_frontend/package.json` — may need new dev-deps (`@swc/core`,
  `unplugin-swc`, `@analogjs/vitest-angular`, etc.)
- The 4 currently-failing spec files:
  - `Warehouse_frontend/src/app/app.spec.ts` (2 fails)
  - `Warehouse_frontend/src/app/core/logging/logging.spec.ts` (4 fails)
  - `Warehouse_frontend/src/app/core/services/auth-context.service.spec.ts` (7 fails)
  - `Warehouse_frontend/src/app/features/nomenclature/nomenclature-page/nomenclature-page.spec.ts` (2 fails)
- Revert existing manual workarounds once the systematic fix is in place:
  - `src/app/core/services/operations.service.spec.ts` (useFactory workaround)
  - `src/app/features/temporary-items/components/temp-items-{table,filters,info-card,detail-modal}.spec.ts` (Object.defineProperty workaround)

## Out of scope

- Changes to `Warehouse_frontend/e2e/**` (Playwright uses its own runner, not vitest)
- Changes to `Warehouse_web/**` and `SyncServer/**` (their own test stacks)
- New test cases (this TZ only fixes existing tests, does not add new ones)
- Production-code changes beyond what is strictly required by the fix
- Refactor of `OperationsService`, `AuthContextService`, `LoggingService`, etc.
  unless the chosen fix requires it
- Migration to a different test runner (Jest, Karma, etc.) unless architect
  explicitly chooses that path

## 1. Problem statement

`npx vitest` in `Warehouse_frontend` does not produce a working test
environment for Angular services and components that rely on:

1. Constructor-injected dependencies (Angular DI through `__metadata`).
2. Signal-based change detection (Angular signals + zoneless CD).
3. `inject()` calls outside constructor / factory function contexts.
4. `HttpClientTestingController` intercepting requests to a real
   `HttpClient` instance built from the angular DI graph.

Three concrete failure modes are observed (see §2 for evidence).

## 2. Evidence — failing tests and root causes

### 2.1 Inventory at commit `b6175c8` (2026-07-27)

```
$ npx vitest run
 Test Files  4 failed | 12 passed (16)
      Tests  15 failed | 91 passed (106)
```

### 2.2 Failure group A — `auth-context.service.spec.ts` (7 fails)

All 7 tests fail with the same error:

```
NG0202: This constructor is not compatible with Angular Dependency Injection
because its dependency at index 0 of the parameter list is invalid.
This can happen if the dependency type is a primitive like a string or if
an ancestor of this class is missing an Angular decorator.
```

The service is the textbook Angular DI pattern:

```ts
// src/app/core/services/auth-context.service.ts
@Injectable({ providedIn: 'root' })
export class AuthContextService {
  constructor(private bff: BffApiService) {}
  ...
}
```

The spec uses `TestBed.configureTestingModule({ providers: [...] })`
analogously to other working specs in the repo. The error fires at
`TestBed.inject(AuthContextService)`.

**Root cause:** vitest's esbuild transformer does not emit the
`__metadata("design:paramtypes", [BffApiService])` decorator metadata
that Angular's `ɵfac` factory relies on. Without the metadata, the
factory sees `Object / undefined` for parameter index 0 and rejects
injection with NG0202.

This same root cause used to break `operations.service.spec.ts`
(23 tests) until commit `8de71e4` applied a manual workaround
(`useFactory: () => new OperationsService(...)`). The architect may
either (a) keep that workaround and apply it everywhere, or (b) fix the
transformer and revert the workaround.

### 2.3 Failure group B — `logging.spec.ts` (4 fails)

Two sub-groups, two different root causes:

**B1. `HttpErrorInterceptor` (2 tests)** — `Expected one matching request
for criteria "Match URL: /bff/api/v1/test", found none.`

`HttpClientTestingController.expectOne('/bff/api/v1/test')` does not
match the request even though the interceptor and the `HttpClient.get(...)`
call are exercised. Likely cause: the test provides a real `HttpClient`
built from `provideHttpClient(...)`, but the testing controller only
intercepts requests on a specific backend instance — and in the absence
of a real `HttpBackend` from `provideHttpClientTesting()`, the
interceptor chain may not be wired in the way `HttpClientTestingController`
expects. This is a test-setup issue specific to the logging test
harness, but it also fails to load the underlying provider chain
because of the same NG0203 issue (see B2).

**B2. `GlobalErrorHandler` (2 tests)** — `NG0203: The DiagnosticsService
token injection failed. inject() function must be called from an
injection context such as a constructor, a factory function, a field
initializer, or a function used with runInInjectionContext.`

Plus a follow-up chain:
```
No provider found for `InjectionToken DIAGNOSTICS_QUEUE_PORT`.
```

The `GlobalErrorHandler` service uses `inject(DiagnosticsService)` (or
similar) and depends on a token (`DIAGNOSTICS_QUEUE_PORT`) that is
provided in the production bootstrap but **not** in the spec. Same
class of issue as group A — DI metadata missing means the spec cannot
discover what the service needs.

### 2.4 Failure group C — `nomenclature-page.spec.ts` (2 fails)

```
AssertionError: expected 'НоменклатураКатегории, ТМЦ, SKU, един…' to contain 'Каталог'
AssertionError: expected 'НоменклатураКатегории, ТМЦ, SKU, един…' not to contain '+ Категория'
```

The spec sets `authState.set({ userId: 'root-user', role: 'root', ... })`
and then calls `fixture.detectChanges()`. It expects the rendered DOM to
reflect the readonly/editable mode. It does not — the rendered DOM is
stuck in the initial (pre-`set`) state.

**Root cause:** without zone.js, Angular signal changes are not
propagated to the DOM unless `detectChanges()` is called explicitly
**after** the signal write. The spec does call `detectChanges()` after
`authState.set(...)`, but the call may run before the signal
notification has flushed through the change-detection scheduler. This
is the same class of issue as the temp-items spec NG0950 problem we
worked around with `Object.defineProperty` in commits `8de71e4` — but
in those temp-items cases the workaround works because we are forcing
the **value**, not relying on signal change propagation.

### 2.5 Failure group D — `app.spec.ts` (2 fails)

```
Component 'App' is not resolved:
```

The root `App` component fails to instantiate. Most likely cause is the
same DI metadata issue cascading into the root component's
`provideRouter` / `provideHttpClient` chain. Likely resolves
automatically once the underlying transformer / setup is fixed.

## 3. Workarounds already in place (revertable)

### 3.1 `operations.service.spec.ts` (commit `8de71e4`)

Replaced direct `providers: [OperationsService]` with
`useFactory: () => new OperationsService(bffMock, authMock, searchMock,
diagSessionMock, diagnosticsMock)`. This bypasses DI metadata by
constructing the service with explicit arguments. Result: 22/23 pass,
1 residual fix in commit `b6175c8` (`computeClientDisplayNumber`).

**Drawback:** tests no longer exercise the real Angular DI graph for
this service. A bug in `@Injectable({ providedIn: 'root' })` wiring
would not be caught.

### 3.2 `temp-items/components/*.spec.ts` (commit `8de71e4`)

Replaced `fixture.componentRef.setInput(...)` with
`Object.defineProperty(instance, 'rows', { get: () => () => mockItems,
configurable: true })` in 4 spec files via an `overrideInputs(...)`
helper. This bypasses the zoneless `setInput` issue by directly
overriding the input getter on the component instance. Result: 7/7
pass.

**Drawback:** tests no longer exercise the real `input()` signal API
for these components. A regression in the `@Input` / `input()` contract
would not be caught.

## 4. Constraints and non-negotiables

- The TZ must **not** require a change to production code beyond what is
  strictly required by the fix.
- The TZ must **not** touch Playwright e2e specs (`Warehouse_frontend/e2e/**`).
- The TZ must **not** change the public `package.json` test scripts
  (e.g. `npm run test:unit`, `npm run build`) in a way that breaks CI.
- Any new dev-dependency must be added to `devDependencies` only
  (per `AGENTS.md` production-packaging rule).
- The TZ must preserve the convention that `@playwright/test` is the
  e2e runner and vitest is the unit-test runner. (Splitting the
  universe is OK; collapsing the two is not in scope here.)

## 5. Implementation approaches (architect to choose one)

### Approach A — Switch vitest transformer to SWC with emitDecoratorMetadata

- Add `@swc/core` and `unplugin-swc` (or equivalent) as dev-deps.
- Configure `vitest.config.ts` to use SWC for `.ts` files with
  `emitDecoratorMetadata: true` and `experimentalDecorators: true`.
- Update `tsconfig.spec.json` to set
  `"emitDecoratorMetadata": true` and `"experimentalDecorators": true`.
- Possibly add a small `vitest-swc-transform.ts` shim if plugin
  ergonomics are poor.
- Pros: minimal spec changes; reverts all existing workarounds cleanly.
- Cons: SWC + Angular DI metadata is well-trodden but not zero-risk;
  need to verify zone.js status (probably still need
  `provideZoneChangeDetection` or `provideExperimentalZonelessChangeDetection`).

### Approach B — Use `@analogjs/vitest-angular`

- Add `@analogjs/vitest-angular` (or the official `@angular/build:unit-test`
  builder if architect prefers ng test).
- Replace `vitest.config.ts` content with the analog plugin config.
- Pros: community-maintained, designed for exactly this use case,
  handles `emitDecoratorMetadata` and zone bootstrapping.
- Cons: another dependency to track; potentially heavy version bumps
  aligned to Angular major versions; may not work for every Angular 21
  feature.

### Approach C — Migrate unit tests to `ng test`

- Remove `vitest.config.ts` (or keep as legacy).
- Update `package.json` `test:unit` script to `ng test --watch=false`.
- Add `@angular/build:unit-test` builder config if not present.
- Pros: official Angular test stack, fully supported, handles all
  decorators / DI / zone issues out of the box.
- Cons: potentially slower than vitest; rewrites or removes
  `vitest.config.ts`; may require re-tooling CI scripts.

### Approach D — Accept zoneless, rework specs

- Add `provideExperimentalZonelessChangeDetection()` to test setup.
- Update every affected spec to call `fixture.detectChanges()` after
  every signal write / `setInput` call. Add `await fixture.whenStable()`
  where needed.
- Pros: aligns with Angular's stated direction (zoneless is the
  future). Removes need for `Object.defineProperty` workarounds.
- Cons: large refactor; may still hit NG0202 (DI metadata) unless
  combined with Approach A or B.

### Recommendation (informational, not binding)

The architect is most likely to converge on **Approach A** (SWC with
`emitDecoratorMetadata`) because it is the smallest delta, fully reverts
the existing workarounds, and does not change the test runner
(preserves CI investment in vitest).

If the architect chooses A and discovers a residual zone issue
(specs still don't see signal updates), layering **Approach D** on top
is the expected next step.

## 6. Acceptance criteria (architect to refine)

The TZ is complete when:

1. `npx vitest run` reports `Test Files  16 passed (16)` and
   `Tests  106 passed (106)` (or higher, if new tests are added).
2. The 4 file groups currently failing (app, logging, auth-context,
   nomenclature-page) all pass.
3. The two existing workarounds (operations.service.spec.ts useFactory,
   temp-items/components/*.spec.ts Object.defineProperty) are reverted
   in favor of the systematic fix — **or** explicitly kept with a
   doc-comment explaining why they must remain.
4. `npm run build` still passes.
5. The chosen approach is documented in `src/test-setup.ts` and
   `vitest.config.ts` with comments explaining the choice and the
   trade-offs accepted.
6. `AGENTS.md` verification matrix is updated if the canonical unit
   test command changes (it should not change in Approach A; will
   change in Approach C).
7. CI passes (verify by running the same commands locally that CI
   would run).

## 7. Out of scope (re-stated)

- Functional fixes to `AuthContextService`, `LoggingService`,
  `NomenclaturePageComponent`, or any other production source file
  beyond what the test setup change strictly requires.
- Adding new test cases.
- Refactoring the production code style (e.g. moving all constructor
  injection to `inject()` field initializers, which would not in itself
  fix the metadata issue but would make it less likely to recur).
- Updating Playwright e2e specs.
- Renaming files, moving directories.

## 8. Open questions for the architect

1. Do we keep vitest as the unit-test runner, or migrate to
   `ng test`? (Drives the choice between Approach A/B and Approach C.)
2. Is there a budget for adding a new dev-dependency
   (`@swc/core`/`@analogjs/vitest-angular`)? Roughly +5–25 MB of
   `node_modules` for SWC; +1–3 MB for analogjs.
3. Is the project willing to commit to zoneless change detection as
   the long-term direction, or do we want to keep zone.js available
   for the unit tests even if production moves to zoneless later?
4. Should the two existing workarounds (operations.service.spec.ts
   useFactory, temp-items Object.defineProperty) be **reverted as part
   of this TZ**, or left in place with a comment? (Architectural call —
   reverting is more thorough but may uncover additional latent bugs
   in DI / signal plumbing.)
5. Does the chosen approach need to play nicely with the
   `make test-e2e` Docker Playwright setup, or only with the local
   `npm run test:unit` invocation? (Should not, but worth confirming.)

## 9. Suggested evidence table for the final TZ

When the architect converts this draft into a TZ, the final report
should include an evidence table similar to:

| Check | Command | Result | Evidence |
|---|---|---|---|
| All vitest groups pass | `npx vitest run` | pass | 16/16 files, 106/106 tests |
| Workaround reverted (ops) | `grep "useFactory" operations.service.spec.ts` | absent | (file path) |
| Workaround reverted (temp-items) | `grep "Object.defineProperty" temp-items*.spec.ts` | absent | (file paths) |
| Build still passes | `npm run build` | pass | log path |
| tsconfig change documented | `tsconfig.spec.json` | pass | diff |
| vitest config change documented | `vitest.config.ts` | pass | diff |

## 10. Reference commits (do not revert)

- `8de71e4` — temp-items page-size + first pass at vitest workarounds
- `b6175c8` — operations.service `displayNumber` production fix +
  `OperationDraftVm.displayNumber` type addition
- `00c4187` — Playwright TZ and Style System TZ closures
- `0acb51c` — `TZ_TEMPORARY_ITEMS_ANGULAR` archival

These are the most recent commits to `Warehouse_frontend` and represent
the current state this TZ should be applied on top of.
