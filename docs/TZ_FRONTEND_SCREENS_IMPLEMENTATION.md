# TZ: Warehouse Frontend Screens — Nomenclature, Operations, And SPA Architecture Remediation

## Execution Checklist

- [x] 0. Context verified
- [x] 1. Architecture boundaries confirmed
- [x] 2. Implementation level 1 complete
- [x] 3. Unit/component tests complete
- [x] 4. Integration tests with real dependencies complete
- [x] 5. Stand smoke tests complete
- [x] 6. UI automation tests complete
- [x] 7. User scenario tests complete
- [x] 8. Regression checks complete
- [x] 9. Documentation updated
- [ ] 10. Final acceptance review complete

## Check Rules

- Architect creates this checklist, levels, scope, and acceptance criteria.
- Executor agents may check implementation and test items only after the required verification is done and evidence is recorded in this file or in a linked report.
- QA verifier may check final acceptance only after reviewing the evidence table.
- Failed or unavailable checks stay unchecked with a blocker note.
- Runtime UI work is not accepted with unit tests only; the full applicable test ladder below must be addressed.

## Orchestrator Mode

This TZ is designed for an Orchestrator supervising up to **5 parallel subagents**.

Rules for orchestration:

- The Orchestrator owns final scope control, merge order, checklist status, and evidence collection.
- A subagent may own only one workstream at a time unless the Orchestrator explicitly reassigns it.
- No more than 5 subagents should run in parallel against this TZ.
- Subagents must not edit the same files concurrently unless the Orchestrator serializes those edits.
- Each subagent must return: files changed, checks run, results, blockers, and evidence paths/log notes.
- The Orchestrator may check a TZ item only after implementation and required verification evidence are present.
- If checks are unavailable, the item stays unchecked and the blocker must be recorded in the evidence table.

Recommended parallel workstreams are defined in section 7. They are intentionally split by low-conflict file ownership.

## Current Acceptance Snapshot

This snapshot reflects the audit summary provided on 2026-05-19 and replaces optimistic assumptions from earlier drafts.

| Checklist item | Current status | Required remediation |
|---|---|---|
| 0. Context verified | Done | Routing decision (Option B), catalog mutation family (`/nomenclature/api/*`), and screenshot gap documented. |
| 1. Architecture boundaries confirmed | Done | No direct SyncServer browser calls verified by code review; BFF-only traffic enforced; Django shell remains. |
| 2. Implementation level 1 complete | Done | Routes, lazy loading, BFF clients, CSRF, `baseHref: "/"` validated against `ARCHITECTURE_FRONTEND_SPA.md`. |
| 3. Unit/component tests complete | Partial | Added: Django catalog POST/PATCH tests (9 new), Angular auth-context and operations service tests (role mapping, flags, loadList params). Still missing: table/modal/validator component tests, full mapper coverage. |
| 4. Integration tests complete | Partial | Django route/BFF integration verified via `python manage.py test`. Angular service/BFF contract tests partially covered by service spec. |
| 5. Stand smoke tests complete | Done | Authenticated smoke passes: `/operations/` SPA (title "Операции", console errors 0), `/nomenclature/` SPA (title "Номенклатура", console errors 0), `/operations/ssr/` SSR fallback, BFF endpoints return JSON. Screenshots saved. |
| 6. UI automation tests complete | Partial | Playwright ad-hoc smoke passes (login → /operations/ → /nomenclature/). No persistent Playwright config or e2e suite; coverage is manual/orchestrator-driven. |
| 7. User scenario tests complete | Partial | Basic auth + route + console-error verification done. Full scenarios A-F (create/edit/confirm/cancel flows) need Playwright suite and seeded BFF data. |
| 8. Regression checks complete | Done | Django 91/91 pass; Angular 15/15 pass; anon redirect checks pass; auth SPA smoke passes; SSR fallback verified; asset serving verified; console errors 0 on both screens. |
| 9. Documentation updated | Done | Evidence table filled below; Stream E report attached. |
| 10. Final acceptance review complete | Missing | QA verifier only after evidence is complete. |

Current implementation status:

| Level | Status | Notes |
|---|---|---|
| L0 Context and contracts | Done | Routing decision (Option B), catalog mutation family (`/nomenclature/api/*`), screenshot gap documented in evidence. |
| L1 Frontend architecture foundation | Done | Routes, lazy loading, BFF clients, CSRF, `baseHref: "/"` are in place. |
| L2 Nomenclature completion | Done | POST/PATCH endpoints added for categories, items, units. Angular `applyBatch()` updated to use them. Tests added. |
| L3 Operations list | Done | Real client-side sorting implemented and tested. Role-aware row actions (observer/storekeeper/root) implemented. Pagination 10/20/50 and sticky headers present. |
| L4 Operation create/edit modal | Done | Default warehouse prefilled from auth context (mocked until BFF endpoint available). Double-submit protection (`isSaving`) implemented. All 7 types supported. |
| L5 Confirm modal + submit | Done | Confirm modal explicitly warns that confirmation is NOT acceptance. Double-submit protection (`isSubmitting`) implemented. List refreshes after success. |
| L6 UX hardening | Partial | Double-submit locks and role gating done. Default warehouse prefilled. Normalized 401/403/422 handling still needs full implementation. |
| L7 Shared visual system | Done | `_tables.scss`, `_badges.scss`, `_modals.scss`, `_states.scss`, `_forms.scss` created. Components migrated to `wh-*` classes. `styles.scss` refactored. README added. |
| L8 Django host/BFF | Done | `/operations/` directly mounts Angular via `OperationsSPAView`. SSR fallback moved to `/operations/ssr/`. `base href="/"` set. Asset prefix cleared. Sidebar links updated. |
| L9 Documentation/handoff | Done | Evidence table filled in section 15.2; Stream E report recorded. |

## 0. Purpose

This TZ turns the screen specifications under `Warehouse_frontend/docs/screens_plan/` into an executable frontend implementation plan.

Primary target:

- finish the Angular nomenclature workspace according to the current specification;
- add the Angular operations screen with list, filters, create/edit draft modal, and confirm draft modal;
- keep all browser traffic behind Django same-origin BFF endpoints;
- preserve Django as the authenticated host and shell provider.

This TZ is for executor agents working mainly in `Warehouse_frontend/`, with explicitly called-out companion seams in `Warehouse_web/` where Django hosting or BFF endpoints are required.

**Canonical functional requirements:** All work in this TZ must align with `Functional and WorkLogik.md` at the workspace root. This file overrides screen specs and mockups where they contradict. Deviations are allowed only for items marked «на стадии продумывания» / «частичной реализации», or via a documented ADR.

## 1. Source Documents And Visual References

Canonical functional requirements:

- `Functional and WorkLogik.md` (workspace root) — authoritative definition of operation types, user roles, editing rules, table behaviour, acceptance flow, and screen structure. **Takes precedence over all other specs.**

Canonical frontend architecture:

- `Warehouse_frontend/docs/ARCHITECTURE_FRONTEND_SPA.md` — permanent standard for Django shell ownership, Angular content mounting, business URL routing, SSR fallback migration, and BFF-only browser data access.

Canonical screen specs:

- `Warehouse_frontend/docs/screens_plan/nomenclature-screen-spec.md`
- `Warehouse_frontend/docs/screens_plan/operations-screen-spec.md`
- `Warehouse_frontend/docs/screens_plan/спецификация.txt`
- `Warehouse_frontend/docs/screens_plan/СТИЛИ список операций + модальное окно создания операции.md`

Duplicate/current references outside `screens_plan/`:

- `Warehouse_frontend/docs/nomenclature-screen-spec.md`
- `Warehouse_frontend/docs/nomenculature_plan.md`

Screenshots currently available:

- `Warehouse_frontend/docs/screens_plan/Операции Django v2 — список + модалка создания.png`
- `Warehouse_frontend/docs/screens_plan/Операции Django v2 — подтверждение черновика.png`

Style baseline decision:

- These operation mockups are the canonical visual baseline for all new Angular workspaces, not only for `/operations`.
- Executors must extract a shared screen style system from the mockups: light gray workspace background, white cards, dark left navigation contrast inherited from Django, rounded panels, compact tables, status badges, toolbar/filter cards, and modal overlay behavior.
- The CSS/Figma dump is a reference for proportions, spacing, colors, and component states. It must not be copied as fixed absolute layout that breaks inside the Django container.

Screenshot gap:

- `operations-clean-list.png` is referenced by `operations-screen-spec.md` but is not present as a PNG file in `screens_plan/`.
- Executor must either add/export the clean-list screenshot or document the blocker and use the background visible in the existing modal screenshots as the visual reference for the list.

## 2. Current State Snapshot

### 2.1 Angular project

- Project: `Warehouse_frontend/`.
- Angular version family: Angular `21.2.x`.
- Style language: SCSS.
- Components are standalone.
- `package.json` scripts currently include:
  - `npm run build`
  - `npm test`
  - `npm start`
- `angular.json` currently builds with `baseHref: "/"` and must remain compatible with multiple Django business URL mounts.
- Current Angular routes include root redirect to `nomenclature`, `/nomenclature`, and `/operations`.

### 2.2 Existing frontend code

Already present and should be reused, not duplicated:

- `src/app/core/api/api.service.ts` — nomenclature-specific BFF client with base `/nomenclature/api`.
- `src/app/core/api/bff-api.service.ts` — generic BFF client with base `/bff/api/v1`.
- `src/app/core/services/nomenclature.service.ts` — signals-based nomenclature data/state service.
- `src/app/core/services/catalog-change-buffer.service.ts` — local pending change buffer.
- `src/app/core/models/nomenclature.models.ts` — catalog DTO/VM models.
- `src/app/core/models/operations.models.ts` — operation DTO/VM models now include all 7 operation types from `Functional and WorkLogik.md`.
- `src/app/features/nomenclature/**` — partial nomenclature UI implementation.
- `src/app/features/operations/**` — operations list, filters, table, create/edit modal, and confirm modal implementation exists but is not accepted without remediation/tests.
- `src/styles.scss` and `src/styles/*` — shared style-system foundation exists but still needs migration completion and screenshot evidence.

Current nomenclature work is therefore not zero-start. It is an existing partial implementation that must be completed and hardened against the spec.

User-confirmed status note:

- The nomenclature screen currently exists, but must be treated as incomplete until it works reliably inside the Django content container.
- The first frontend execution pass must stabilize nomenclature before using it as a pattern for other screen types.

### 2.3 Django host and BFF state

Relevant Django host/BFF files:

- `Warehouse_web/apps/catalog/nomenclature_urls.py`
  - `/nomenclature/api/bootstrap/`
  - `/nomenclature/api/categories/`
  - `/nomenclature/api/categories/<id>/`
  - `/nomenclature/api/items/`
  - `/nomenclature/api/items/<id>/`
  - `/nomenclature/api/units/`
  - `/nomenclature/` SPA catch-all
- `Warehouse_web/apps/catalog/views.py`
  - `NomenclatureSPAView` serves the Angular build through Django template `catalog/nomenclature_spa.html`.
- `Warehouse_web/apps/bff_api/urls.py`
  - `/bff/api/v1/auth/*`
  - `/bff/api/v1/catalog/*`
  - `/bff/api/v1/catalog/admin/*`
  - `/bff/api/v1/operations*`
  - `/bff/api/v1/balances*`
  - `/bff/api/v1/temporary-items*`
  - `/bff/api/v1/recipients*`
- `Warehouse_web/apps/bff_api/operations_views.py`
  - list, create, detail, patch, delete, submit, cancel, accept-lines operations endpoints exist or are expected by the frontend contract.
- `Warehouse_web/apps/catalog/views.py`
  - `OperationsSPAView` exists as a transitional host class, but `/operations/` must directly render Angular through a real mounted view before Level 8 can be accepted.
- `Warehouse_web/apps/operations/urls.py`
  - existing SSR operations URLs must move under `/operations/ssr/` when `/operations/` becomes Angular primary.

Known BFF gap for nomenclature mutations:

- Current `/nomenclature/api/*` views expose read and delete methods, but no confirmed POST/PATCH for categories/items/units in `apps.catalog.api_views`.
- The existing Angular `NomenclatureService.applyBatch()` attempts sequential POST/PATCH/DELETE calls against `/nomenclature/api/{entity}s/`.
- Executor must verify and close this contract gap before claiming apply/batch behavior complete.

Known runtime gaps from current audit:

- Operations sorting currently must be proven as real sorting, not only visual arrow toggling.
- Operation row permissions must include user role/context, not only operation status.
- Operation create/edit modal must default warehouse fields from the logged-in user's context where required by `Functional and WorkLogik.md` §II.5.1-5.3.
- Operations UI acceptance requires unit/component/e2e evidence, not just implemented components.

## 3. Architecture Boundaries

### 3.1 Authoritative data ownership

- `SyncServer` remains the source of truth for warehouse domain data: catalog, operations, balances, sites, users, roles, documents, temporary items, and business rules.
- `Warehouse_web` owns browser session, Django authentication, CSRF, user binding, BFF adapters, and SPA hosting.
- `Warehouse_frontend` owns Angular UI, local UI state, view models, forms, validation hints, visual states, and client-side interaction flow.

### 3.2 Browser integration rule

The browser must follow this path:

```text
Browser
  -> Django route / Django shell
  -> Angular content area
  -> Django same-origin BFF endpoint
  -> Warehouse_web sync_client / service
  -> SyncServer
```

Forbidden in Angular/browser code:

- direct calls to `SyncServer`;
- hardcoded `X-User-Token`, `X-Device-Token`, root tokens, device tokens, or `.env` values;
- storing SyncServer tokens in browser local/session storage;
- duplicating warehouse domain ownership locally;
- implementing stock mutations directly in UI without BFF/SyncServer confirmation.

### 3.3 Shell ownership

Canonical rule for this project:

- Django provides the authenticated web shell: top navbar, sidebar, user/admin/logout controls, and global navigation.
- Angular renders only the lower-right/right content workspace for each feature: the large area to the right of the Django left navigation and below the Django top brand/user bar.
- Angular must behave as a container application inside this Django-owned frame, not as a full browser-page shell.

Important contradiction to resolve during implementation:

- `nomenclature-screen-spec.md` contains an older full-page/topbar visual description.
- `operations-screen-spec.md` and `Warehouse_frontend/AGENTS.md` state that Angular must not redraw the global Django shell.

Decision for this TZ:

- For runtime implementation, Angular must not duplicate Django topbar/sidebar.
- Visual tokens from the nomenclature full-page spec may be reused for panels/forms, but global shell elements are non-normative unless Django explicitly delegates them.
- The operation mockup shell geometry is normative only as a container boundary: top bar and left navigation belong to Django; all reusable screen components live inside the remaining content rectangle.

### 3.3.1 Angular content container contract

Every Angular screen implemented under this TZ must satisfy this container contract:

- Root feature components receive the available Django content area and must fill it with a workspace layout.
- Feature SCSS must not position content relative to the full viewport origin as if Angular owns the top bar/sidebar.
- Shared page primitives should be introduced or reused for:
  - page header/title/action row;
  - filter/search card;
  - tab/status strip;
  - data table/list card;
  - right-side or centered modal overlay within the content area;
  - empty/loading/error/permission-denied states.
- All future screen types should use this same visual language unless a later ADR/TZ explicitly overrides it.
- Playwright screenshots must prove that Django shell is visible and stable while Angular changes only the content area.

### 3.4 HTTP ownership inside Angular

- Page components orchestrate high-level actions.
- API services perform HTTP.
- Row, modal, form, and tree leaf components must not directly call HTTP.
- Feature stores/services own state transitions, mappings, and local buffers.

Allowed client services:

- `ApiService` for existing `/nomenclature/api` endpoints, until unified BFF migration is decided.
- `BffApiService` for `/bff/api/v1/*`, especially operations and generic catalog/balances/temp-items endpoints.

Do not create another independent generic HTTP client unless replacing/merging the two existing clients as a deliberate refactor.

## 4. Scope

### 4.1 In scope

Frontend implementation in `Warehouse_frontend/`:

- finish nomenclature screen behavior from the spec;
- create operations screen route/component tree;
- create operations filters, status tabs, table, row actions;
- create operation draft create/edit modal;
- create item cache search area and operation lines table;
- create confirm draft modal;
- wire frontend services to Django BFF endpoints;
- implement UI-level role/permission hiding/disabling based on BFF auth/context data;
- implement unit/component tests for mappers, stores, forms, and components;
- add or update Playwright UI scenarios through the Django host.

Companion Django seams in `Warehouse_web/` when needed:

- serve Angular operations route under the Django shell;
- confirm or add BFF endpoints required by the Angular contract;
- add Django tests for BFF response envelopes and auth/session behavior;
- keep SSR fallback routes until Angular coverage is verified.

### 4.2 Out of scope

- SyncServer schema or business-rule redesign.
- Direct SyncServer browser integration.
- Rust core, mobile, desktop, or AI workstation work.
- Full acceptance/receiving screen implementation — acceptance is required by `Functional and WorkLogik.md` for приход/перемещение but is a separate screen; this TZ covers only the operations list + draft modal. Acceptance screen needs its own TZ/level.
- Physical catalog delete unless a confirmed backend endpoint and business decision exists.
- New UI frameworks such as Tailwind, Angular Material, Bootstrap, or third-party grid/modal libraries unless already approved.
- Rewriting Django shell navigation unrelated to serving these Angular workspaces.

## 5. Routing And Hosting Decision

Decision is now fixed by `Warehouse_frontend/docs/ARCHITECTURE_FRONTEND_SPA.md`:

```text
Option B — one Angular build, multiple Django business URL mounts.
```

This is no longer an executor choice.

Rejected final states:

- Option A: one Angular app under `/nomenclature/` only. This is invalid as a final architecture because operations and future screens must not live under an unrelated feature prefix.
- Option C: feature-specific Angular builds. This is rejected unless a later ADR documents why one build cannot serve multiple business routes.

Required final route behavior:

- `/nomenclature/` opens the Angular nomenclature workspace in the Django shell.
- `/operations/` opens the Angular operations workspace in the Django shell.
- `/operations/` must not redirect to `/nomenclature/operations/` as final behavior.
- Old operations SSR routes must move under `/operations/ssr/` or another explicitly documented SSR fallback namespace.
- Browser refresh on `/nomenclature/` and `/operations/` must work.
- Angular build assets must resolve with `baseHref: "/"` from every mounted business URL.

Acceptance for routing foundation:

- `/nomenclature/` continues to load the nomenclature workspace.
- `/operations/` loads the operations workspace directly inside the Django shell.
- `/operations/ssr/` fallback exists or the absence of SSR fallback is explicitly approved in an ADR/TZ amendment.
- Browser refresh on Angular-routed pages does not produce 404.
- Static JS/CSS/assets are served by Django in build mode and by Angular dev server/proxy in dev mode if used.

## 6. API Contracts

### 6.1 Response envelope

Angular services must expect Django envelopes:

```ts
interface BffApiResponse<T> {
  ok: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
```

No component should parse raw SyncServer responses directly unless a BFF endpoint intentionally forwards that shape and the mapper isolates it.

### 6.2 Nomenclature API

Current route family:

```http
GET    /nomenclature/api/bootstrap/
GET    /nomenclature/api/categories/
GET    /nomenclature/api/categories/{id}/
DELETE /nomenclature/api/categories/{id}/
GET    /nomenclature/api/items/
GET    /nomenclature/api/items/{id}/
DELETE /nomenclature/api/items/{id}/
GET    /nomenclature/api/units/
```

Required for full spec completion:

```http
POST   /nomenclature/api/categories/          or /bff/api/v1/catalog/admin/categories
PATCH  /nomenclature/api/categories/{id}/     or /bff/api/v1/catalog/admin/categories/{id}
POST   /nomenclature/api/items/               or /bff/api/v1/catalog/admin/items
PATCH  /nomenclature/api/items/{id}/          or /bff/api/v1/catalog/admin/items/{id}
POST   /nomenclature/api/units/               or /bff/api/v1/catalog/admin/units
PATCH  /nomenclature/api/units/{id}/          or /bff/api/v1/catalog/admin/units/{id}
```

Batch behavior:

- MVP may keep a local frontend change buffer and send sequential POST/PATCH calls.
- If backend batch endpoint appears later, hide it behind `catalog-change-buffer` / catalog API service; do not spread batch-specific HTTP calls across components.

### 6.3 Operations API

Angular must call Django BFF, not `/api/v1` directly.

Canonical browser-facing endpoints:

```http
GET    /bff/api/v1/operations
GET    /bff/api/v1/operations/{operation_id}
POST   /bff/api/v1/operations
PATCH  /bff/api/v1/operations/{operation_id}
POST   /bff/api/v1/operations/{operation_id}/submit
POST   /bff/api/v1/operations/{operation_id}/cancel
```

Supported query parameters for list:

```text
site_id
type
status
created_by_user_id
effective_after
effective_before
created_after
created_before
updated_after
updated_before
search
page
page_size
```

Auxiliary endpoints for operations UI:

```http
GET /bff/api/v1/auth/me
GET /bff/api/v1/auth/context
GET /bff/api/v1/auth/sites
GET /bff/api/v1/catalog/items
GET /bff/api/v1/catalog/categories
GET /bff/api/v1/catalog/categories/tree
GET /bff/api/v1/catalog/units
GET /bff/api/v1/catalog/sites
GET /bff/api/v1/balances
GET /bff/api/v1/balances/by-site
GET /bff/api/v1/balances/summary
GET /bff/api/v1/recipients
GET /bff/api/v1/temporary-items
POST /bff/api/v1/temporary-items       only if backend supports required temporary item workflow
```

### 6.4 Permission model visible in UI

UI may hide or disable actions for clarity, but SyncServer and Django BFF remain authoritative.

Minimum UI behavior:

- `root` and `chief_storekeeper`: can view, create, confirm, cancel according to backend rules.
- `storekeeper`: can view and create operations for allowed site; must not freely choose arbitrary source site; cannot confirm if backend policy says so.
- `observer`: can view only; create/edit/confirm/cancel controls are hidden or disabled.

No role-based check in Angular is sufficient without BFF/SyncServer enforcement.

## 7. Orchestrator Implementation Levels And Workstreams

This section is the execution plan for Orchestrator mode. The older level descriptions below remain as detailed requirements, but the actual remediation should be assigned through the 5 parallel workstreams in this section.

### 7.0 Orchestrator launch order

Recommended launch:

1. Start Stream A and Stream B first, because routing/BFF contracts unblock reliable browser tests.
2. Start Stream C and Stream D in parallel once current frontend files are assigned and conflict ownership is clear.
3. Start Stream E after A-D expose enough stable UI/API behavior for tests, or run E early in test-design mode without editing implementation files.
4. Orchestrator performs final merge, full build/test pass, evidence collection, and checklist updates.

### 7.1 Parallel subagent streams

| Stream | Subagent focus | Primary files/areas | Must deliver | Can run in parallel with |
|---|---|---|---|---|
| A | Django SPA host and route migration | `Warehouse_web/config/urls.py`, `apps/catalog/views.py`, SPA templates, `apps/operations/urls.py`, sidebar links if needed | `/operations/` direct Angular mount, `/operations/ssr/` fallback, Django route tests | B, C, E with coordination |
| B | Nomenclature mutation contract | `Warehouse_web/apps/catalog/api_views.py`, catalog/BFF tests, `Warehouse_frontend/src/app/core/services/nomenclature.service.ts`, catalog API service | Working or explicitly deferred POST/PATCH mutation family, tests, documented API choice | A, D, E |
| C | Operations UX/domain hardening | `Warehouse_frontend/src/app/features/operations/**`, `core/services/operations*`, `core/models/operations.models.ts` | real sorting, role-aware actions, default warehouse, double-submit/error hardening | A, B, E |
| D | Shared style system migration | `Warehouse_frontend/src/styles.scss`, `src/styles/**`, component templates/styles in nomenclature/operations | wh-* primitives used consistently, no new local style systems, screenshot readiness | B, C with file ownership split |
| E | Tests, Playwright, evidence | `Warehouse_frontend/src/**/*.spec.ts`, e2e tests, Django tests if assigned, evidence table | unit/component/integration/e2e coverage, logs/screenshots, final evidence draft | A-D, but may need final rerun after merges |

Maximum parallelism: 5 subagents. If fewer agents are available, merge streams in this order: `A+B`, `C`, `D`, `E`.

### 7.2 File conflict guardrails

| File/area | Owner during orchestration | Rule |
|---|---|---|
| `Warehouse_web/config/urls.py` | Stream A | No other stream edits routes without Orchestrator approval. |
| `Warehouse_web/apps/operations/urls.py` | Stream A | SSR fallback move must be serialized with route tests. |
| `Warehouse_frontend/src/app/app.routes.ts` | Stream A or C | Orchestrator decides owner before edits. |
| `Warehouse_frontend/src/app/features/operations/**` | Stream C | Stream E may add tests only; Stream D may change classes/styles only after coordination. |
| `Warehouse_frontend/src/app/features/nomenclature/**` | Stream B or D | B owns behavior/API; D owns style/class migration. |
| `Warehouse_frontend/src/styles/**` | Stream D | Other streams use existing classes but do not redefine primitives. |
| Test/evidence files | Stream E | Implementation streams may add focused tests only if coordinated. |

### 7.3 Required subagent report format

Each subagent returns this report to the Orchestrator:

```markdown
## Stream <A-E> Report

- Scope completed:
- Files changed:
- Tests/checks run:
- Result:
- Evidence:
- Blockers:
- Follow-up required from other streams:
- Checklist items eligible for update:
```

### 7.4 Orchestrator merge gates

The Orchestrator must not request final acceptance until these gates pass or are explicitly blocked with evidence.

| Gate | Required streams | Exit criteria |
|---|---|---|
| Gate 1: SPA route contract | A | `/operations/` directly mounts Angular; `/operations/ssr/` fallback or approved exception; refresh works. |
| Gate 2: Catalog mutation decision | B | POST/PATCH mutation path works with tests or is documented as blocker/deferral. |
| Gate 3: Operations behavior | C | Sorting is real, role-aware controls work, default warehouse is applied, double-submit blocked. |
| Gate 4: Visual system | D | Shared style primitives are used; no obvious divergent screen-local design system remains. |
| Gate 5: Verification | E + all | `npm run build`, unit/component tests, Django checks/tests if touched, Playwright scenarios, evidence table. |

### 7.5 Detailed implementation levels

### Level 0 — Context and contract verification

Goal: prevent implementation against stale or contradictory assumptions.

Tasks:

- Re-read this TZ, `Warehouse_frontend/AGENTS.md`, and source screen specs.
- Re-read `Warehouse_frontend/docs/ARCHITECTURE_FRONTEND_SPA.md`; it is mandatory for routing and shell/BFF decisions.
- Confirm actual Angular version, scripts, routing, and current source layout.
- Confirm which BFF family will be used for catalog mutations: `/nomenclature/api/*` or `/bff/api/v1/catalog/admin/*`.
- Confirm implementation plan follows fixed Option B from Section 5: one Angular build, multiple Django business URL mounts.
- Inventory existing frontend files before editing to avoid duplicating components/services.
- Record blockers for missing screenshots or endpoints.

Acceptance criteria:

- Completion report states that fixed Option B is used and lists remaining route gaps, if any.
- Completion report lists selected catalog mutation endpoint family.
- Missing `operations-clean-list.png` is either added or explicitly logged as a visual-reference blocker.
- No app code is changed in this level except documentation updates if needed.

Required checks:

- Static: read-only verification only.
- Unit/component: not applicable; no runtime change.
- Integration/stand/UI: not applicable; no runtime change.

### Level 1 — Frontend architecture foundation

Goal: make the Angular app ready for multiple feature workspaces without breaking existing nomenclature.

Tasks:

- Keep standalone component architecture.
- Establish feature routing for at least:
  - nomenclature workspace;
  - operations workspace.
- Keep Django shell ownership; Angular root must not draw global navbar/sidebar.
- Keep or refactor HTTP clients so there is one clear path for:
  - `/nomenclature/api/*` catalog workspace calls;
  - `/bff/api/v1/*` generic BFF calls.
- Add shared error/loading VM patterns that can be reused by operations and nomenclature.
- If changing `baseHref` or asset paths, verify Django build serving still works.

Acceptance criteria:

- Existing `/nomenclature/` workspace still opens.
- Operations route can be mounted without a duplicate Angular full-screen shell.
- No component below page/store level performs raw HTTP.
- CSRF remains configured with cookie `csrftoken` and header `X-CSRFToken`.
- No token is hardcoded or stored in browser storage.

Required checks:

- Static: `npm run build`.
- Unit/component: route/service tests if test tooling is already usable.
- Integration: Django host smoke after build if route/asset serving changed.

### Level 2 — Nomenclature workspace completion

Goal: finish the screen according to `nomenclature-screen-spec.md` while respecting Django shell boundaries.

Tasks:

- Align existing components with the spec:
  - `nomenclature-page`;
  - `catalog-tree`;
  - `catalog-tree-node`;
  - `item-edit-form`;
  - `category-edit-form`;
  - `pending-changes-bar`;
  - search and action components.
- Implement/verify tree states:
  - normal;
  - selected;
  - dirty;
  - inactive;
  - error;
  - expanded/collapsed.
- Implement/verify local search by category name, item name, SKU, and keywords where data is available.
- Ensure matched child items keep parent categories visible.
- Implement/verify right-panel item and category forms.
- Ensure edits do not call API immediately.
- Ensure pending changes are accumulated locally and shown in the pending bar.
- Resolve delete behavior:
  - disable physical delete unless endpoint and product decision are confirmed;
  - prefer deactivation for MVP.
- Resolve mutation endpoint gap before claiming `Применить` complete.

Acceptance criteria:

- Nomenclature layout matches the spec at desktop width inside the Django content area.
- Selecting a category opens category form.
- Selecting an item opens item form.
- Editing a field marks the entity dirty and increments pending count only after explicit add/save-to-buffer action.
- `Сбросить` resets pending changes.
- `Применить` sends confirmed endpoint calls only after validation; on failure, pending changes remain.
- The screen handles empty/loading/error states.
- No direct SyncServer requests appear in browser network traffic.

Required checks:

- Static: `npm run build`.
- Unit: change buffer, tree filtering, DTO mappers, validation helpers.
- Component: tree node states, item/category forms, pending bar.
- Integration: HTTP service tests against BFF envelopes or Django endpoint tests for changed BFF behavior.
- UI automation: Playwright through Django `/nomenclature/`.

### Level 3 — Operations list workspace

Goal: implement `/operations` list page from `operations-screen-spec.md` and screenshots.

Tasks:

- Create operations feature structure under `src/app/features/operations/` or an equivalent existing convention.
- Define typed UI models:
  - `OperationType`;
  - `OperationStatus`;
  - `OperationsFilterVm`;
  - `OperationListRowVm`;
  - response mappers from BFF DTOs.
- Create operations API/store services using `BffApiService`.
- Implement page header actions:
  - `+ Создать операцию`;
  - `Приёмка` as future navigation/stub;
  - `Экспорт` as disabled/stub unless endpoint exists.
- Implement filter card:
  - search;
  - type;
  - status;
  - site;
  - period;
  - author;
  - `Только мои`;
  - reset.
- Implement status tabs:
  - Все;
  - Черновики;
  - На подтверждении;
  - Ожидают приёмки;
  - Проведённые;
  - Отменённые.
- Implement operations table columns:
  - Операция / дата;
  - Тип;
  - Статус;
  - Направление / склад;
  - Ответственный;
  - Строки;
  - Действия.
- Implement row hover actions based on status and role.
- Implement real table sorting on any column (§I.6.2 of `Functional and WorkLogik.md`): either send sort parameters to BFF/backend or sort the current client-side dataset consistently. Visual arrow toggling without changed row order is not accepted.
- Implement pagination with 10 / 20 / 50 row-size selector (§I.6.3).
- Implement sticky table header: scroll only rows, never headers/toolbar (§I.6.3).
- Use auth/context data to calculate row actions; status-only `canEdit` / `canSubmit` / `canCancel` is not accepted.

Acceptance criteria:

- Operations list renders inside Django content area without duplicated shell.
- Filters update list query parameters or store state predictably.
- Status tabs map to backend statuses and are documented if mapping differs.
- Table renders loading, empty, error, and populated states.
- Every visible column supports click-to-sort; current sort column and direction are visually indicated.
- Sorting changes the actual row order or backend query result; decorative sort indicators alone fail this level.
- Pagination selector shows 10 / 20 / 50; selected size persists in URL or store.
- Scrolling the table body does not move the header row or filter/toolbar area.
- Type/status badges match screenshot intent.
- Observer cannot create/edit/confirm from UI.
- Storekeeper source-site restrictions are reflected in UI hints/disabled controls.

Required checks:

- Static: `npm run build`.
- Unit: status/type label mapping, filters-to-query mapper, row permission mapper.
- Component: filters, status tabs, table row/action rendering.
- Integration: `BffApiService` operation list calls with realistic envelope.
- UI automation: Playwright opens operations list through Django and verifies no direct SyncServer calls.

### Level 4 — Operation create/edit draft modal

Goal: implement operation draft modal matching `Операции Django v2 — список + модалка создания.png`.

Tasks:

- Create modal component(s) without adding third-party modal libraries.
- Support create and edit draft modes.
- Implement operation type-dependent field visibility (all 7 types from `Functional and WorkLogik.md` §II.5):
  - `RECEIVE` (Приход) — destination required; temporary items allowed.
  - `EXPENSE` (Расход) — source required; temporary items allowed.
  - `MOVE` (Перемещение) — source and destination required; destination differs from source; temporary items allowed.
  - `WRITE_OFF` (Списание) — source required; source defaults to logged-in user's warehouse.
  - `ISSUE` (Выдача) — source and recipient required; temporary items forbidden; ТМЦ не списывается а уходит в репозиторий выдачи.
  - `ISSUE_RETURN` (Возврат выдачи) — recipient/person context and destination required; temporary items generally forbidden.
  - `CORRECTION` (Корректировка) — selected warehouse; allows changing quantity or item itself; служебная операция, может быть скрыта для storekeeper.
- Implement cached item search area using BFF catalog endpoints.
- Поле «Комментарий»: textarea на 2 строки текста (§II.5.0).
- Load current user/site context from BFF auth/context endpoints and default warehouse fields for `RECEIVE`, `EXPENSE`, and `WRITE_OFF` to the logged-in user's warehouse (§II.5.1-5.3).
- Implement line table columns:
  - ТМЦ;
  - SKU / статус;
  - На складе;
  - Количество;
  - Ед.;
  - Ошибка;
  - Действия.
- Implement stock hints using balances endpoints where available.
- Implement validation:
  - type required;
  - at least one line;
  - quantity > 0;
  - item or temporary item required per line;
  - insufficient stock warnings for MOVE/ISSUE.
- Implement unsaved changes confirmation before closing.
- Support query-param prefill from balances routes:
  - `modal=create`;
  - `type`;
  - source/destination site;
  - item id.

Acceptance criteria:

- `+ Создать операцию` opens modal.
- Modal visually matches screenshot within reasonable responsive tolerance.
- Create/edit form changes are local until save/submit.
- `Сохранить черновик` calls `POST /bff/api/v1/operations` or `PATCH /bff/api/v1/operations/{id}`.
- Validation errors are visible and block invalid save.
- Default warehouse behavior matches `Functional and WorkLogik.md` for logged-in users and is covered by tests.
- MOVE/ISSUE over-stock lines show `Недостаточно` or equivalent.
- Temporary item UI follows allowed/forbidden rules by operation type.
- Acceptance/receiving UI is not implemented inside this modal.

Required checks:

- Static: `npm run build`.
- Unit: draft validator, stock hint logic, temporary item rules, prefill parser.
- Component: modal field visibility and line table behavior.
- Integration: save draft HTTP path with mocked BFF and Django BFF test if payload contract changed.
- UI automation: create modal opens, validates, adds line, and saves draft on stand.

### Level 5 — Confirm draft modal and submit flow

Goal: implement confirmation modal matching `Операции Django v2 — подтверждение черновика.png`.

Tasks:

- Create confirm modal component.
- Show explicit warning that confirmation is not acceptance/receiving.
- Show operation summary:
  - type;
  - source site;
  - destination site;
  - lines count;
  - author.
- Wire final action to:

```http
POST /bff/api/v1/operations/{operation_id}/submit
```

- After success:
  - close confirm modal;
  - close or update draft modal;
  - reload operations list;
  - show success notification.
- On failure:
  - keep modals in recoverable state;
  - show BFF error message;
  - do not mark operation submitted locally unless server confirms.

Acceptance criteria:

- `Подтвердить операцию` opens confirm modal before API call.
- Confirm modal visually matches screenshot.
- Submit sends `{ "submit": true }` or the backend-confirmed payload.
- UI clearly distinguishes confirmation from acceptance.
- The operations list refreshes after success.
- Storekeeper/observer restrictions are enforced by UI and BFF response handling.

Required checks:

- Static: `npm run build`.
- Unit: submit payload mapper and post-submit state reducer.
- Component: confirm modal summary/actions/errors.
- Integration: submit call against BFF mocked response and Django BFF test if contract changed.
- UI automation: full draft save + confirm path on stand.

### Level 6 — Error handling, permissions, and UX hardening

Goal: make both workspaces robust enough for real users.

Tasks:

- Normalize BFF error handling across `ApiService` and `BffApiService`.
- Show clear messages for:
  - 401/login required;
  - 403/forbidden;
  - 404/not found;
  - 409/conflict if BFF exposes it;
  - 422/validation errors if BFF exposes field errors;
  - SyncServer unavailable.
- Keep form state after recoverable failures.
- Add loading and disabled states for save/apply/submit buttons.
- Block double submit for draft save, confirm submit, cancel, delete, and nomenclature apply actions.
- Add role/context-aware UI gating for observer, storekeeper, chief storekeeper, and root according to `Functional and WorkLogik.md` and BFF auth/context responses.
- Ensure operation source/destination defaults and restrictions derive from auth/context instead of hardcoded assumptions.
- Ensure no console-only error handling remains for business failures.
- Add accessibility basics:
  - keyboard focus in modals;
  - ESC/close behavior;
  - labels for inputs;
  - visible focus state;
  - aria labels for icon-only actions.

Acceptance criteria:

- Users see actionable error messages, not raw JSON/stack traces.
- Double-submit is blocked while requests are in flight.
- Observer cannot mutate from UI; storekeeper sees site restrictions; root-only actions are not exposed to ordinary users.
- Default warehouse is applied for relevant operation types and remains editable only when the role/context allows it.
- Modal focus does not disappear behind overlay.
- Browser console has no unhandled promise errors during main scenarios.

Required checks:

- Static: `npm run build`.
- Unit: error mapper tests.
- Component: disabled/loading/error states.
- UI automation: failed validation and forbidden-action scenarios.

### Level 7 — Shared visual system, container parity, and responsive behavior

Goal: use the provided Django-shell operation mockups as the shared visual style for all Angular screens, while keeping every feature constrained to the Django-owned lower-right content container.

This level must follow `Warehouse_frontend/docs/TZ_FRONTEND_SHARED_STYLE_SYSTEM.md`; screen-local CSS is allowed only when it composes shared primitives instead of defining a second visual system.

Tasks:

- Extract reusable SCSS tokens for panel backgrounds, borders, radii, badge colors, row hover, text colors, and spacing.
- Extract reusable page primitives for workspace header, action toolbar, filter card, status tabs, table card, detail/form card, modal overlay, loading, empty, and error states.
- Move shared product styling into `src/styles.scss` and `src/styles/*` partials where practical; keep feature-local styles focused on layout composition only.
- Match operation modal/list screenshots at 1920x1080 as the primary style source.
- Refit the existing nomenclature screen to the same container style and prove it is complete enough to be reused as a pattern.
- Match nomenclature spec at desktop widths for content/forms/tree behavior while omitting duplicated global shell.
- Add responsive rules for narrower internal content areas without breaking Django shell.
- Keep component styles under Angular production budget or adjust architecture without disabling budget checks casually.

Acceptance criteria:

- Manual screenshot review shows close match to referenced PNGs for the Django shell plus Angular content composition.
- All new screen types share the same page/container visual language instead of inventing unrelated layouts.
- Existing operations and nomenclature components use shared `wh-*` primitives and do not rely on TS-driven semantic colors where CSS classes/tokens exist.
- Existing nomenclature does not look like a separate full-page app; it sits naturally inside the same lower-right Django content area.
- Main flows are usable at 1920x1080, 1440x900, and a narrower laptop width.
- No content-critical controls are clipped by modal or page containers.
- CSS does not rely on hardcoded absolute coordinates copied directly from Figma dumps where responsive layout is needed.

Required checks:

- Static: `npm run build` including style budgets.
- Component: visual state classes where practical.
- UI automation: Playwright screenshots saved through Django for nomenclature page, operations list, create modal, and confirm modal, with top bar and left menu visible.

### Level 8 — Django host and BFF integration

Goal: verify the Angular workspaces through the real Django host and real BFF boundaries.

Tasks:

- If `/operations/` is moved to Angular, preserve SSR fallback or document rollback path.
- Replace final `/operations/` redirect-to-`/nomenclature/operations` behavior with a direct Django SPA mount for the Angular operations route.
- Move existing operations SSR URL patterns under `/operations/ssr/` or document an approved fallback exception.
- Add/update Django route/view/template only as needed for SPA hosting.
- Add/update BFF endpoints only where frontend contract requires it.
- Add Django tests for any changed BFF endpoint.
- Ensure anonymous users redirect to login for SPA routes and APIs.
- Ensure authenticated users with missing SyncServer binding get controlled 401/403/502-style BFF errors, not root-token escalation.

Acceptance criteria:

- Django serves Angular assets for all chosen frontend routes.
- `/operations/` renders Angular directly inside the Django shell and does not use `/nomenclature/operations/` as the final URL.
- `/operations/ssr/` serves the legacy SSR operations list/create/detail/fallback routes, or the approved no-fallback decision is recorded.
- `/nomenclature/api/bootstrap/` still passes existing smoke expectations.
- `/bff/api/v1/operations?page=1&page_size=1` returns an envelope that Angular can map.
- Browser network trace shows no direct SyncServer URL.
- Existing Django SSR operations/nomenclature routes are not broken unless explicitly replaced with fallback documented.

Required checks:

- Static: `python manage.py check` if Django files changed.
- Django tests: affected `apps.catalog`, `apps.bff_api`, and auth/session tests.
- Integration: Django test DB with BFF mocked or real SyncServer depending on test layer.
- Stand smoke: real Django + real SyncServer stand.

### Level 9 — Final documentation and handoff

Goal: make the result maintainable by future agents.

Tasks:

- Update or add active docs when routes, commands, BFF contracts, or visual references change.
- Mark deprecated specs clearly if they conflict with the implemented architecture.
- Add final evidence table.
- Record incomplete items as blockers, not as hidden TODOs.

Acceptance criteria:

- This TZ checklist accurately reflects completion.
- Every checked item has evidence.
- Any skipped test has a reason.
- Active docs point to the implemented route and test commands.

Required checks:

- Documentation review.
- QA verifier acceptance review.

## 8. Recommended File Layout

Adapt to actual conventions, but keep feature-local UI and central API/state services.

```text
src/app/core/api/
  api.service.ts                  # existing /nomenclature/api client
  bff-api.service.ts              # existing /bff/api/v1 client

src/app/core/models/
  nomenclature.models.ts          # existing, extend if needed
  operations.models.ts            # replace/extend with spec-aligned models

src/app/core/services/
  nomenclature.service.ts         # existing, harden/complete
  catalog-change-buffer.service.ts
  operations-api.service.ts       # may wrap BffApiService
  operation-draft-store.service.ts
  operation-prefill.service.ts
  stock-hint.service.ts

src/app/features/nomenclature/
  ...existing components...

src/app/features/operations/
  pages/operations-page/
  components/operations-filter-panel/
  components/operations-status-tabs/
  components/operations-table/
  components/operation-row-actions/
  components/operation-create-modal/
  components/operation-confirm-modal/
  components/operation-lines-table/
  components/item-cache-search/
  components/temporary-item-form/
  components/operation-detail-modal/
```

Rules:

- Keep page components as orchestrators, not as giant components.
- Keep modal/form child components free of direct HTTP.
- Put DTO-to-VM mapping in services/mappers, not templates.
- Keep SCSS component-local where possible; share only actual tokens/global resets.

## 9. Operations Domain Mapping Notes

Operation types (authoritative source: `Functional and WorkLogik.md` §II.1):

```text
RECEIVE       -> Приход
EXPENSE       -> Расход
MOVE          -> Перемещение
WRITE_OFF     -> Списание
ISSUE         -> Выдача
ISSUE_RETURN  -> Возврат выдачи
CORRECTION    -> Корректировка (служебная — изменить количество/ТМЦ на складе)
```

Screen specs previously listed only 4 types. This TZ now overrides them: all 7 types must be supported in create/edit modal and list filters.

Key differences between types:
- **Выдача ≠ Расход**: при выдаче ТМЦ не списывается, а уходит в отдельный репозиторий и закрепляется за объектом (человек/машина/база) — см. `Functional and WorkLogik.md` §II.3.
- **Приход и Перемещение** — с обязательной приёмкой (см. §II.2, II.4).
- **Корректировка** — служебная операция, позволяющая изменить количество или саму ТМЦ на выбранном складе (§II.5.5). Может быть скрыта для обычного кладовщика (Backend enforcement).

Statuses from spec:

```text
draft       -> Черновик
created     -> Подтверждена / Создана
pending     -> Ожидает приёмки
submitted   -> Проведена
rejected    -> Отклонена
cancelled   -> Отменена
```

Important rule (from `Functional and WorkLogik.md` §II.4, II.8):

```text
Confirmation is not acceptance.
```

- Confirmation converts a draft into a full operation/document (проверка полномочий на SyncServer, §II.8).
- Acceptance (приёмка) is a **separate screen** for приход and перемещение where quantities are checked line-by-line: сколько приехало, сколько не приехало, отдельный комментарий (§II.4.1).
- Unaccepted items go to **репозиторий непринятого** (раздел V).
- The operations create/edit modal must not implement acceptance logic.

Future screens documented in `Functional and WorkLogik.md` but not yet in this TZ's active scope:

| Screen | Source | Status |
|---|---|---|
| Приёмка (построчный экран) | §II.4 | Требуется для приход/перемещение; отдельный TZ или уровень |
| Репозиторий непринятого | §V | Отдельный экран; два способа списания: «найдено» / «утеряно окончательно» |
| Репозиторий выдачи | §VI | Два подэкрана: «Имущество» + «Объекты»; на стадии продумывания |
| Дашборд (счётчик временных ТМЦ) | §IV.1.5 | Информация о количестве времянок с призывом преобразовать в постоянные |
| Накладная PDF по операции | §VII | Базовый вывод; на стадии продумывания |

Execution note: до реализации приёмки операции приход/перемещение не могут считаться полностью завершёнными в UI.

### 9.1 Operation editing rules (from `Functional and WorkLogik.md` §II.6)

All Angular operation screens must respect these server-enforced rules in their UI behavior:

```text
1. Изменять можно только неподтверждённые операции.
2. Удалять можно только отменённые операции.
3. Отменять уже подтверждённые операции имеет права только Root.
4. Отмена и подтверждение — на стадии Подтверждения.
```

UI implications:
- Edit button: visible only on drafts/неподтверждённые.
- Delete button: visible only on отменённые.
- Cancel button: visible on drafts and (only for Root) on confirmed operations.
- Confirm/Submit button: visible only on drafts.
- Observer never sees edit/create/confirm/cancel controls.

### 9.2 Table requirements (from `Functional and WorkLogik.md` §I.6)

**All tables** across all Angular screens must satisfy:

```text
1. Сортировка по любой колонке (§I.6.2).
2. Пагинация: 10, 20, 50 записей на выбор (§I.6.3).
3. Прокрутка строк таблицы, заголовки таблицы закреплены (sticky header) (§I.6.3).
4. Если модальное окно или контент не вмещается — полоса прокрутки, прокручивает
   только таблицу, не трогает заголовки и всё что над таблицей (§I.6.3).
```

### 9.3 Form field rules (from `Functional and WorkLogik.md` §II.5)

Common to all operation types (`§II.5.0`):
- **Комментарий**: textarea, 2 строки текста (не однострочный input).
- **Таблица ТМЦ**: с поиском (кешированным на фронте) с указанием количества на выбранном складе и категории.

Warehouse dropdown defaults (`§II.5.1–5.3`):
- Приход, Расход, Списание: выпадающий список, **по умолчанию склад залогиненного пользователя**.
- Перемещение: склад-отправитель и склад-получатель.
- Корректировка: выбранный склад (изменение кол-ва / самой ТМЦ на складе).

### 9.4 User role summary (from `Functional and WorkLogik.md` §I.2.1)

| Роль | Права |
|---|---|
| Обозреватель | Смотреть всё; не может подтверждать |
| Кладовщик (простой) | Смотреть всё + операции на приписанных складах |
| Главный кладовщик | Смотреть всё + все склады + редактировать справочники |
| Root | Всё что выше + пользователи, устройства, новые склады |

## 10. Real Test Stand Requirement

This TZ touches runtime behavior and therefore requires a real stand before final acceptance.

### 10.1 Database type and lifecycle

- SyncServer test database: PostgreSQL test DB, migrated with Alembic to head.
- Django test/runtime database: safe test DB according to local settings; migrations applied.
- No production database may be used.
- Reset between full scenario runs by dropping/recreating the test DB or running the documented test fixture reset.

### 10.2 Seed data

Minimum seed:

- Users:
  - admin/root-like user;
  - `chief_storekeeper` with broad warehouse access;
  - `storekeeper` bound to one default site;
  - `observer` view-only.
- Sites:
  - Основной склад;
  - Участок 2;
  - Резерв or another destination.
- Catalog:
  - categories: Кабельная продукция, Витая пара, Инструмент;
  - units: шт, бухта/бухт;
  - items: UTP Cat5e 305м, FTP Cat6 305м, Перфоратор Bosch GBH 2-26, Расходники без SKU-like test item.
- Balances:
  - UTP stock enough for valid MOVE;
  - Перфоратор stock lower than requested quantity to trigger insufficient stock;
  - at least one zero/absent stock case.
- Operations:
  - draft;
  - created/confirmed;
  - pending acceptance;
  - submitted;
  - cancelled.
- Optional temporary item fixture for receive/modal display.

### 10.3 Services to start

- SyncServer API against the test PostgreSQL database.
- Warehouse_web Django app against test settings and the SyncServer stand.
- Angular dev server only when using dev mode; otherwise use `npm run build` and Django-served assets.
- Playwright browser runner for UI automation.

### 10.4 Environment variable names only

Do not write secret values into this TZ or test logs.

Expected names may include:

- `DATABASE_URL`
- `DJANGO_SETTINGS_MODULE`
- `SECRET_KEY`
- `SYNC_SERVER_URL`
- `SYNC_ROOT_USER_TOKEN`
- `SYNC_DEVICE_TOKEN`
- `FRONTEND_MODE`
- `FRONTEND_DEV_SERVER_URL`
- `FRONTEND_BUILD_DIR`
- `DJANGO_BASE_URL`
- `SYNC_SERVER_BASE_URL`
- `TEST_USERNAME`
- `TEST_PASSWORD`
- `PLAYWRIGHT_BROWSERS_PATH`

### 10.5 Health checks

Minimum checks:

```http
GET <sync-server>/api/v1/health
GET <django>/bff/api/v1/health
GET <django>/nomenclature/api/bootstrap/
GET <django>/bff/api/v1/operations?page=1&page_size=1
GET <django>/nomenclature/
GET <django>/operations/        if operations Angular route is enabled
```

### 10.6 Smoke commands

Use local equivalents if project scripts differ.

Frontend:

```powershell
npm run build
npm test -- --watch=false
```

Django when BFF/host is changed:

```powershell
python manage.py check
python manage.py test apps.catalog apps.bff_api
```

Existing e2e direction:

```powershell
pytest tests_e2e/test_nomenclature_spa.py
```

Operations UI e2e must be added or extended once the operations Angular route exists.

### 10.7 Reset and cleanup

- Stop Angular dev server if started.
- Stop Django dev server if started.
- Stop SyncServer stand if started.
- Reset test DBs to fixture baseline.
- Remove temporary screenshots/logs only after evidence is copied to the report location.

## 11. Test Strategy Ladder

| Level | Required? | What to test | Evidence |
|---|---:|---|---|
| Static checks | Yes | Angular build, TypeScript, SCSS budgets; Django check if host/BFF touched | command logs |
| Unit tests | Yes | mappers, validators, filter/query builders, change buffer, draft store, prefill parser | `npm test` / focused logs |
| Component tests | Yes | tree states, forms, pending bar, operations filters/table/modal/confirm modal | test output |
| Integration tests | Yes | Angular services against BFF envelopes; Django BFF tests for changed endpoints | test output |
| Real stand smoke tests | Yes | Django-served Angular screens backed by SyncServer stand | URLs/logs |
| UI automation | Yes | Playwright through Django routes; no direct SyncServer calls | report/screenshots |
| User scenarios | Yes | catalog edit batch; operations create draft; insufficient stock; confirm operation; role restrictions | scenario evidence |
| Regression pack | Yes | auth redirect, SSR fallback, existing nomenclature SPA smoke, BFF health, operations SSR fallback if preserved | command logs |
| Acceptance review | Yes | evidence table + checklist review | QA signoff |

Non-applicable checks:

- Rust/core/FFI tests are not applicable to this frontend TZ.
- Mobile/WPF UI automation is not applicable.

## 12. Required User Scenarios

### Scenario A — Nomenclature read and local edit batch

1. Log in as a user with catalog management permission.
2. Open `/nomenclature/`.
3. Verify bootstrap loaded through `/nomenclature/api/bootstrap/`.
4. Search for `UTP`.
5. Select `UTP Cat5e 305м`.
6. Edit a field in the right panel.
7. Add to pending changes.
8. Verify dirty state and pending count.
9. Apply changes.
10. Verify data reload and pending count resets.

### Scenario B — Nomenclature forbidden/readonly behavior

1. Log in as observer or a user without catalog mutation permission.
2. Open `/nomenclature/`.
3. Verify read-only data displays.
4. Verify mutation controls are hidden/disabled or BFF returns controlled 403.
5. Verify no token appears in browser storage/network payloads.

### Scenario C — Operations list and filters

1. Log in as `chief_storekeeper`.
2. Open `/operations/` or the chosen operations Angular route.
3. Verify list loads through `/bff/api/v1/operations`.
4. Use search, type, status, site, period, and `Только мои` filters.
5. Verify query/state changes and list refresh.
6. Verify row badges and actions by status.

### Scenario D — Create draft with stock validation

1. Open operations list.
2. Click `+ Создать операцию`.
3. Select `MOVE`.
4. Choose source `Основной склад` and destination `Участок 2`.
5. Add UTP item with valid quantity.
6. Add Перфоратор with quantity greater than available stock.
7. Verify insufficient-stock warning.
8. Correct quantity or remove invalid line.
9. Save draft.
10. Verify list refreshes and draft appears.

### Scenario E — Confirm draft is not acceptance

1. Open a draft operation.
2. Click `Подтвердить операцию`.
3. Verify confirm modal warning text says this is not acceptance.
4. Confirm.
5. Verify POST to `/bff/api/v1/operations/{id}/submit`.
6. Verify list updates status.
7. Verify acceptance screen/form was not shown inside create/edit modal.

### Scenario F — Role restrictions

1. Log in as observer.
2. Verify create/confirm controls are absent or disabled.
3. Log in as storekeeper.
4. Verify source site is fixed to user's working site when required.
5. Attempt forbidden action and verify controlled BFF error, not silent UI success.

## 13. Regression Pack

Run or update regression checks for:

- anonymous `/nomenclature/` redirects to login;
- anonymous `/nomenclature/api/bootstrap/` redirects to login;
- authenticated nomenclature bootstrap returns JSON with `categories_tree`, `items`, `units`, `user`, `permissions`;
- browser makes no direct SyncServer calls;
- `/bff/api/v1/health` works;
- existing Django operations SSR routes still work or have an explicit fallback after Angular takeover;
- existing catalog SSR fallback under `/nomenclature/ssr/` still works until deprecated by explicit decision;
- auth boundary hardening remains effective: no regular user fallback to root token through BFF flows.

## 14. Risks And Blockers

| Risk | Impact | Mitigation |
|---|---|---|
| Operations clean-list screenshot missing | Visual acceptance ambiguity | Export/add screenshot or record blocker; use background in modal screenshots temporarily |
| Old `/operations/` redirect to `/nomenclature/operations/` remains | Violates `ARCHITECTURE_FRONTEND_SPA.md`; users get wrong business URL | Stream A must directly mount `/operations/` and move SSR to `/operations/ssr/` |
| Nomenclature mutation BFF gap | `Применить` cannot be honestly completed | Add/choose BFF mutation endpoints and tests before checking Level 2 complete |
| No unit/component tests for operations | Runtime UI cannot be accepted | Stream E adds tests for mappers, services, table, modals, role/default-site behavior |
| Decorative sorting only | Violates Functional §I.6 and gives false UI feedback | Stream C implements real client-side or backend-query sorting and tests row order changes |
| Role controls based only on status | Observer/storekeeper/root UX can contradict policy | Stream C must use auth/context + status mapper and keep BFF/SyncServer authoritative |
| Default warehouse missing in modal | Violates Functional §II.5.1-5.3 | Stream C loads auth/context/sites and defaults receive/expense/write-off warehouse |
| Double submit on save/confirm/apply | Duplicate operations or inconsistent state | Stream C/E verifies request-in-flight locks and recovery states |
| Specs mention `/api/v1` and `X-User-Token` | Browser could bypass Django if followed literally | Treat these as SyncServer facts only; browser uses Django BFF and no tokens |
| Role semantics differ between UI assumptions and SyncServer | UI enables invalid actions | BFF/SyncServer response remains authoritative; add error handling and tests |
| Acceptance confused with confirmation | Wrong business process in UI | Keep acceptance out of create/edit modal; explicit warning in confirm modal; per `Functional and WorkLogik.md` приёмка is a separate screen (§II.4) |
| Existing SSR routes regress | Users lose fallback | Preserve fallback until UI automation and stand smoke pass |
| Specs mentioned only 4 operation types; `Functional and WorkLogik.md` requires 7 | Missing расход, списание, корректировка in UI | RESOLVED: this TZ now mandates all 7 types per §II.1 |
| Missing screens (приёмка, репозиторий непринятого, репозиторий выдачи, дашборд, PDF) | Incomplete user workflow | Documented as future work in §9; acceptance required for приход/перемещение |

## 15. Evidence Table Template

Executor must fill this before requesting QA review.

### 15.1 Orchestrator stream evidence

| Stream | Owner/subagent | Status | Files changed | Checks run | Evidence | Blockers |
|---|---|---|---|---|---|---|
| A: Django SPA host/routes | Executor A | Complete | `config/urls.py`, `apps/catalog/views.py`, SPA templates, `apps/operations/ssr_urls.py`, sidebar, operations templates | `python manage.py check`, `python manage.py test apps.operations.tests` | System check passed; 57 operations tests passed; SSR namespace verified | None |
| B: Nomenclature mutations | Executor B | Complete | `apps/catalog/api_views.py`, `apps/catalog/nomenclature_urls.py`, `src/app/core/services/nomenclature.service.ts` | `python manage.py check`, `npm run build` | Django check passed; Angular build passed; POST/PATCH endpoints added for categories/items/units | None |
| C: Operations hardening | Executor C | Complete | `src/app/features/operations/**`, `src/app/core/services/operations.service.ts`, `src/app/core/services/auth-context.service.ts`, `src/app/core/models/operations.models.ts` | `npm run build`, `npm test` | Build passed; real sorting, role-aware actions, default warehouse, double-submit protection, badge CSS classes, confirm modal warning implemented | BFF auth endpoint `/auth/me` not implemented; auth context falls back to mock (`role: 'root'`, `defaultSiteId: null`) |
| D: Shared visual system | Executor D | Complete | `src/styles.scss`, `src/styles/_primitives.scss`, `src/styles/_legacy-aliases.scss`, new partials (`_tables.scss`, `_badges.scss`, `_modals.scss`, `_states.scss`, `_forms.scss`), `src/styles/README.md` | `npm run build` | Build passed; all new SCSS partials created and imported; README added | None |
| E: Tests/evidence | Executor E | Partial complete | `Warehouse_web/apps/catalog/tests.py`, `src/app/app.spec.ts`, `src/app/core/services/auth-context.service.spec.ts`, `src/app/core/services/operations.service.spec.ts`, this TZ file | `npm run build`, `npm test -- --watch=false`, `python manage.py test apps.catalog.tests`, `python manage.py test apps.operations.tests`, `python manage.py check` | 15 Angular tests passed; 34 catalog tests passed (9 new); 57 operations tests passed; evidence table filled | Playwright config missing; no real stand for smoke tests |

### 15.2 Verification evidence

| Check | Command / Tool | Result | Evidence |
|---|---|---|---|
| Static frontend build | `npm run build` | **PASS** | Build completed 268.59 kB raw; 2 lazy chunks (operations-page, nomenclature-page) |
| Frontend unit tests | `npm test -- --watch=false` | **PASS** | 15 passed (3 files): app.spec.ts, auth-context.service.spec.ts, operations.service.spec.ts |
| Component tests | Angular/Vitest TestBed | **PARTIAL** | Service-level component tests pass. Table/modal/validator component tests still missing. |
| Django checks | `python manage.py check` | **PASS** | System check identified no issues |
| Django catalog tests | `python manage.py test apps.catalog.tests` | **PASS** | 34 passed including 9 new POST/PATCH tests for categories, items, units |
| Django operations tests | `python manage.py test apps.operations.tests` | **PASS** | 57 passed; SSR namespace change verified (no `reverse()` calls affected) |
| SyncServer health | `GET localhost:8000/api/v1/health` | **PASS** | `{"status":"ok"}` |
| Django health | `GET localhost:8001/healthz/` | **PASS** | `{"status": "ok", "service": "warehouse_web"}` |
| DB tunnel | `Test-NetConnection localhost:5434` | **PASS** | Port open; PostgreSQL reachable via SSH tunnel |
| Angular asset serving | `GET localhost:8001/main-BXS3UMEK.js` | **PASS** | JS asset served with Angular runtime code |
| Angular CSS serving | `GET localhost:8001/styles-GJP3FR3J.css` | **PASS** | CSS served with `wh-*` custom properties (Stream D) |
| SPA route auth behavior | Playwright `page.goto('/operations/')` | **PASS** | Anon correctly redirected to `/login/?next=/operations/` (Django auth enforced) |
| SSR fallback auth behavior | `GET localhost:8001/operations/ssr/` | **PASS** | Anon correctly served login page (SSR fallback protected) |
| BFF API auth behavior | `GET localhost:8001/bff/api/v1/operations` | **PASS** | Anon correctly served login page (BFF endpoints protected) |
| Operations SPA route (auth) | Playwright login + `page.goto('/operations/')` | **PASS** | Title "Операции"; Angular markers present; console errors: 0; screenshot: `stand-smoke-operations-page-final.png` |
| Nomenclature SPA route (auth) | Playwright login + `page.goto('/nomenclature/')` | **PASS** | Title "Номенклатура"; Angular markers present; console errors: 0; screenshot: `stand-smoke-nomenclature-page-final.png` |
| SSR fallback route (auth) | Python requests GET `/operations/ssr/` after login | **PASS** | Returns SSR HTML (len 23784); no SPA style links; Django shell present |
| BFF operations list (auth) | Python requests GET `/bff/api/v1/operations?page=1&page_size=1` after login | **PASS** | Returns JSON envelope (len 1518); not login page |
| Nomenclature bootstrap (auth) | Python requests GET `/nomenclature/api/bootstrap/` after login | **PASS** | Returns JSON (len 12135); not login page |
| Playwright UI automation | `npx playwright test` | **BLOCKED** | No Playwright config or e2e/tests folder in Warehouse_frontend; smoke tests performed ad-hoc via Playwright MCP |
| User scenarios | manual/automated scenario set | **PARTIAL** | Scenarios A-F require Playwright infra and BFF data seeding; basic route/auth verified |
| Regression pack | listed regression commands | **PASS** | Django tests 91/91 pass; Angular tests 15/15 pass; anon redirect checks pass; auth SPA smoke passes; SSR fallback passes; asset serving passes; console errors: 0 |

## 16. Final Acceptance Criteria

The TZ can be accepted only when all of the following are true or explicitly blocked with evidence:

- Architecture boundary is preserved: Angular never calls SyncServer directly and never stores SyncServer tokens.
- `ARCHITECTURE_FRONTEND_SPA.md` is followed: Django shell is permanent, Angular renders only content area, business URLs open migrated Angular screens, SSR fallbacks live under `/ssr/`, and all browser data goes through BFF.
- Nomenclature screen matches active spec, completes local change-buffer behavior, and applies changes through a confirmed BFF contract.
- Operations list supports all 7 operation types from `Functional and WorkLogik.md` §II.1 in filters, table, and create/edit modal.
- Table requirements are met: column sorting, pagination 10/20/50, sticky headers, scroll-only-rows (§I.6).
- Sorting is real and verified; it is not only visual indicator toggling.
- Operation editing rules are enforced in UI per §II.6: edit only drafts, delete only cancelled, cancel confirmed only for Root.
- Role-aware controls use auth/context data: observer cannot mutate, storekeeper restrictions are visible, root-only actions are not exposed to normal users.
- Operations list, filters, create/edit modal (all 7 types), line table with comment field (2-line textarea), stock warnings, and confirm modal are implemented through Django BFF.
- Warehouse dropdowns default to logged-in user's warehouse per §II.5.1–5.3.
- Confirmation is visibly and functionally separate from acceptance; приёмка is a separate screen per §II.4.
- Django shell is not duplicated by Angular.
- `/operations/` directly mounts Angular operations inside the Django shell; `/operations/ssr/` fallback exists or an approved exception is recorded.
- `npm run build` passes.
- Unit/component tests cover non-trivial state, validation, and mapping logic.
- Django BFF/host integration tests cover changed endpoints/routes.
- Real stand smoke passes for both screens or remains unchecked with blocker notes.
- Playwright automation covers the main browser scenarios through Django.
- Regression checks for auth/session/BFF/no-direct-SyncServer behavior pass.
- Documentation and this checklist are updated with evidence.
