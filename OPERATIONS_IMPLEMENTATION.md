# Operations Feature Implementation Summary

## Date: 2026-06-02 (updated)

## Changelog

### 2026-06-02 — Operation Create Modal Rework
- Complete modal layout rework: 40/30/30 for MOVE, 40/60 for non-MOVE with hidden destination
- Extracted `OperationLinesTableComponent` with 60/20/15/5 column proportions, sorting, name filtering, balance display
- Created `operation-draft-mappers.ts` with `snapshotDraft`/`isDraftClean` for dirty-state tracking
- Added `deleteOperation` to service, `onDraftDelete`/`onRowDelete` to page
- Save/confirm gating: confirm disabled until saved and clean, save explains validation reasons
- Sticky header table with independent scroll within 1024px modal
- Balance refresh on warehouse change with loading state

## Scope
Implemented the Operations workspace for the Warehouse Angular frontend per the TZ requirements.

## Files Created

### Models
- `src/app/core/models/operations.models.ts` — DTOs, view models, filter state, badges/colors constants

### Services
- `src/app/core/services/operations.service.ts` — Operations API service with list, CRUD, submit, cancel, sites/balances loading

### Pipes
- `src/app/core/pipes/min.pipe.ts` — Min pipe for pagination display

### Components
- `src/app/features/operations/pages/operations-page/operations-page.component.ts` — Main operations page with header, filters, table, modals; includes draft save, submit, delete lifecycle
- `src/app/features/operations/components/operations-filter-panel/operations-filter-panel.component.ts` — Search, type, site, date range filters
- `src/app/features/operations/components/operations-status-tabs/operations-status-tabs.component.ts` — Status tab navigation (All, Drafts, Confirm, Acceptance, Submitted, Cancelled)
- `src/app/features/operations/components/operations-table/operations-table.component.ts` — Data table with sorting, pagination, row actions (edit, submit, cancel, print)
- `src/app/features/operations/components/operation-create-modal/operation-create-modal.component.ts` — Create/edit modal with 40/30/30 (MOVE) or 40/60 (non-MOVE) layout, type selector, sites, person name, comment, item search, lines table, save/confirm gating, delete draft
- `src/app/features/operations/components/operation-create-modal/operation-lines-table.component.ts` — Extracted lines table with 60/20/15/5 columns, sorting by name/qty/available, name filter, balance display with over-quantity warning
- `src/app/features/operations/components/operation-create-modal/operation-draft-mappers.ts` — Pure helpers: `snapshotDraft()` and `isDraftClean()` for dirty-state detection
- `src/app/features/operations/components/operation-confirm-modal/operation-confirm-modal.component.ts` — Confirm modal with warning banner and operation summary

### Routing
- Updated `src/app/app.routes.ts` — Added `/operations` route

## Build Verification
- `npm run build` passes successfully
- Operations feature is lazy-loaded as a separate chunk (~87.93 kB)
- 37 Angular unit tests pass (7/8 test files, 2 pre-existing failures in temp-items.service unrelated to operations)
- 9 Playwright UI smoke tests pass

## Architecture Compliance
- Angular calls Django BFF endpoints via `BffApiService`
- No direct SyncServer calls from browser
- Uses standalone components with signals
- Follows existing project patterns (nomenclature feature style)

## Remaining Work (Deferred)
1. **Level 2**: Nomenclature workspace completion (out of scope for this task)
2. **Level 6**: Error handling hardening — need normalized error display, loading skeletons
3. **Level 7**: Shared visual system — SCSS tokens, responsive behavior, screenshot parity
4. **Level 8**: Django host integration — `/operations/` route hosting in Django templates/URLs
5. **Level 9**: Full documentation and evidence table with screenshots

## Blockers
- None for current Angular build
- Django route hosting for `/operations/` pending Django URL/template updates

## Evidence

| Check | Command | Result | Evidence |
|---|---|---|---|
| Angular build | `npm run build` | Pass | Build output in `dist/warehouse-frontend` |
| Lazy chunk | Build analyzer | Pass | `operations-page-component` chunk generated (87.93 kB) |
| TypeScript | `ng build` | Pass | Zero TS errors |
| Unit tests | `ng test --no-watch` | 37/39 pass | 2 pre-existing failures in temp-items.service |
| BFF integration | `docker exec warehouse_web python manage.py test apps.bff_api.tests` | 23/23 pass | All endpoints (delete, submit, search) confirmed |
| UI smoke | `npx playwright test e2e/operations-create-modal.spec.ts` | 9/9 pass | Layout, validation, columns verified |
