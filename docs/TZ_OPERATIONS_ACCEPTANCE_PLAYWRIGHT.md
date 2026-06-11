# TZ: Playwright acceptance suite for operations and acceptance

## Execution Strategy

- [ ] 🟢 Parallel execution recommended
- **Reason:** задача делится на независимые зоны владения: Playwright-инфраструктура и production packaging guard, стабильные селекторы операций, стабильные селекторы приёмки, сами e2e-сценарии и финальная интеграция. Эти зоны в основном пишут в разные файлы; общая интеграция нужна только после первого параллельного этапа, чтобы связать `data-testid`, helpers, seed/reset и сценарии.

### Parallel work units

| Unit | Owner area | Writable files/areas | Required inputs | Output |
|---|---|---|---|---|
| A. E2E infrastructure and packaging guard | Playwright runner, scripts, deploy safety | `Warehouse_frontend/playwright.config.ts`, `Warehouse_frontend/package.json`, `Warehouse_frontend/.gitignore`, `Warehouse_frontend/.dockerignore`, `Warehouse_frontend/e2e/helpers/**`, optional `Warehouse_frontend/e2e/README.md` | This TZ, `Warehouse_frontend/AGENTS.md`, `Warehouse_frontend/docs/ARCHITECTURE_FRONTEND_SPA.md`, current `e2e/*.spec.ts` | Deterministic Playwright setup, dev/test-only packaging rules, shared auth/network/seed helpers |
| B. Operations screen testability | Angular operations list/create/submit UI | `Warehouse_frontend/src/app/features/operations/pages/operations-page/**`, `Warehouse_frontend/src/app/features/operations/components/operations-*`, `operation-create-modal/**`, `operation-confirm-modal/**` | `docs/user_scenario/OPERATIONS_SCREEN_SCENARIOS.md`, `Functional and WorkLogik.md` section II/VIII | Stable `data-testid` and accessible names for operations scenarios without changing business ownership |
| C. Acceptance screen testability | Angular pending acceptance and acceptance detail UI | `Warehouse_frontend/src/app/features/operations/pages/pending-acceptance-page/**`, `operation-acceptance-page/**`, `features/operations/services/acceptance.service.ts` only if needed for error-state exposure | `docs/user_scenario/ACCEPTANCE_SCREEN_SCENARIOS.md`, `Functional and WorkLogik.md` section II/V | Stable `data-testid`, validation/error/empty/success states ready for Playwright |
| D. Scenario specs | E2E tests only | `Warehouse_frontend/e2e/operations/**`, `Warehouse_frontend/e2e/acceptance/**`, `Warehouse_frontend/e2e/regression/**` | Outputs from A/B/C, real stand credentials through environment names only | P0/P1 Playwright scenarios with evidence-friendly reports |

### Stage boundaries

1. **Stage 1 can run in parallel:** Units A, B, C.
2. **Parent integration checkpoint after Stage 1:** run `npm run build`, validate no selector collisions, ensure tests target Django base URL, and confirm packaging guard before writing scenario specs that depend on new helpers/selectors.
3. **Stage 2 can run after Stage 1:** Unit D writes/normalizes Playwright specs using the finalized helpers and selectors.
4. **Final parent/orchestrator stage:** run full verification ladder on the real stand, fill evidence, and leave unresolved domain-rule checks unchecked with blocker notes.

## Execution Checklist

- [ ] 0. Context verified
- [ ] 1. Architecture boundaries confirmed
- [ ] 2. Implementation stage 1 complete — Playwright infrastructure and production packaging guard
- [ ] 3. Implementation stages 2-4 complete — stable operations/acceptance `data-testid`, operations e2e scenarios, acceptance e2e scenarios
- [ ] 4. Unit/component tests complete
- [ ] 5. Integration tests with real dependencies complete
- [ ] 6. Stand smoke tests complete
- [ ] 7. UI automation tests complete
- [ ] 8. User scenario tests complete
- [ ] 9. Regression checks complete
- [ ] 10. Documentation updated
- [ ] 11. Final acceptance review complete

## Check Rules

- Architect creates this checklist and acceptance criteria.
- Executor agents may check implementation and test items only after implementation and verification evidence are present.
- QA verifier may check final acceptance only after reviewing the evidence table and confirming skipped checks have explicit reasons.
- Failed or unavailable checks stay unchecked with a blocker note in this file and in the executor report.
- Do not check UI/user-scenario items based only on unit/API tests.

## Context and authority

### Canonical requirements

- `Functional and WorkLogik.md` is authoritative for operation types, roles, operation lifecycle, acceptance, unreconciled/lost assets, and UI table rules.
- `docs/user_scenario/OPERATIONS_SCREEN_SCENARIOS.md` is the scenario source for the operations journal.
- `docs/user_scenario/ACCEPTANCE_SCREEN_SCENARIOS.md` is the scenario source for pending acceptance and acceptance detail.
- `Warehouse_frontend/docs/ARCHITECTURE_FRONTEND_SPA.md` is authoritative for Django-hosted Angular SPA boundaries.
- `Warehouse_frontend/AGENTS.md` is authoritative for frontend ownership and verification.

### Current baseline to preserve

- Angular is the owner of browser content screens; Django owns the authenticated shell.
- Browser runtime path must remain:

  ```text
  Browser -> Django business URL -> Angular content -> Django same-origin BFF -> Warehouse_web sync_client -> SyncServer
  ```

- Browser code and Playwright browser actions must not call SyncServer directly and must not expose SyncServer user/device tokens.
- Existing e2e files already exist under `Warehouse_frontend/e2e/`, but there is no durable Playwright config/script contract yet.
- `@playwright/test` is already a dev dependency in `Warehouse_frontend/package.json` and must remain dev/test-only.
- `Warehouse_frontend/.dockerignore` already excludes `e2e/`, `docs`, `dist`, and Markdown files from Docker build context; this TZ extends the packaging guard to reports/config as needed.

## Scope

### In scope

- Store the Playwright suite in `Warehouse_frontend`, not in `Warehouse_web`, not in `SyncServer`, and not in a new standalone repo.
- Add/normalize Playwright infrastructure:
  - `playwright.config.ts`;
  - `npm` script such as `test:e2e`;
  - reports/traces/screenshots on failure;
  - helpers for login, base URL, network guards, seed/reset, and API/BFF request contexts.
- Add stable `data-testid` on operations and acceptance screens/components where user scenarios require reliable selectors.
- Normalize existing ad-hoc specs into scenario-oriented specs grouped by feature:

  ```text
  Warehouse_frontend/e2e/
    helpers/
    operations/
    acceptance/
    regression/
  ```

- Run Playwright through Django-hosted business URLs such as `/operations/`, `/pending-acceptance/`, and `/operations/<id>/acceptance` or the current routed equivalent.
- Prove production packaging safety: e2e code can be tracked in Git, but is dev/test-only and must not be copied into production runtime artifacts.

### Out of scope

- Creating a standalone `Warehouse_e2e` repository.
- Moving tests into `Warehouse_web` or `SyncServer`.
- Replacing Django BFF with browser-to-SyncServer calls.
- Adding test-only write bypasses to SyncServer or Django without a separate TZ/ADR.
- Broad database resets, `TRUNCATE`, `DROP`, volume deletion, or destructive cleanup on a shared stand.
- Full automation of unresolved domain rules listed in the user-scenario documents until those rules are fixed by ADR/TZ.
- Desktop/mobile automation; this TZ is web Playwright only.

## Architecture boundaries

### Frontend ownership

- `Warehouse_frontend` owns Playwright config, specs, helpers, and Angular `data-testid` additions.
- Angular may add stable attributes and accessibility labels, but must not redraw Django topbar/sidebar and must not mount under non-canonical route prefixes.
- Tests must assert that Django shell remains visible for primary business routes.

### Django ownership

- Django is a real dependency and SPA host for e2e tests.
- Tests authenticate through Django and call Django same-origin BFF endpoints when setup helpers need API interaction.
- This TZ does not assign Django runtime changes. If a BFF endpoint is missing, document a blocker and create a separate TZ instead of adding hidden test-only endpoints.

### SyncServer ownership

- SyncServer remains the source of truth for warehouse writes and permission checks.
- Playwright browser context must never call `http://localhost:8000` or any `/api/v1` SyncServer endpoint directly.
- Runner-side health checks may call SyncServer health endpoint only as stand availability verification.

## Production packaging guard

The user explicitly accepted storing tests in the Angular repo but wants to avoid accidental production pull-in. Executors must implement and verify these rules.

### Required rules

1. Playwright specs and reports are **tracked/source dev-only**, not runtime assets.
2. Production deploy must consume the Angular build output, not the full working tree.
3. Production install must not install Playwright browser binaries.
4. Test outputs are never committed.
5. If production still uses `git pull`, the presence of source tests is acceptable only if they are not served as static files, not executed, and dev dependencies are not installed for runtime.

### Required implementation checks

- `Warehouse_frontend/.gitignore` must ignore at least:

  ```text
  /playwright-report
  /test-results
  /.playwright
  /blob-report
  ```

- `Warehouse_frontend/.dockerignore` must exclude Playwright source/config/report files from image contexts that do not need to run e2e:

  ```text
  e2e
  playwright-report
  test-results
  blob-report
  .playwright
  playwright.config.*
  ```

  If a future dedicated e2e Docker image needs these files, create a separate Dockerfile/context rather than weakening the production/frontend runtime guard.

- `@playwright/test` must remain in `devDependencies`, not `dependencies`.
- `npm run build` output must not contain `e2e`, `playwright-report`, `test-results`, or Playwright browser binaries.
- If production install command is documented or edited later, use `npm ci --omit=dev` or an equivalent production-only install. If browser installation is possible in that path, set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` for production install/build.

## Data and seed/reset strategy

### Principles

- Tests create or locate their own deterministic test data through the same public paths available to users or through Django BFF with authenticated test sessions.
- Use unique run prefixes, for example `E2E_<date>_<short-run-id>`, for operation comments/names where possible.
- Do not rely on mutable human-entered stand data unless the scenario is explicitly a smoke-only test.
- Cleanup is best effort and must be narrow: cancel/delete only operations created by the current run if the public/BFF contract supports it.
- Never run broad database cleanup on the shared dev stand.

### Required helper behavior

- Login helpers support at least root/chief/storekeeper/observer roles through environment variable names.
- Seed helpers must return identifiers of created operations/items so tests can clean up or report evidence.
- Reset helpers must be idempotent and safe if a previous run partially failed.
- When required data cannot be seeded through existing contracts, mark the scenario blocked and create a follow-up TZ for the missing API/fixture support.

### Environment variable names

Use names only in code/docs; do not commit secret values.

```text
E2E_BASE_URL
E2E_SYNC_HEALTH_URL
E2E_USERNAME_ROOT
E2E_PASSWORD_ROOT
E2E_USERNAME_CHIEF
E2E_PASSWORD_CHIEF
E2E_USERNAME_STOREKEEPER
E2E_PASSWORD_STOREKEEPER
E2E_USERNAME_OBSERVER
E2E_PASSWORD_OBSERVER
E2E_RUN_ID
E2E_DEFAULT_SOURCE_SITE
E2E_DEFAULT_DESTINATION_SITE
E2E_DEFAULT_ITEM_QUERY
```

Backward compatibility with existing `TEST_USERNAME` / `TEST_PASSWORD` is allowed for current smoke specs, but new scenario helpers should use the `E2E_*` names.

## Required `data-testid` contract

The user-scenario documents already define recommended IDs. Executors should use those IDs unless the rendered UI has a better equivalent with a documented reason.

### Operations P0 IDs

```text
operations-page
operations-title
operations-create-button
operations-acceptance-button
operations-export-button
operations-search-input
operations-type-filter
operations-site-filter
operations-date-from
operations-date-to
operations-only-mine-checkbox
operations-reset-filters-button
operations-tab-all
operations-tab-drafts
operations-tab-acceptance
operations-tab-posted
operations-tab-cancelled
operations-table
operation-row
operation-number-link
operation-type-cell
operation-status-cell
operation-direction-cell
operation-items-count-cell
operation-author-cell
operation-date-cell
operation-action-view
operation-action-edit
operation-action-submit
operation-action-cancel
operation-action-pdf
operation-action-delete
operations-pagination
operations-page-size-select
operations-empty-state
operations-error-message
```

### Acceptance P0 IDs

```text
acceptance-page
acceptance-title
acceptance-description
acceptance-table
acceptance-row
acceptance-operation-number-link
acceptance-operation-type-cell
acceptance-operation-status-cell
acceptance-operation-direction-cell
acceptance-operation-items-count-cell
acceptance-operation-author-cell
acceptance-operation-date-cell
acceptance-action-open
acceptance-action-print
acceptance-action-view
acceptance-pagination
acceptance-page-size-select
acceptance-empty-state
acceptance-error-message
acceptance-detail-page
acceptance-detail-title
acceptance-detail-operation-number
acceptance-detail-status
acceptance-detail-direction
acceptance-detail-lines-table
acceptance-line-row
acceptance-line-expected-qty
acceptance-line-accepted-qty-input
acceptance-line-missing-qty
acceptance-line-comment-input
acceptance-accept-all-button
acceptance-complete-button
acceptance-cancel-button
acceptance-save-draft-button
acceptance-validation-error
```

If a control does not exist yet, do not fake a passing test. Either implement the control if it is already required by `Functional and WorkLogik.md` / user scenarios and fits this TZ, or mark the exact scenario blocked and open a follow-up TZ.

## Scenario coverage plan

### P0 — must automate in this TZ

#### Operations journal

| Scenario ID | Source | Required checks |
|---|---|---|
| OPS-UI-001 | `OPS-SCREEN-001` | Authenticated user opens `/operations/`; Django shell and Angular content are visible; no blocking console errors; no infinite loader. |
| OPS-UI-002 | `OPS-SCREEN-002` | Empty/filter-no-results state is understandable; no 500/403; reset works when filters are active. |
| OPS-UI-003 | `OPS-SCREEN-003` | Search by operation number sends expected BFF query and narrows visible rows. |
| OPS-UI-004 | `OPS-SCREEN-005` | Type filter sends expected BFF query and shows only the selected type. |
| OPS-UI-005 | `OPS-SCREEN-006` | Site filter sends expected BFF query and does not break table/pagination. |
| OPS-UI-006 | `OPS-SCREEN-007` / `OPS-EDGE-010` | Valid date range filters; invalid range shows UI validation and does not send meaningless request. |
| OPS-UI-007 | `OPS-SCREEN-008` | `Только мои` sends own-user filter and is resettable. |
| OPS-UI-008 | `OPS-SCREEN-009` | Reset clears filters and reloads list. |
| OPS-UI-009 | `OPS-SCREEN-001`, section 4 | Pagination and page size 10/20/50 work without broken counts. |
| OPS-UI-010 | `OPS-SCREEN-001`, `Functional and WorkLogik.md` VIII.2 | Date sorting can be toggled and remains stable. |

#### Draft and submit

| Scenario ID | Source | Required checks |
|---|---|---|
| OPS-DRAFT-001 | `OPS-CREATE-002` | Create RECEIVE draft; status is draft; appears in drafts; balances are not changed by draft. |
| OPS-DRAFT-002 | `OPS-CREATE-004` | Create MOVE draft with source/destination; same-source-destination validation is enforced. |
| OPS-DRAFT-003 | `OPS-DRAFT-001..004` | Edit own draft line quantity/comment; invalid quantities block submit and server rejection is visible if UI misses it. |
| OPS-DRAFT-004 | `OPS-EDGE-009` | Empty draft cannot be submitted. |
| OPS-SUBMIT-001 | `OPS-SUBMIT-001` | Storekeeper can submit own/allowed warehouse operation. |
| OPS-SUBMIT-002 | `OPS-SUBMIT-002` | Storekeeper cannot submit another warehouse; UI shows rights error; status remains draft. |
| OPS-SUBMIT-003 | `OPS-SUBMIT-003` | Chief can submit allowed operation across warehouses. |
| OPS-SUBMIT-004 | `OPS-SUBMIT-004` | Root can submit operation across warehouses. |
| OPS-SUBMIT-005 | `OPS-SUBMIT-005` | Observer cannot submit; button hidden/disabled and direct BFF attempt is rejected if helper checks it. |

#### Pending acceptance and acceptance detail

| Scenario ID | Source | Required checks |
|---|---|---|
| ACCEPT-UI-001 | `ACCEPT-SCREEN-001` | Open pending acceptance screen; title, description, table, pagination/actions visible; no loader/error. |
| ACCEPT-UI-002 | `ACCEPT-SCREEN-002` | Empty pending acceptance state is understandable. |
| ACCEPT-UI-003 | `ACCEPT-SCREEN-003` | Only submitted RECEIVE/MOVE waiting for acceptance appear; drafts/expense/write-off/cancelled/resolved do not. |
| ACCEPT-UI-004 | `ACCEPT-SCREEN-004` | Open acceptance card from list; operation metadata and lines table are visible. |
| ACCEPT-FULL-001 | `ACCEPT-FULL-001` | Full acceptance for RECEIVE: accepted quantity is posted, operation leaves pending list, success state is shown. |
| ACCEPT-FULL-002 | `ACCEPT-FULL-002` | Full acceptance for MOVE: operation can be accepted; final balance timing assertions are limited until domain rule is fixed. |
| ACCEPT-PARTIAL-001 | `ACCEPT-PARTIAL-001` | Partial acceptance of one line requires discrepancy note and creates lost/unaccepted evidence through available UI/BFF. |
| ACCEPT-PARTIAL-002 | `ACCEPT-PARTIAL-002` | Partial acceptance across several lines shows per-line missing quantities and comments. |
| ACCEPT-VALIDATION-001 | `ACCEPT-VALIDATION-001..004` | Accepted quantity greater than expected, negative, empty, or malformed values are blocked. |
| ACCEPT-PERM-001 | `ACCEPT-PERM-001..005` | Storekeeper/chief/root/observer access behavior matches role expectations. |

### P1 — automate if P0 is stable in the same implementation cycle

- PDF/download button availability for submitted/conducted operations if document contract is stable.
- Double-submit/double-accept conflict handling with two browser contexts.
- SyncServer unavailable banner/retry behavior using safe network interception or controlled stand outage only if approved.
- Full regression for ISSUE / ISSUE_RETURN / WRITE_OFF / CORRECTION flows after their UI is stable.

### P2 — leave blocked until domain rules are fixed

- Exact balance timing for MOVE acceptance.
- Final status semantics for partial acceptance.
- Editing/correcting completed acceptance.
- Root cancellation of already accepted/conducted operations.
- Separate acceptance PDF/act if not yet specified.

## Implementation stages and acceptance criteria

### Stage 0 — context verification

Executor must read:

- `Functional and WorkLogik.md` sections II, V, VIII;
- `docs/user_scenario/OPERATIONS_SCREEN_SCENARIOS.md`;
- `docs/user_scenario/ACCEPTANCE_SCREEN_SCENARIOS.md`;
- `Warehouse_frontend/AGENTS.md`;
- `Warehouse_frontend/docs/ARCHITECTURE_FRONTEND_SPA.md`.

Acceptance:

- Report confirms alignment with functional requirements.
- Any contradiction is listed before implementation continues.

### Stage 1 — Playwright infrastructure and production packaging guard

Expected changes:

- Add `playwright.config.ts` with:
  - `baseURL` from `E2E_BASE_URL`, defaulting to Django dev URL only for local dev;
  - retry/trace/screenshot/video policy suitable for CI/headless;
  - projects at minimum Chromium; Firefox/WebKit optional after P0 is stable;
  - test directory `e2e`;
  - report output ignored by Git.
- Add npm scripts:
  - `test:e2e` for headless suite;
  - optional `test:e2e:headed` for local debugging, not CI default.
- Add helpers:
  - `loginAsRole` / session storage reuse;
  - console-error capture;
  - network guard that fails if browser calls SyncServer directly;
  - BFF request helper using Django authenticated context;
  - safe seed/reset helper.
- Update `.gitignore` and `.dockerignore` according to the production packaging guard.

Acceptance:

- `npx playwright test --list` or `npm run test:e2e -- --list` lists tests without starting browser actions.
- `npm run build` still passes.
- Docker context excludes e2e/report/config artifacts unless a dedicated e2e image is explicitly used.
- No secret values are committed.

### Stage 2 — stable operations and acceptance selectors

Expected changes:

- Add `data-testid` to required operations and acceptance elements.
- Prefer stable test IDs and roles over CSS class selectors in new tests.
- Keep visible Russian labels unchanged unless there is a functional/UI reason.
- Preserve Django shell/Angular content ownership.

Acceptance:

- Existing UI still builds and renders.
- No business logic changes are introduced solely for selectors.
- Scenario specs can locate all P0 elements without brittle CSS traversal.

### Stage 3 — operations e2e scenarios

Expected changes:

- Move/normalize current operations e2e tests under `e2e/operations/`.
- Replace hardcoded credentials with helper/env usage.
- Cover P0 operations journal and draft/submit scenarios.
- Tests must create uniquely identifiable operations or use deterministic seeded fixtures.

Acceptance:

- P0 operations scenarios pass on the real stand or are explicitly blocked with root cause.
- Tests verify Django BFF requests where relevant and fail on direct browser SyncServer calls.
- Created test data is cleaned up or documented with unique run IDs.

### Stage 4 — acceptance e2e scenarios

Expected changes:

- Add `e2e/acceptance/` specs for pending acceptance and acceptance detail P0 scenarios.
- Seed operations requiring acceptance through UI/BFF using existing contracts.
- Verify full and partial acceptance through real UI and BFF/visible state.
- Keep balance assertions limited where domain rules are unresolved.

Acceptance:

- P0 acceptance scenarios pass or are blocked only by explicitly documented missing domain/UI/API contracts.
- Partial acceptance proves missing quantity/comment behavior and lost/unaccepted evidence through available UI/BFF.
- Role restrictions are tested for storekeeper/chief/root/observer.

### Stage 5 — final integration and evidence

Expected changes:

- Run full verification ladder.
- Save Playwright report/screenshots/traces as generated artifacts only; do not commit them.
- Fill evidence table in executor report and, if required by workflow, update this checklist.

Acceptance:

- All checked boxes have command/tool evidence.
- Skipped or blocked checks have exact blocker notes.
- Final report lists this TZ absolute path.

## Real test stand

### Services

Use the documented Docker stand from workspace root `/home/makc/AI_sandbox/warehouse_solution`.

| Service | Address | Health check | Role in e2e |
|---|---|---|---|
| Django / Warehouse_web | `http://localhost:8001` | `GET /healthz/` | Primary Playwright `baseURL`; auth, shell, BFF |
| SyncServer | `http://localhost:8000` | `GET /api/v1/health` | Backend source of truth through Django/BFF only |
| PostgreSQL | `localhost:5432` | `pg_isready -h localhost -p 5432 -t 3` | Real test DB for SyncServer and Django |
| Angular dev server | `http://localhost:4200` | `GET /` if used | Optional during dev; Playwright must still enter through Django business URLs |

### Stand lifecycle

- Default assumption: stand is already running.
- If requests fail, follow root `AGENTS.md` stand protocol:
  - `make status`;
  - `make up` if down;
  - `make restart` or `make build-angular` only if needed after frontend changes.
- Do not use destructive Docker volume cleanup for this TZ.

### Seed data

Required seed capabilities:

- users for root/chief/storekeeper/observer roles;
- at least two warehouses/sites for MOVE scenarios;
- at least one catalog item with stock for source-warehouse flows;
- ability to create RECEIVE and MOVE drafts and submit them;
- ability to accept operation lines.

If the stand lacks deterministic users/sites/items, executor must document the blocker and either:

1. use existing bootstrap fixtures if documented; or
2. create a follow-up TZ for fixture/bootstrap support.

### Smoke commands

Run from workspace root or `Warehouse_frontend` as noted:

```text
make status
```

From `Warehouse_frontend`:

```text
npm run build
npm run test:e2e -- --list
npm run test:e2e
```

If Angular unit/component tests are touched:

```text
npm test -- --watch=false
```

If Django BFF is touched by a follow-up implementation, run from `Warehouse_web`:

```text
python manage.py test apps.bff_api.tests apps.operations.tests
python manage.py check
```

If SyncServer is touched by a follow-up implementation, run from `SyncServer`:

```text
python -m pytest
```

## Test strategy ladder

| Level | Required? | What to run/check | Notes |
|---|---:|---|---|
| Static checks | Yes | `npm run build`; `npm run test:e2e -- --list`; lint/type checks if added | Required for frontend and Playwright config correctness. |
| Unit tests | Conditional | `npm test -- --watch=false` for changed Angular logic/helpers if unit-testable | Selector-only changes may not require new unit tests, but existing tests must not regress if touched. |
| Component tests | Conditional | Angular component tests for changed VM/validation behavior | Required if UI logic changes beyond adding attributes. |
| Integration tests | Yes for runtime flows | Real Django BFF + SyncServer via Playwright/BFF helpers; Django tests only if Django touched | Do not replace with mocked browser-only tests. |
| Real stand smoke tests | Yes | Login through Django, open `/operations/`, verify shell/content/BFF health | Required because runtime UI behavior is touched. |
| UI automation | Yes | `npm run test:e2e` through Django-hosted URLs | Core deliverable of this TZ. |
| User scenarios | Yes | P0 scenario map above | Must cite scenario IDs in test names or comments. |
| Regression pack | Yes | Existing operations-create/list tests normalized and passing; auth/shell/no-direct-SyncServer checks | Prevents breaking current create modal and list filters. |
| Acceptance review | Yes | Evidence table, generated report path, blocker list, final checklist review | QA checks only after evidence exists. |

## Evidence requirements

Executor final report must include:

| Check | Command / Tool | Result | Evidence |
|---|---|---|---|
| Build/static | `npm run build` | pass/fail/skipped | log summary |
| Playwright list | `npm run test:e2e -- --list` | pass/fail/skipped | count of discovered tests |
| Unit/component | `npm test -- --watch=false` if applicable | pass/fail/skipped | reason if skipped |
| Stand smoke | Playwright or browser tool through `E2E_BASE_URL` | pass/fail/skipped | URL/screenshot/log note |
| UI automation | `npm run test:e2e` | pass/fail/skipped | report path, failed trace paths if any |
| User scenarios | P0 scenario IDs | pass/fail/blocked | scenario list with blockers |
| Packaging guard | `.gitignore`, `.dockerignore`, build artifact inspection | pass/fail | evidence that e2e/report artifacts are not production runtime assets |

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Playwright tests become flaky because they rely on mutable stand data | False failures and low trust | Seed with unique run IDs, narrow cleanup, avoid human data dependencies. |
| E2E code is accidentally treated as production runtime | Larger deploys, browser binaries on prod | Keep Playwright in devDependencies, ignore reports, dockerignore e2e/config for runtime image, build artifact deploy only. |
| Tests bypass architecture by calling SyncServer directly | False confidence and token exposure risk | Network guard fails browser requests to SyncServer; setup goes through Django BFF/authenticated context. |
| Domain rules are unresolved | Tests assert wrong behavior | Mark P2 blocked; do not automate exact balance/status semantics until ADR/TZ fixes them. |
| Selectors are brittle | Maintenance overhead | Add stable `data-testid` from scenario docs and use role/text only where intentionally user-facing. |
| Parallel edits collide in operations components | Merge conflicts | Units B and C own different components; Unit D waits for selector integration checkpoint. |

## Final acceptance criteria

- Playwright suite lives in `Warehouse_frontend` and is runnable with a documented npm script.
- Production packaging guard is implemented and verified.
- P0 operations and acceptance scenarios are automated or explicitly blocked with exact missing contract reasons.
- Tests enter through Django-hosted business URLs and assert no direct browser SyncServer calls.
- Stable `data-testid` contract is present for P0 elements.
- Real-stand evidence exists for build, smoke, UI automation, user scenarios, and regression checks.
- No secrets, tokens, generated reports, traces, screenshots, or Playwright browser binaries are committed.
