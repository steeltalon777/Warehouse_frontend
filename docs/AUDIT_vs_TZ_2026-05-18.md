# Audit: Angular Frontend vs TZ_FRONTEND_SCREENS_IMPLEMENTATION.md

Date: 2026-05-18

## Summary

TZ defines 10 implementation levels (0–9). Current completion: **~45% overall**.

| Level | Description | Status | Completion |
|---|---|---|---|
| 0 | Context and contract verification | ❌ Not done | 0% |
| 1 | Frontend architecture foundation | ⚠️ Partially done | 60% |
| 2 | Nomenclature workspace completion | ⚠️ Partially done | 55% |
| 3 | Operations list workspace | ✅ Largely done | 80% |
| 4 | Operation create/edit draft modal | ⚠️ Partially done | 50% |
| 5 | Confirm draft modal and submit flow | ✅ Largely done | 80% |
| 6 | Error handling, permissions, UX hardening | ❌ Minimally done | 20% |
| 7 | Shared visual system, container parity | ❌ Minimally done | 15% |
| 8 | Django host and BFF integration | ❌ Not done (ops) | 30% |
| 9 | Final documentation and handoff | ❌ Not done | 0% |

---

## Current Project Settings

| Property | Value |
|---|---|
| baseHref | `/nomenclature/` |
| Angular version | 21.2.x |
| Style language | SCSS, standalone components |
| Root route | `''` → `NomenclaturePageComponent` |
| Operations route | `'operations'` → `OperationsPageComponent` (defined, no Django SPA host) |
| Angular spec files | 1 (`app.spec.ts`, trivial) |
| Playwright/e2e tests | 1 (`test_nomenclature_spa.py`, nomenclature only) |

---

## File Inventory

### Nomenclature feature (`src/app/features/nomenclature/`) — 13 components

| Component | Status | Notes |
|---|---|---|
| `nomenclature-page/` | ✅ Active | Orchestrator component |
| `catalog-tree/` | ✅ Active | Proxy to catalog-tree-node |
| `catalog-tree-node/` | ✅ Active | Single row renderer |
| `right-panel/` | ✅ Active | Hosts item/category form switcher |
| `item-edit-form/` | ✅ Active | |
| `category-edit-form/` | ✅ Active | |
| `pending-changes-bar/` | ✅ Active | |
| `page-header/` | ✅ Active | |
| `search-input/` | ✅ Active | |
| `action-buttons/` | ✅ Active | |
| `toolbar/` | ❌ Legacy unused | Not imported by nomenclature-page |
| `category-tree/` | ❌ Legacy unused | Older tree, not used |
| `item-table/` | ❌ Legacy unused | Older table, not used |

### Operations feature (`src/app/features/operations/`) — 6 files

| Component | Status | Notes |
|---|---|---|
| `pages/operations-page/` | ✅ Present | Fully wired with signals, filters, modals |
| `components/operations-filter-panel/` | ✅ Present | Search, type, site, date, onlyMine; missing author filter and site options |
| `components/operations-status-tabs/` | ✅ Present | 6 tabs |
| `components/operations-table/` | ✅ Present | Sticky header, sort, pagination, row actions |
| `components/operation-create-modal/` | ✅ Present | Type selector, sites, lines table, save/submit |
| `components/operation-confirm-modal/` | ✅ Present | Warning banner, summary card, confirm/cancel |
| `components/operation-row-actions/` | ❌ Missing | Not created as standalone |
| `components/operation-lines-table/` | ❌ Missing | Inline in create modal |
| `components/item-cache-search/` | ❌ Missing | Not created |
| `components/temporary-item-form/` | ❌ Missing | Not created |
| `components/operation-detail-modal/` | ❌ Missing | Not created |

### Core services (`src/app/core/services/`)
- `nomenclature.service.ts` — complete, signals-based
- `catalog-change-buffer.service.ts` — complete
- `operations.service.ts` — complete, uses BffApiService (bug: dual BffApiService instantiation)

### Core API (`src/app/core/api/`)
- `api.service.ts` — `/nomenclature/api/*`
- `bff-api.service.ts` — `/bff/api/v1/*`

### Core models (`src/app/core/models/`)
- `nomenclature.models.ts` — includes CatalogTreeNodeVm, etc.
- `operations.models.ts` — includes all 7 types, labels, badge colors, status tabs

---

## Level 0 — Context and contract verification

**Status: NOT DONE (0%)**

| Task | Status | Notes |
|---|---|---|
| Re-read TZ, AGENTS.md, screen specs | Done for audit | |
| Confirm Angular version, scripts, routing | Done | |
| Confirm BFF family for catalog mutations | ❌ Not decided | `/nomenclature/api/*` has GET/DELETE only; no POST/PATCH mutation endpoints |
| Confirm operations route hosting approach | ❌ Not decided | TZ Section 5 requires Option A/B/C; no decision documented |
| Inventory existing frontend files | Done | |
| Record blockers for missing screenshots | ⚠️ Partially | `operations-clean-list.png` missing, not resolved |

---

## Level 1 — Frontend architecture foundation

**Status: PARTIALLY DONE (~60%)**

| Task | Status | Notes |
|---|---|---|
| Standalone component architecture | ✅ Done | |
| Feature routing for nomenclature + operations | ✅ Done | Both routes in `app.routes.ts` |
| Django shell ownership preserved | ⚠️ Partial | Nomenclature uses `min-height: 100vh` (full-page), contradicts TZ §3.3 |
| HTTP client clarity | ✅ Done | Two clear clients; no third client needed |
| Shared error/loading VM patterns | ❌ Not done | Each service does its own |
| Verify baseHref + Django serving | ❌ Not done | `baseHref` is `/nomenclature/` — breaks `/operations` in build mode |

---

## Level 2 — Nomenclature workspace completion

**Status: PARTIALLY DONE (~55%)**

**Critical blocker: No POST/PATCH mutation endpoints on `/nomenclature/api/*`. `applyBatch()` will fail with 405.**

| Task | Status | Notes |
|---|---|---|
| Align components with spec | ⚠️ Partial | |
| Tree states (normal/selected/dirty/inactive/error) | ⚠️ Partial | CSS classes exist; expanded via rotate |
| Local search by name/SKU/keywords | ⚠️ Partial | name + SKU only; no keywords |
| Search keeps parent visible | ✅ Done | |
| Right-panel forms | ✅ Done | |
| Edits don't call API immediately | ✅ Done | Local change buffer |
| Pending changes bar | ✅ Done | |
| Delete behavior resolved | ❌ Not done | No backend DELETE; should disable |
| Mutation endpoint gap | ❌ Critical blocker | `applyBatch()` → 405 |
| Empty/loading/error states | ✅ Done | |

---

## Level 3 — Operations list workspace

**Status: LARGELY DONE (~80%)**

| Task | Status | Notes |
|---|---|---|
| Feature structure | ✅ Done | 6 files |
| Typed UI models | ✅ Done | |
| Operations API service | ✅ Done | Bug: dual BffApiService in constructor |
| Page header actions | ✅ Done | +Создать, Приёмка stub, Экспорт disabled |
| Filter card | ✅ Done | Missing author filter, site options empty |
| Status tabs (6) | ✅ Done | |
| Operations table columns | ✅ Done | |
| Row hover actions | ✅ Done | |
| Table sorting | ✅ Done | |
| Pagination 10/20/50 | ✅ Done | |
| Sticky table header | ✅ Done | |
| Django-shell container | ❌ Not verified | |
| Site dropdown options | ❌ Not done | Template has no `<option>` tags for sites |
| Author filter | ❌ Not done | |
| Role-based UI hiding | ❌ Not done | |

---

## Level 4 — Operation create/edit draft modal

**Status: PARTIALLY DONE (~50%)**

**Blocking gaps: no item cache search, no stock hints, no temporary item creation.**

| Task | Status | Notes |
|---|---|---|
| Create modal component | ✅ Done | |
| Create and edit draft modes | ✅ Done | `isEdit()` = `!!draft.id` |
| Type-dependent field visibility | ⚠️ Partial | 5/7 types handled; CORRECTION, WRITE_OFF, EXPENSE incomplete |
| Cached item search | ❌ Critical gap | Component doesn't exist |
| Line table columns | ❌ Minimal | Missing SKU/status/stock/error columns |
| Stock hints from balances | ❌ Critical gap | No implementation |
| Validation | ⚠️ Partial | qty > 0 checked; no stock validation for MOVE/ISSUE |
| Temporary item creation | ❌ Critical gap | Component doesn't exist |
| Prefill from query params | ❌ Not done | |
| Unsaved changes confirmation | ❌ Not done | |
| Comment as 2-line textarea | ✅ Done | |

---

## Level 5 — Confirm draft modal and submit flow

**Status: LARGELY DONE (~80%)**

| Task | Status | Notes |
|---|---|---|
| Confirm modal component | ✅ Done | |
| Warning (not acceptance) | ⚠️ Partial | Text present but doesn't match spec exactly |
| Operation summary | ✅ Done | |
| Wire to POST submit | ✅ Done | |
| Success: close modals, reload | ✅ Done | |
| Failure: keep modals, show error | ✅ Done | |

---

## Level 6 — Error handling, permissions, UX hardening

**Status: MINIMALLY DONE (~20%)**

| Task | Status | Notes |
|---|---|---|
| Normalize error handling | ⚠️ Partial | Duplicative handleError in both API services |
| Clear messages for 401/403/404/409/422 | ⚠️ Partial | Mapped but not normalized |
| Keep form state after failure | ❌ Not done | |
| Loading/disabled for buttons | ✅ Done | |
| No console-only error handling | ❌ Not done | `console.error` in `onApplyAll()` |
| Keyboard focus in modals | ❌ Not done | |
| ESC/close behavior | ⚠️ Partial | Click overlay closes; no ESC listener |
| Labels for inputs | ✅ Done | |
| Visible focus state | ✅ Done | |
| Aria labels for icon-only actions | ❌ Not done | |

---

## Level 7 — Shared visual system, container parity

**Status: MINIMALLY DONE (~15%)**

| Task | Status | Notes |
|---|---|---|
| Reusable SCSS tokens | ❌ Not done | Hardcoded colors everywhere |
| Reusable page primitives | ❌ Not done | |
| Match operation screenshots | ⚠️ Partial | Visually approximates; not reviewed in Django shell |
| Refit nomenclature to container | ❌ Not done | Still `min-height: 100vh` |
| Responsive rules | ⚠️ Partial | Some @media breakpoints |
| Style budgets | ❌ Not verified | |

---

## Level 8 — Django host and BFF integration

**Status: NOT DONE for operations (~30% overall)**

| Task | Status | Notes |
|---|---|---|
| Preserve SSR fallback for operations | N/A | Operations Angular route not Django-served yet |
| Django SPA view for operations | ❌ Not done | No OperationsSPAView, no template |
| BFF endpoints for operations | ✅ Done | 6 endpoints in `bff_api` |
| BFF mutation endpoints for nomenclature | ❌ Critical gap | POST/PATCH missing from `nomenclature_urls.py` |
| Django tests for BFF | Not verified | |
| Anonymous user redirect | Unknown | |

---

## Django SPA Hosting Status

| Feature | Angular Route | Django SPA View | Django Template | baseHref Compatible |
|---|---|---|---|---|
| Nomenclature | `/nomenclature/` | ✅ NomenclatureSPAView | `catalog/nomenclature_spa.html` | ✅ `/nomenclature/` |
| Operations | `/operations` | ❌ None | ❌ None | ❌ baseHref is `/nomenclature/` |

`Warehouse_web/config/urls.py` has `path("operations/", include("apps.operations.urls"))` — this serves Django SSR operations, not Angular SPA.

---

## Test Coverage

| Test Type | Count | Details |
|---|---|---|
| Angular .spec.ts files | 1 | `app.spec.ts` — trivial |
| Component tests | 0 | |
| Service tests | 0 | |
| Playwright/e2e (nomenclature) | 1 | `test_nomenclature_spa.py` |
| Playwright/e2e (operations) | 0 | |

---

## Missing Screenshots / Blockers

| Blocker | Impact | Priority |
|---|---|---|
| `operations-clean-list.png` missing | Visual acceptance ambiguity | Low |
| `baseHref` `/nomenclature/` breaks `/operations` mount | Operations route broken in build mode | **HIGH** |
| No POST/PATCH mutation endpoints for nomenclature | `applyBatch()` always 405 | **HIGH** |
| No item cache search in operations modal | Modal unusable for real operations | **HIGH** |
| No stock hints in operations modal | Operators can't see current balances | **HIGH** |
| No temporary item form | Cannot create temp items in operation | **MEDIUM** |
| OperationsService dual BffApiService bug | Dead code, confusing | **LOW** |

---

## Recommended Next Steps (Prioritized)

1. **HIGH** — Close routing/hosting decision (TZ §5). Choose Option B (single build, multiple Django mounts). Implement `OperationsSPAView` + template.
2. **HIGH** — Close nomenclature mutation BFF gap. Add POST/PATCH to `api_views.py` or switch to `/bff/api/v1/catalog/admin/*`.
3. **HIGH** — Implement item cache search and stock hints in operations modal.
4. **MEDIUM** — Refit nomenclature to Django container (remove `min-height: 100vh`).
5. **MEDIUM** — Extract shared SCSS tokens and page primitives.
6. **MEDIUM** — Add missing filter fields (author filter, site options).
7. **LOW** — Fix OperationsService constructor bug, add aria-labels, add ESC listener.
