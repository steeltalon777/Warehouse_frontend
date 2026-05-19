# TZ: Warehouse Frontend Shared SPA Style System

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

- Architect creates this checklist, scope, levels, and acceptance criteria.
- Executor agents may check implementation and test items only after the required verification is done and evidence is recorded.
- QA verifier may check final acceptance only after reviewing evidence.
- Failed or unavailable checks stay unchecked with a blocker note.

---

## 1. Purpose

Create one authoritative visual/style source for every Angular SPA screen in `Warehouse_frontend`, including screens that do not exist yet.

The result must make nomenclature, operations, future balances, acceptance, temporary items, lost assets, issued assets, reports, and dashboard SPA screens look like one product inside the Django-owned shell.

This TZ is a prerequisite for broad Angular screen development. New screens must use the shared style system instead of copying per-screen CSS from mockups or existing components.

---

## 2. Source Requirements

Canonical functional requirements:

- `Functional and WorkLogik.md` is authoritative for screen layout and table behavior:
  - UI is designed primarily for FHD screens;
  - Django shell has top brand/user/logout area and left navigation;
  - Angular screens render in the remaining content container;
  - all tables need sortable columns;
  - pagination must use 10/20/50;
  - table body scrolls while headers and controls remain fixed;
  - modals that do not fit the screen must scroll internally.

Project rules:

- `Warehouse_frontend/AGENTS.md` says Angular must use Django same-origin/BFF and must not call SyncServer directly.
- `Warehouse_frontend/docs/TZ_FRONTEND_SCREENS_IMPLEMENTATION.md` already establishes that operation mockups are the canonical visual baseline for Angular workspaces and that Angular must not redraw the Django shell.

Visual references:

- `Warehouse_frontend/docs/screens_plan/Операции Django v2 — список + модалка создания операции.png`
- `Warehouse_frontend/docs/screens_plan/Операции Django v2 — подтверждение черновика.png`
- `Warehouse_frontend/docs/screens_plan/СТИЛИ список операций + модальное окно создания операции.md`
- `Warehouse_frontend/docs/screens_plan/nomenclature-screen-spec.md` for forms/tree behavior only; its full-page shell parts are non-normative.

---

## 3. Current State Snapshot

Observed current Angular style state:

- Global `src/styles.scss` contains only a small reset, body font/background, scrollbar styling, focus-visible, and button font inheritance.
- `src/app/app.scss` only sets host block height.
- Feature components use large inline `styles: [\`...\`]` blocks inside TypeScript files.
- Operations components duplicate generic classes such as `.btn`, `.modal-overlay`, `.modal-container`, `.badge`, `.table-card`, `.loading-overlay`, `.error-banner`.
- Nomenclature components also define page/card/layout values inline and use similar but not identical colors/radii/spacing.
- No dedicated shared SCSS token library exists.
- `angular.json` loads only `src/styles.scss` as the global style entry.

Problem:

- Future agents can accidentally create visually incompatible screens by copying local inline styles.
- Global styles currently include bare selectors like `html`, `body`, and `button`; when Angular is hosted inside Django, broad selectors can affect the Django shell.
- Colors and status/type badge styles are currently partly hardcoded in TS methods and inline `[style.background]` bindings.

---

## 4. Architecture Boundaries

### Django shell owns

- Top navbar/brand/user/logout.
- Left navigation.
- Global authenticated layout outside the Angular content rectangle.
- Organization brand variables and shell identity display.

### Angular style system owns

- Styles inside the Angular SPA root/content container.
- Shared page primitives for Angular feature screens.
- Visual tokens, spacing, typography, buttons, forms, tables, badges, modals, loading/error/empty/permission states.

### Forbidden

- Angular must not style or redraw Django topbar/sidebar.
- Angular global CSS must not accidentally restyle Django shell through broad selectors.
- New screens must not define their own unrelated button/table/modal/card systems.
- New screens must not use hardcoded magic colors when a token/class exists.
- New components must not use inline `[style.background]` for semantic states that belong to the design system.

---

## 5. Style System Decision

### 5.1 Single source of truth

Use `src/styles.scss` as the only global style entry imported by Angular CLI, but split the implementation into SCSS partials under a dedicated folder.

Recommended file layout:

```text
Warehouse_frontend/src/styles.scss
Warehouse_frontend/src/styles/
  _tokens.scss
  _reset.scss
  _typography.scss
  _layout.scss
  _buttons.scss
  _forms.scss
  _tables.scss
  _badges.scss
  _modals.scss
  _states.scss
  _utilities.scss
  README.md
```

`src/styles.scss` should only compose these partials and define the root SPA scope.

### 5.2 SPA scope

Introduce a root class for Angular content, recommended:

```html
<div class="warehouse-spa">
  <router-outlet />
</div>
```

All product classes should be scoped to `.warehouse-spa` or prefixed with `wh-`.

Recommended prefix: `wh-`.

Examples:

- `.wh-page`
- `.wh-page-header`
- `.wh-card`
- `.wh-filter-card`
- `.wh-table-card`
- `.wh-data-table`
- `.wh-modal-overlay`
- `.wh-btn`
- `.wh-badge`
- `.wh-empty-state`
- `.wh-error-state`

### 5.3 Token model

Define visual tokens as CSS custom properties inside `.warehouse-spa` and optionally SCSS variables for build-time convenience.

Minimum token groups:

- colors:
  - workspace background;
  - card background;
  - border/subtle border;
  - text primary/secondary/muted;
  - primary action;
  - danger/success/warning/info;
  - status colors;
  - operation type colors;
- spacing scale: `4/8/12/16/20/24/32`;
- radii: `6/8/10/12/16`;
- shadows/elevation;
- typography sizes/weights;
- z-index layers for modal/dropdown/toast;
- content dimensions for FHD-first layout;
- table row/header heights.

Baseline token values should be extracted from the operation mockups and current operations implementation, for example:

- workspace background near `#F1F5F9`;
- card background `#FFFFFF`;
- borders near `#E2E8F0` / `#E5E7EB`;
- primary dark text/action near `#0F172A` / `#334155`;
- secondary text near `#64748B`.

Executor may adjust exact values after screenshot comparison, but all adjustments must happen in tokens, not screen-local CSS.

---

## 6. Shared Primitives Required

The shared style system must provide class contracts for these primitives.

### 6.1 Page/container

- `.wh-page` — fills Django content container, not full browser viewport.
- `.wh-page-header` — title/subtitle/actions row.
- `.wh-page-title`, `.wh-page-subtitle`.
- `.wh-workspace` — internal page layout area.

### 6.2 Cards and panels

- `.wh-card` — generic white panel.
- `.wh-filter-card` — filters/search/status controls.
- `.wh-table-card` — data table container with constrained scroll.
- `.wh-panel` — side/right panel for tree/form layouts.

### 6.3 Buttons/actions

- `.wh-btn`
- `.wh-btn--primary`
- `.wh-btn--secondary`
- `.wh-btn--danger`
- `.wh-btn--success`
- `.wh-btn--ghost`
- `.wh-btn--sm`
- `.wh-icon-btn`

### 6.4 Forms

- `.wh-field`
- `.wh-label`
- `.wh-input`
- `.wh-select`
- `.wh-textarea`
- `.wh-form-row`
- `.wh-form-grid`
- `.wh-validation-message`

Textarea for operation comments must support the Functional requirement of two visible rows.

### 6.5 Tables

- `.wh-table-card`
- `.wh-table-scroll`
- `.wh-data-table`
- `.wh-sortable-th`
- `.wh-sort-indicator`
- `.wh-pagination`
- `.wh-page-size`

Mandatory behavior:

- sort state is visible;
- header is sticky;
- rows scroll without moving toolbar/header;
- page sizes are 10/20/50;
- empty/loading/error states fit inside table card.

### 6.6 Badges and semantic states

- `.wh-badge`
- `.wh-badge--status-draft`
- `.wh-badge--status-submitted`
- `.wh-badge--status-cancelled`
- `.wh-badge--status-pending`
- `.wh-badge--status-resolved`
- `.wh-badge--type-receive`
- `.wh-badge--type-expense`
- `.wh-badge--type-move`
- `.wh-badge--type-write-off`
- `.wh-badge--type-issue`
- `.wh-badge--type-issue-return`
- `.wh-badge--type-adjustment`

Semantic badge colors must come from classes/tokens, not TS `[style]` bindings.

### 6.7 Modals/overlays

- `.wh-modal-overlay`
- `.wh-modal`
- `.wh-modal--md`, `.wh-modal--lg`, `.wh-modal--xl`
- `.wh-modal-header`
- `.wh-modal-body`
- `.wh-modal-footer`
- `.wh-modal-close`

Mandatory behavior:

- overlay is contained visually within Angular content area unless product decision requires full-page overlay;
- modal body scrolls internally when content exceeds available height;
- header/footer remain visible;
- confirm and create modal use the same primitive.

### 6.8 Loading/error/empty/permission states

- `.wh-loading-state`
- `.wh-spinner`
- `.wh-error-banner`
- `.wh-empty-state`
- `.wh-permission-state`

---

## 7. Implementation Levels

### Level 0 — Inventory and migration plan

Scope:

- Inventory all inline `styles: [\`...\`]` blocks in `src/app/features/**`.
- Inventory duplicated classes and hardcoded colors/radii/shadows.
- Identify any global selectors in `src/styles.scss` that can leak into Django shell.
- Decide exact SCSS file layout and root SPA class.

Acceptance criteria:

- Executor records the list of components to migrate.
- Executor records which global selectors will be scoped or kept.
- No visual refactor starts before this inventory is captured in the completion report.

### Level 1 — Token and global style foundation

Scope:

- Create `src/styles/` partials.
- Move product visual values into `_tokens.scss`.
- Refactor `src/styles.scss` into the single entry that imports partials.
- Scope resets/product classes to `.warehouse-spa` and/or `wh-` classes.
- Keep only safe global resets outside `.warehouse-spa`.

Acceptance criteria:

- `npm run build` passes.
- Django shell is not visibly restyled by Angular global CSS when Angular is hosted.
- A future screen can use `.wh-page`, `.wh-card`, `.wh-btn`, `.wh-data-table`, `.wh-modal` without defining local styles.

### Level 2 — Shared primitives and documentation

Scope:

- Implement class contracts from section 6.
- Add `src/styles/README.md` describing:
  - token usage;
  - naming rules;
  - allowed local component styles;
  - examples for page/table/modal/form.
- Optional but recommended: create simple shared Angular UI wrapper components under `src/app/shared/ui/` only when classes alone are insufficient.

Acceptance criteria:

- README is usable by future screen agents.
- No screen-specific operation/nomenclature naming appears in generic primitive classes.
- Shared classes are semantic and reusable.

### Level 3 — Refactor existing nomenclature screen to style system

Scope:

- Replace nomenclature page/card/button/form/loading/error local styles with shared classes where possible.
- Keep only feature-specific grid/tree sizing locally.
- Ensure nomenclature remains inside Django content container and does not draw shell.

Acceptance criteria:

- Nomenclature visual result remains compatible with current design direction.
- Local styles are reduced to feature-specific layout exceptions.
- Nomenclature uses shared buttons, panels, states, forms, and page primitives.

### Level 4 — Refactor existing operations screen to style system

Scope:

- Replace operations page/table/filter/modal/button/badge local styles with shared classes.
- Remove TS-driven badge colors in favor of semantic badge classes.
- Ensure modal overlay/body/header/footer use shared modal primitive.
- Ensure table uses shared sticky header/pagination contract.

Acceptance criteria:

- Operations screen keeps visual alignment with operation mockups.
- No duplicate `.btn`, `.badge`, `.modal-*`, `.data-table`, `.loading-overlay`, `.error-banner` systems remain inside operations components.
- All 7 operation types have style classes.

### Level 5 — Future screen guardrails

Scope:

- Add a short section to frontend docs or this TZ completion report stating that all future Angular screens must start from shared classes.
- Add a lightweight review/check rule for executors:
  - search for large inline style blocks before completion;
  - search for hardcoded colors in feature components;
  - justify any local SCSS.

Acceptance criteria:

- New feature screen checklist includes style-system compliance.
- Future screens can be started without asking which colors/buttons/table/modal styles to use.

### Level 6 — Visual verification and regression

Scope:

- Build Angular.
- Run unit/component tests if available.
- Run or add Playwright/pytest browser smoke through Django-hosted route.
- Capture screenshots for:
  - nomenclature in Django shell;
  - operations list in Django shell;
  - operation create modal;
  - operation confirm modal.

Acceptance criteria:

- Screenshots show stable Django topbar/sidebar and Angular content styled consistently.
- No direct SyncServer calls are introduced.
- Build budgets remain acceptable or documented.

---

## 8. Real Test Stand Requirement

This TZ touches runtime UI behavior, so a real stand is required before final acceptance.

### Database

- Django safe test DB for sessions/auth.
- SyncServer PostgreSQL test DB for BFF data if operations/nomenclature screens need real data.
- Lifecycle:
  - migrate SyncServer;
  - bootstrap root/Django device tokens;
  - migrate Django;
  - seed users/sites/items/operations or use existing fixtures.

### Seed data

- Django authenticated user bound to SyncServer identity.
- Sites: at least one default/active warehouse.
- Catalog categories/items/units.
- Operations covering draft/submitted/cancelled and several operation types.
- Temporary item optional unless used by visible states.

### Services to start

- SyncServer API.
- Django app hosting Angular build or dev server proxy.
- Angular dev server only if `FRONTEND_MODE` uses dev-server mode.

### Environment variable names only

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

### Health checks

- SyncServer health endpoint.
- Django health/BFF health endpoint.
- `/nomenclature/` renders inside Django shell.
- `/operations/` renders inside Django shell if route is enabled.

### Smoke commands

```bash
npm run build
npm test -- --watch=false
python manage.py check
python manage.py test apps.catalog apps.bff_api
pytest tests_e2e/test_nomenclature_spa.py
```

Executors must adapt commands to the project workdir and available test runner.

### Cleanup

- Stop dev/background sessions.
- Reset disposable DBs or test fixtures.
- Do not commit generated screenshots unless the project already stores visual baselines intentionally.

---

## 9. Test Strategy Ladder

| Level | Required? | Checks |
|---|---|---|
| Static checks | Yes | `npm run build`; formatting/lint if configured; grep for forbidden direct SyncServer URLs/tokens |
| Unit tests | Yes if tooling available | Component class mapping helpers; badge class helpers; page-size options |
| Component tests | Yes if practical | Render key shared primitives and ensure class contracts exist |
| Integration tests | Yes | Django-hosted Angular routes with BFF stubs or real test services |
| Real stand smoke | Yes | Django shell + Angular + SyncServer test data |
| UI automation | Yes | Playwright/pytest screenshots or DOM checks for shell/container, tables, modals |
| User scenarios | Yes | User opens nomenclature/operations, sees consistent layout, table scroll/header behavior, modal internal scroll |
| Regression pack | Yes | Existing nomenclature flow, operations list/modal flow, no direct SyncServer calls |
| Acceptance review | Yes | Evidence table + screenshots/logs reviewed |

---

## 10. Acceptance Criteria

- There is one documented global style source composed from `src/styles.scss` and `src/styles/*` partials.
- Product styles are scoped to Angular SPA root and do not restyle Django shell unexpectedly.
- Shared tokens define colors, spacing, radii, typography, table dimensions, modal layers, and semantic state colors.
- Existing nomenclature and operations screens use shared style classes/primitives.
- Future screens have documented style-start rules and examples.
- No large duplicated button/table/modal/badge systems remain in feature components without justification.
- Tables follow Functional requirements: sortable headers, sticky header, body scroll, pagination 10/20/50.
- Modals follow Functional requirements: internal scroll when content exceeds available height.
- UI automation evidence shows consistent Angular content inside stable Django shell.

---

## 11. Evidence Table

| Check | Command / Tool | Result | Evidence |
|---|---|---|---|
| Static/build |  |  |  |
| Unit/component tests |  |  |  |
| Django-hosted integration |  |  |  |
| Real stand smoke |  |  |  |
| UI automation/screenshots |  |  |  |
| Regression checks |  |  |  |
| Documentation/readme |  |  |  |
