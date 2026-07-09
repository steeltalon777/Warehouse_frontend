# Warehouse Frontend SPA Architecture

## Status

Normative architecture standard for all browser UI work that involves `Warehouse_frontend` and Django SPA hosting.

This document is not a one-time TZ. It defines the permanent target architecture that executor agents must follow when adding or migrating browser screens.

## Authority

- `Functional and WorkLogik.md` remains the canonical source for warehouse business rules, roles, operation lifecycle, table behavior, and required screens.
- This document is canonical for frontend hosting, route migration, Angular/Django ownership, BFF-only browser data access, and screen layout boundaries.
- `Warehouse_frontend/docs/screens_plan/` is the visual/spec input folder. Specs and screenshots are implementation references, but they do not override `Functional and WorkLogik.md` or this architecture.
- Deviations require an ADR or an explicit TZ section explaining the reason and scope.

## Core Decision

The web UI uses a permanent split:

```text
Django shell: permanent authenticated frame
Angular SPA: permanent content application mounted inside the frame
```

The target runtime path is:

```text
Browser
  -> Django business URL
  -> Django authenticated shell
  -> Angular content area
  -> Django same-origin BFF endpoint
  -> Warehouse_web sync_client/service
  -> SyncServer
```

Canonical rules:

- Django shell is permanent.
- Angular content area is permanent.
- Business URLs open Angular screens.
- Legacy SSR screens move under `/ssr/` fallback routes.
- All browser data goes through Django BFF endpoints.

## Shell Ownership

Django owns the global shell:

- top brand/user/login/logout/admin area;
- left navigation menu;
- authenticated session and permission entry point;
- global messages/loading around the page;
- static organization brand variables;
- HTML layout outside the Angular mount point.

Angular owns only the content workspace:

- page headers inside the workspace;
- filters, tabs, tables, cards, forms, modals;
- feature-level view models and UI state;
- client-side navigation between Angular feature screens;
- loading/error/empty/permission states inside the content rectangle.

Angular must not redraw or restyle the Django topbar/sidebar. Angular screens must fit the lower-right/right content area below the topbar and to the right of the left menu.

## Content Mount Contract

Every Angular screen is mounted inside the Django `{% block content %}` area through the Angular root component.

Required Angular root wrapper:

```html
<div class="warehouse-spa">
  <router-outlet />
</div>
```

Required behavior:

- `.warehouse-spa` fills the available Django content container, not the full browser viewport.
- Feature components use `.wh-page` or equivalent shared layout primitives from the shared style system.
- Feature CSS must not position content relative to the full viewport origin as if Angular owned the topbar/sidebar.
- Modals overlay the Angular workspace, not the whole Django application shell, unless a specific UX TZ says otherwise.
- Screenshots for acceptance must show Django topbar and sidebar visible while Angular changes only the content area.

## Business URL Contract

User-facing warehouse URLs are business URLs. They should not expose implementation details like `angular`, `spa`, or unrelated feature prefixes.

Preferred target examples:

```text
/nomenclature/
/operations/
/balances/
/temporary-items/
/pending-acceptance/
/lost-assets/
/issued-assets/
/reports/
```

Rules:

- The primary business URL opens the Angular screen once that screen is migrated.
- The old Django SSR implementation, when retained, moves to an explicit `/ssr/` fallback path.
- Do not mount unrelated screens under another feature path, for example do not make `/nomenclature/operations/` the final operations URL.
- Temporary redirects are allowed only during migration and must be documented with the planned removal condition.

Preferred fallback examples:

```text
/nomenclature/ssr/
/operations/ssr/
/balances/ssr/
/temporary-items/ssr/
```

## Angular Build And Base Href

Target decision:

- one Angular application build;
- one global Angular `baseHref` compatible with multiple Django business URLs;
- multiple Django mount routes rendering the same Angular app;
- Angular router chooses the feature screen based on the current path.

Preferred build setting:

```text
baseHref: "/"
```

Template rule:

- SPA templates must not hardcode `<base href="/nomenclature/">` for the long-term architecture.
- If a route-specific base is temporarily required, the TZ must state why and how it will be removed.

Asset serving rule:

- Django may serve Angular build assets through a shared asset view.
- Asset URLs must work from every business URL that mounts Angular.
- Refreshing `/operations/`, `/nomenclature/`, and future SPA routes must not produce 404 because of asset path assumptions.

## Django SPA Host Contract

Django should expose a reusable SPA host for Angular screens.

Preferred target:

- one reusable Django view/mixin for rendering the Angular app;
- one reusable SPA template, or route-specific wrappers that differ only by title/metadata;
- a clear route registry that maps business URLs to Angular-hosted screens;
- SSR routes preserved only under `/ssr/` while needed.

The Django host is responsible for:

- requiring login before the Angular app is served;
- keeping CSRF/session cookies available;
- rendering the shell around Angular;
- not injecting SyncServer tokens into the page;
- serving Angular assets safely from `FRONTEND_BUILD_DIR`.

## Navigation Contract

Current phase:

- Django renders the left navigation menu.
- Clicking a menu item opens the corresponding business URL.
- If the screen is migrated, that URL renders Angular in the content area.
- If the screen is not migrated, that URL may still render SSR until migration.
- Active menu state remains Django-owned for now.

Future phase:

- The menu may become dynamic through a Django BFF endpoint such as `/bff/api/v1/navigation`.
- Dynamic menu work is out of scope for screen implementation unless a TZ explicitly includes it.

Forbidden now:

- Angular must not replace the global sidebar.
- Angular must not fetch or own the global menu state unless a menu architecture TZ is approved.
- Agents must not add a second topbar/sidebar inside Angular screens.
- The main menu stays in Django during the current phase; Angular screens mount only in the content container to the right of that menu. Moving the menu into Angular requires a separate ADR/TZ with migration and test evidence.

## BFF-Only Data Contract

Angular/browser code may call only same-origin Django endpoints.

Allowed:

```text
/bff/api/v1/*
/nomenclature/api/*   temporary legacy exception until catalog is moved to unified BFF
```

Forbidden:

```text
Direct SyncServer /api/v1/* calls from browser
X-User-Token in Angular code
X-Device-Token in Angular code
root/device token injection into templates
browser localStorage/sessionStorage token storage
```

Each migrated Angular screen must have a declared BFF contract before implementation is accepted.

## Feature Structure Contract

Use feature-local Angular structure.

Recommended layout:

```text
src/app/features/<feature>/
  pages/
  components/
  services/
  models/
  mappers/
```

Rules:

- Page components orchestrate screen-level actions.
- Services/stores perform HTTP and own state transitions.
- Mappers translate API DTOs to UI view models.
- Row, modal, form, tree, and leaf components do not call HTTP directly.
- Shared DTOs live under `src/app/core/models/` only when reused across features.
- Shared API infrastructure lives under `src/app/core/api/`.

## Shared Style Contract

All Angular screens must use `Warehouse_frontend/docs/TZ_FRONTEND_SHARED_STYLE_SYSTEM.md` and the shared `wh-*` class contract.

Required baseline:

- `.warehouse-spa` root scope;
- `wh-` classes for product UI primitives;
- tokens in shared styles, not screen-local magic colors;
- table, modal, button, card, badge, loading/error/empty states from shared primitives;
- no new unrelated button/table/modal systems per feature.

Visual baseline:

- operation Figma/screenshots under `docs/screens_plan/` define the shared container style;
- nomenclature spec is valid for tree/form/pending-change behavior;
- old full-page topbar in the nomenclature spec is non-normative because Django owns the shell.

## Table Contract

All Angular data tables must follow `Functional and WorkLogik.md`:

- sortable columns where meaningful;
- pagination options `10`, `20`, `50`;
- fixed toolbar/filter/header area;
- scroll only table body when content overflows;
- sticky header where the table body scrolls;
- visible loading, empty, error, and permission-denied states;
- row actions must respect user role and domain status.

## FHD Compact Workspace Contract

All Angular warehouse screens are designed first for an FHD operator display (`1920x1080`) inside the permanent Django shell.

The Django topbar/sidebar remain outside Angular ownership. Angular must optimize the remaining content rectangle for data work, not for marketing-style vertical whitespace.

Required layout behavior for table-heavy screens such as balances, operations, acceptance, temporary items, repositories, and catalogs:

- The screen is a flex/grid column with `min-height: 0` so the table region can consume remaining height.
- The area from the bottom of the Django topbar to the filter action row (`Применить`, `Сбросить`, etc.) must occupy no more than one quarter of the visible content height on FHD; target budget is about `220-240px` including page title, tabs, filter card, and action buttons.
- Page headers are compact: title, short description, and top-right screen actions must fit in one row where possible; avoid large `margin-bottom` blocks before filters.
- Filters for data tables use a compact grid: two to four fields per row on FHD, `32-36px` controls, `8-12px` row/column gaps, and `12-16px` card padding.
- Boolean filters must be inline with the field/action row when space allows; they must not create large empty rows across the whole card.
- Table cards flex-grow and own vertical overflow. The page itself should not scroll for normal FHD table work; the table body scrolls with a sticky header.
- Sortable headers must be visible as clickable controls with sort indicator and `aria-sort`; sorting may be client-side or BFF/query-param based, but the behavior must be deterministic and covered by tests.
- Pagination choices are exactly `10`, `20`, `50` unless an ADR/TZ explicitly justifies another option for a specific screen.

Detailed implementation assignment and verification requirements are tracked in `TZ_FRONTEND_SHARED_STYLE_SYSTEM.md`.

## Route Migration Matrix

Every browser screen should be tracked with one of these states.

| State | Meaning |
|---|---|
| `SSR active` | Current user-facing route still renders Django SSR. |
| `Angular candidate` | Contract/design exists, but primary route has not switched yet. |
| `Angular primary` | Business URL renders Angular. |
| `SSR fallback` | Old SSR exists only under `/ssr/`. |
| `Archived` | SSR route removed or kept only for tests/admin internals. |

Initial target matrix:

| Area | Target business URL | Target state | Notes |
|---|---|---|---|---|
| Dashboard | `/client/` or future `/dashboard/` | SSR active | Dynamic menu/dashboard can be planned later. |
| Catalog readonly | `/catalog/` | Angular primary | Readonly Angular alias of nomenclature tree. Compatibility paths `/catalog/items/`, `/catalog/categories/`, and `/catalog/<path>` stay on the same readonly Angular screen. SSR fallback under `/catalog/ssr/`. |
| Nomenclature | `/nomenclature/` | Angular primary | Editable Angular screen for catalog managers (`root` / `chief_storekeeper`). SSR fallback under `/nomenclature/ssr/`. |
| Operations journal | `/operations/` | Angular primary | Must not remain under `/nomenclature/operations/`. |
| Balances | `/balances/` | Angular candidate | BFF exists; table contract required. |
| Pending acceptance | `/pending-acceptance/` or agreed route | Angular candidate | Required by `Functional and WorkLogik.md`. |
| Lost/unaccepted assets | `/lost-assets/` | Angular candidate | Required by `Functional and WorkLogik.md`. |
| Temporary items | `/temporary-items/` | Angular candidate | SSR implemented; dashboard count required. |
| Issued assets | `/issued-assets/` | Angular primary | Workspace stays inside the Django shell content area: left tree of issue-object categories/objects uses the functional 25% rule with bounded `clamp(280px, 25%, 420px)`, and the right panel uses the remaining width for selection details. Sidebar label is `Репозиторий выдачи`; old `Непринятое` sidebar label is renamed to `Репозиторий непринятого` (route `/operations/lost-assets` unchanged). Per-row `Возврат`/`Списание` actions launch the operations modal with object-issued `availableQuantity` validation. |
| Reports/documents | `/reports/`, `/documents/` | Angular candidate | PDF invoice flow required soon. |
| Admin/users/devices | `/admin-panel/`, `/users/` | SSR active | Keep Django/admin-first until a TZ changes it. |

When a screen is migrated, update this matrix or a linked screen registry.

## Screen Registry Requirement

Before implementing a new Angular screen, the responsible agent must identify:

| Field | Required answer |
|---|---|
| Business URL | The user-facing path. |
| SSR fallback URL | Existing or planned `/ssr/` path. |
| Angular route | The route path handled by Angular. |
| Django host route | The Django route that renders the Angular app. |
| Sidebar item | Existing or planned menu entry. |
| BFF endpoints | Same-origin APIs used by the screen. |
| Roles | Which roles can view or mutate. |
| Source specs | Functional section, screen spec, screenshot references. |
| Migration state | One of the route migration states above. |

## Acceptance Checks For SPA Architecture Work

A route/screen migration is not accepted unless:

- direct navigation to the business URL works;
- browser refresh on the business URL works;
- Django topbar/sidebar remain visible;
- Angular renders only inside the content area;
- sidebar click opens the correct business URL;
- no direct SyncServer request is visible in browser network logs;
- unauthenticated users are redirected to Django login;
- role/permission errors are shown inside Angular content area;
- `npm run build` passes after frontend changes;
- relevant Django route/BFF tests pass after Django changes.

## Implementation Guardrails For Agents

- Read this document before changing Angular routing, Django SPA host routes, sidebar links, or browser API calls.
- Do not create a new route namespace without checking the route migration matrix.
- Do not add a standalone Angular shell with its own topbar/sidebar.
- Do not use `/nomenclature/` as a catch-all container for unrelated future screens.
- Do not duplicate BFF clients unless replacing existing clients as an explicit refactor.
- If the current code contradicts this architecture, treat the code as transitional and document the migration step.
