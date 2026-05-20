# TZ: FHD compact table layout for Angular warehouse screens

## Execution Checklist

- [ ] 0. Context verified
- [ ] 1. Architecture boundaries confirmed
- [ ] 2. Implementation level 1 complete
- [ ] 3. Unit/component tests complete
- [ ] 4. Integration tests with real dependencies complete
- [ ] 5. Stand smoke tests complete
- [ ] 6. UI automation tests complete
- [ ] 7. User scenario tests complete
- [ ] 8. Regression checks complete
- [ ] 9. Documentation updated
- [ ] 10. Final acceptance review complete

## Check Rules

- Architect creates the checklist and acceptance criteria.
- Executor agents may check implementation and test items only after running the required verification.
- QA verifier may check final acceptance only after reviewing evidence.
- If a check is skipped, it must stay unchecked with a reason in the report.

## 0. Context and Problem

Canonical functional authority: `../../Functional and WorkLogik.md`, especially sections I.3, VIII.2, VIII.3, VIII.4.

Observed screen: `/balances/?search=ui&item_id=&site_id=&page_size=20` in the Django shell. On an FHD browser, the filter area consumes too much vertical space before the table. The operator sees only a small part of the balances table, although this screen is primarily a data table.

Specific current issues found in `Warehouse_web/templates/balances/list.html` and shared frontend docs:

- The balances filter card uses generous vertical spacing (`card`, `mb-4`, `grid-2`, full-width checkbox row, full-width action row), so controls take about two thirds of the useful vertical area in the screenshot.
- Table headers are plain `<th>` elements, not clickable sort controls.
- The SSR page exposes page sizes `20`, `50`, `100`, `200`, while the functional requirement says `10`, `20`, `50`.
- The table wrapper only provides horizontal overflow; normal FHD table work needs vertical table-body scrolling with sticky headers.
- `Warehouse_frontend/docs/ARCHITECTURE_FRONTEND_SPA.md` already references this shared style document, but the document was missing before this TZ.

This TZ sets the shared UI contract for all Angular table-heavy screens. Existing SSR screens should follow the same visual rules when touched, but the priority is Angular screens mounted in the Django shell.

## 1. Architecture Boundaries

### In scope

- `Warehouse_frontend/src/styles/*` shared `wh-*` layout primitives.
- Angular table-heavy screens: balances, operations, pending acceptance, unaccepted/lost assets, temporary items, issued assets, catalog/nomenclature tables.
- Angular component templates/styles that render filters, table cards, sortable headers, pagination, loading/empty/error states.
- BFF/API query contracts only where sorting/pagination parameters are needed by a screen.
- Playwright UI checks through the Django-hosted business URLs.

### Out of scope

- Moving the Django topbar/sidebar into Angular.
- Direct browser calls to `SyncServer`.
- Changing warehouse domain write ownership; all writes remain owned by `SyncServer` services.
- Replacing the whole Django shell visual system unless a separate ADR/TZ approves it.
- Working on `WarehouseAIWorkstation`.

## 2. Shared FHD Compact Layout Contract

Target display: FHD `1920x1080`, with Django topbar and sidebar visible. Angular owns only the content rectangle to the right of the sidebar and below the topbar.

For every Angular table-heavy screen:

1. Use a column layout with `height: 100%` or equivalent inherited height, `min-height: 0`, and a growing table region.
2. The control zone from the bottom of the Django topbar to the bottom of the primary filter action row must be at most 25% of the visible content height on FHD. Acceptance target: `<= 240px` at `1920x1080` after browser chrome is excluded by Playwright viewport.
3. Page title, description, and view-level actions must use a compact header. Prefer one row on FHD; wrap only below tablet widths.
4. Filter cards must use compact spacing:
   - card padding: `12-16px`;
   - grid gaps: `8-12px`;
   - input/select height: `32-36px`;
   - labels: `12-13px`;
   - no empty full-width rows unless content genuinely spans the full width.
5. For balances-like filters, expected FHD layout is two rows maximum: row 1 fields, row 2 remaining fields plus boolean toggle and action buttons.
6. Primary and reset buttons should be near the filters and visible within the 25% control-zone budget.
7. The table card must fill the remaining content height. Overflow belongs to `.wh-table-scroll`/table body, not to the entire page.
8. Sticky table headers are mandatory when the table scrolls vertically.

## 3. Shared Table Behavior Contract

1. All meaningful columns are sortable by clicking the header.
2. Sort state must be visible through an icon/indicator and accessible through `aria-sort`.
3. Sorting must be deterministic:
   - client-side only for already loaded complete datasets;
   - BFF/query-param based for paginated server datasets.
4. Pagination options are exactly `10`, `20`, `50`.
5. The table must provide loading, empty, error, and permission-denied states inside the table card.
6. The scroll container must preserve the page header, filters, table header, and pagination controls in predictable locations.
7. Date columns that display operation/business dates must use the user-facing format required by `Functional and WorkLogik.md`, not raw ISO, unless a screen-specific TZ says otherwise.

## 4. Balances Screen Acceptance Baseline

The balances screen is the first known violation and should be used as the reference fix.

Required user-visible outcome for `/balances/` after migration/fix:

- FHD content shows compact title/header, compact filters, and most of the remaining height as balances table.
- Distance from Django topbar bottom to the filter action buttons is `<= 25%` of the content viewport, target `<= 240px`.
- Search, item ID, site, page size, positive-only toggle, `Применить фильтры`, and `Сбросить` are visible without page scrolling on FHD.
- Page size options are `10`, `20`, `50` only.
- Clicking `ТМЦ`, `Склад`, `Количество`, or `Обновлено` sorts by that column and updates the visual sort indicator.
- The table body scrolls independently when rows exceed visible space; header remains sticky.
- Django shell topbar/sidebar stay visible and unchanged.

## 5. Implementation Levels

### Level 1 — Shared style primitives

Writable area: `Warehouse_frontend/src/styles/*`, Angular shared table/filter components if present.

Tasks:

- Add or adjust shared classes for compact page headers, compact filter cards, compact filter grids, inline boolean/actions row, table viewport, sticky headers, and sortable header controls.
- Keep class names under the `wh-` prefix.
- Do not introduce screen-local magic spacing that duplicates the shared primitives.

Acceptance:

- Existing Angular screens can opt into the layout without rewriting the Django shell.
- `npm run build` passes.

### Level 2 — Balances screen implementation

Writable areas:

- If Angular implementation exists or is created: `Warehouse_frontend/src/app/features/balances/**` and shared BFF client/models.
- If transitional SSR is fixed first: `Warehouse_web/templates/balances/list.html`, related Django view sorting/page-size handling, and tests.

Tasks:

- Apply the compact FHD layout.
- Implement sortable headers and deterministic sort contract.
- Restrict page sizes to `10`, `20`, `50`.
- Ensure table-body scrolling with sticky header.
- Keep browser data access through Django same-origin BFF; no direct SyncServer calls from Angular.

Acceptance:

- Balances screen meets the baseline in section 4.
- No SyncServer token is exposed to the browser.

### Level 3 — Extend contract to other Angular table screens

Writable areas by feature ownership, one feature at a time:

- operations journal;
- pending acceptance;
- unaccepted/lost assets;
- temporary items;
- catalog/nomenclature tables;
- future issued assets repository.

Tasks:

- Replace ad-hoc table/filter layout with shared primitives.
- Verify sortable headers and pagination choices per screen.
- Preserve each screen's domain permissions and action visibility.

Acceptance:

- Each touched screen has evidence for FHD compactness, sorting, pagination, sticky header, and no page-level table scrolling.

## 6. Parallelization Plan

Parallel execution recommended after Level 1 is merged.

Stage A must be sequential:

- One agent owns shared style primitives and any shared table/filter component contract.
- Reason: all feature screens depend on the same classes and must not create competing primitives.

Stage B may run in parallel by feature ownership:

| Unit | Writable area | Required input | Verification |
|---|---|---|---|
| Balances | `Warehouse_frontend/src/app/features/balances/**` or transitional `Warehouse_web/templates/balances/list.html` plus view/tests | Level 1 shared primitives | Build/tests, Playwright FHD screenshot, sort/pagination evidence |
| Operations | `Warehouse_frontend/src/app/features/operations/**` | Level 1 shared primitives, existing operations contracts | Build/tests, Playwright FHD scenario |
| Temporary items | `Warehouse_frontend/src/app/features/temporary-items/**` and/or SSR fallback only if explicitly assigned | Level 1 shared primitives, Functional section IV | Build/tests, Playwright or SSR smoke evidence |
| Catalog/nomenclature | `Warehouse_frontend/src/app/features/nomenclature/**` | Level 1 shared primitives, existing nomenclature TZ | Build/tests, component/UI evidence |

Integration checkpoint after Stage B:

- Parent/orchestrator runs `npm run build` in `Warehouse_frontend`.
- If Django files changed, run `python manage.py test` in `Warehouse_web`.
- Probe stand before real-stand checks; if unavailable, stop with the required blocker message.
- Run Playwright at FHD viewport for every touched business URL.

## 7. Test Strategy

### Static checks

- `Warehouse_frontend`: `npm run build`.
- If lint/type scripts exist later, run them too.
- `Warehouse_web` if Django files changed: Django system checks through `python manage.py test`.

### Unit tests

- Sort-state reducers/helpers, query-param mappers, pagination option validators.
- Date/quantity display mappers where changed.

### Component tests

- Angular component tests for sortable headers, page-size options, filter form layout state, loading/empty/error states.
- Django template/view tests only for transitional SSR fixes.

### Integration tests

- BFF/API tests using real Django test DB and mocked/fixture sync-client responses where appropriate.
- Sorting/pagination query parameters must be verified at the BFF/view boundary for server-side datasets.

### Real stand smoke tests

Runtime UI changes require the real stand unless user explicitly says to skip.

Stand:

- SyncServer API: `http://localhost:8000`, health `GET /api/v1/health`.
- Django: `http://localhost:8001`, health `GET /healthz/`.
- PostgreSQL via user-managed SSH tunnel: `localhost:5434`.

Environment variable names only:

- `DJANGO_ENV`
- `SYNC_SERVER_URL`
- `SYNC_ROOT_USER_TOKEN`
- `SYNC_DEVICE_TOKEN`
- `DATABASE_URL`
- `DJANGO_SETTINGS_MODULE`
- `SECRET_KEY`

Probe protocol:

1. Probe both health endpoints before smoke/UI tests.
2. If unavailable, stop and report: `Стенд не обнаружен. Подними стенд (Django :8001 + SyncServer :8000 + SSH-туннель :5434).`
3. Do not start the stand automatically.
4. If still unavailable, leave stand and UI checklist items unchecked with blocker `стенд недоступен`.

Smoke coverage:

- Open `/balances/` through Django.
- Confirm Django shell is visible.
- Confirm filters and actions are visible within FHD control-zone budget.
- Confirm table rows render from real BFF/stand data or known seed data.
- Confirm sort and pagination actions do not break the page.

### UI automation

Use Playwright for web scenarios.

Required assertions at `1920x1080` viewport for each touched table screen:

- Django topbar/sidebar visible.
- Filter action row bottom is within `25%` of content viewport height from topbar bottom, or `<= 240px` target for balances.
- Table body area height is greater than control-zone height.
- Table header remains visible after scrolling table body.
- Clicking each sortable header changes sort indicator and row order or request query.
- Page-size control offers only `10`, `20`, `50`.

### User scenarios

- Storekeeper opens balances, filters by search/site, sorts by quantity, switches page size, and scrolls table without losing header.
- Chief storekeeper/root sees the same layout while retaining allowed actions on screens where actions exist.

### Regression checks

- Authentication/login still routes to Django shell.
- Sidebar links still open business URLs.
- No direct `/api/v1/*` SyncServer request appears from the browser network log.
- Existing operations and nomenclature screens still build and render.

## 8. Evidence Required From Executors

Every completion report must include:

| Check | Command / Tool | Result | Evidence |
|---|---|---|---|
| Static build | `npm run build` | pass/fail/skipped | log path or short output |
| Django tests if touched | `python manage.py test` | pass/fail/skipped | log path or short output |
| Component/unit tests | project test command | pass/fail/skipped | affected tests |
| Stand smoke | health probes + browser/manual command | pass/fail/skipped | URL, seed note, screenshot/log |
| UI automation | Playwright | pass/fail/skipped | report path/screenshots |
| FHD measurement | Playwright bounding boxes or screenshot annotation | pass/fail/skipped | measured pixels/ratio |

## 9. Final Acceptance Criteria

- `Functional and WorkLogik.md` sections I.3 and VIII.2-4 are explicitly satisfied for every touched Angular table screen.
- Shared frontend architecture document links to this TZ and contains the FHD compact workspace contract.
- Balances no longer uses a vertically wasteful filter area in the accepted implementation path.
- Sorting by table header is implemented and verified.
- Pagination choices are `10`, `20`, `50`.
- Sticky table headers and table-body scrolling are verified at FHD.
- Real-stand and Playwright checks are either passed or left unchecked with the required blocker note.
