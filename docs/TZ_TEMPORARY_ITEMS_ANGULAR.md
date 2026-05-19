# TZ: Temporary Items Angular Screen — `/temporary-items/`

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

---

## 0. Purpose

Replace the SSR-based temporary items screen (`/temporary-items/`, currently rendered by Django templates) with an Angular SPA screen hosted inside the Django content area.

The Angular screen must:

- Follow the permanent architecture standard: Django shell is permanent (topbar, sidebar, auth), Angular renders only the lower-right content workspace.
- Display a summary dashboard-like header explaining **why** temporary items exist and **what action** the user should take.
- Present a filterable, sortable, paginated table of temporary items.
- Compute human-readable UI statuses from raw SyncServer statuses, balances, and pending acceptances.
- Open a detail modal (not a separate page) on row click, showing balances per site, related operations, and context-aware available actions.
- Support four actions from the modal: convert to permanent, merge with permanent, merge with another temporary item, delete — each with per-item gating and warnings.

Canonical source documents:

| Document | Role |
|---|---|
| `Functional and WorkLogik.md` §IV | Canonical business rules, roles, lifecycle. |
| `ARCHITECTURE_FRONTEND_SPA.md` | Normative host/mount/route/BFF/shell ownership rules. |
| `TZ_FRONTEND_SHARED_STYLE_SYSTEM.md` | Shared SPA visual system, `wh-*` class contract. |
| `TZ_FRONTEND_SCREENS_IMPLEMENTATION.md` | Reference TZ for nomenclature/operations patterns. |
| `docs/AUDIT_IV_TEMPORARY_ITEMS_2026-05-19.md` | Current audit findings (41% compliance). This TZ closes all audit gaps for the UI layer. |
| User UX specification (2026-05-19) | Detailed layout, statuses, actions, modal flows — incorporated verbatim in sections 3–5. |

---

## 1. Architecture Boundaries

### 1.1 Canonical split

```
Django shell (permanent)
├─ topbar — brand, user, login/logout, admin
├─ sidebar — left navigation menu
└─ Angular content area
   └─ Temporary Items screen
```

Angular must not:

- Redraw or duplicate topbar/sidebar.
- Own global navigation or menu state.
- Position content relative to full viewport as a standalone SPA.

### 1.2 Data ownership

| Layer | Owns |
|---|---|
| **SyncServer** | `temporary_items` table, resolution logic, balances, operations, inventory subjects, asset registers. |
| **Warehouse_web (Django)** | Session, CSRF, BFF proxy, SPA hosting, SSR fallback, menu rendering. |
| **Warehouse_frontend (Angular)** | UI state, view models, client-side filtering/sorting/pagination UX, modal orchestration, computed statuses. |

### 1.3 Browser data path

```
Browser → Django business URL `/temporary-items/`
       → Django authenticated shell
       → Angular content area
       → Django same-origin BFF `/bff/api/v1/temporary-items/*`
       → Warehouse_web sync_client → SyncServer
```

Forbidden:

- Direct SyncServer `/api/v1/temporary-items/*` calls from Angular.
- `X-User-Token` or `X-Device-Token` in Angular code or browser storage.
- Token injection into Angular templates.

### 1.4 Roles

From `Functional and WorkLogik.md` §IV and `SyncServer/app/services/operations_policy.py`:

| Role | View list/detail | Delete | Convert to permanent | Merge with permanent | Merge temp→temp |
|---|---|---|---|---|---|
| Observer | Yes | No | No | No | No |
| Storekeeper | Yes | No | No | No | No |
| Chief storekeeper | Yes | Yes | Yes | Yes | Yes |
| Root | Yes | Yes | Yes | Yes | Yes |

All write actions require `require_temporary_item_moderation` = `chief_storekeeper` or `root`. Observer and storekeeper see the table, details, and available actions — but mutating controls are disabled/hidden.

---

## 2. Screen Registry

Per `ARCHITECTURE_FRONTEND_SPA.md` screen registry requirement:

| Field | Value |
|---|---|
| **Business URL** | `/temporary-items/` |
| **SSR fallback URL** | `/temporary-items/ssr/` (existing SSR views moved here) |
| **Angular route** | `temporary-items` (lazy-loaded feature module) |
| **Django host route** | Direct Django SPA mount rendering Angular for `/temporary-items/` |
| **Sidebar item** | Existing «Временные ТМЦ» menu link — keep, update target to new business URL |
| **BFF endpoints** | All under `/bff/api/v1/temporary-items/*` |
| **Roles** | Observer: read-only; Storekeeper: read-only; Chief/Root: full write |
| **Source specs** | `Functional and WorkLogik.md` §IV; user UX specification 2026-05-19 |
| **Migration state** | `Angular primary` after this TZ is complete |

---

## 3. BFF Contract

Existing BFF endpoints (all under `/bff/api/v1/temporary-items`):

| Method | Path | Purpose | Angular use |
|---|---|---|---|
| `GET` | `temporary-items` | Paginated list with filters | Table data source |
| `GET` | `temporary-items/{id}` | Single item detail | Modal detail |
| `GET` | `temporary-items/{id}/operations` | Related operations | Modal operations list |
| `POST` | `temporary-items/{id}/approve-as-item` | Convert to permanent (body: `TemporaryItemCreate` — name, category_id, unit_id, etc.) | Convert action |
| `POST` | `temporary-items/{id}/merge` | Merge with permanent (body: `{target_item_id, comment?}`) | Merge-to-permanent action |
| `DELETE` | `temporary-items/{id}` | Soft-delete | Delete action |

Additional BFF endpoints needed by this screen:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `bff/api/v1/catalog/items/search?q=...` | Catalog item search for merge target selection |

No new SyncServer endpoints are needed — the existing 6 endpoints cover all required operations. The `GET /operations` on a temp item already returns the operations list needed for the modal.

---

## 4. Domain Model

### 4.1 Raw SyncServer statuses

```
"active"               → Temporary item exists, not yet resolved
"approved_as_item"     → Converted to a new permanent item
"merged_to_item"       → Merged into an existing permanent item
"deleted"              → Soft-deleted
```

### 4.2 Computed UI statuses

The Angular screen must compute UI-friendly statuses from **raw status + balances + pending acceptances + operations state**:

| UI status | Rules |
|---|---|
| **Требует разбора** | `status == "active"` AND `total_balance > 0` AND no pending acceptance blocking. Default active item. |
| **Есть остаток** | `total_balance > 0` |
| **Есть незавершённая приёмка** | At least one related operation has status `created`/`pending`/`submitted` (pending acceptance). |
| **Можно преобразовать** | `status == "active"` AND no pending acceptance AND `total_balance > 0`. |
| **Можно удалить** | `status == "active"` AND `total_balance == 0` AND no pending acceptance AND no blocking operations. |
| **Преобразована** | `status == "approved_as_item"` |
| **Смержена** | `status == "merged_to_item"` |
| **Удаление заблокировано** | Would be deletable but blocked by pending acceptance or non-zero balance. |

### 4.3 Action gating

| Action | Condition | Blocked reason |
|---|---|---|
| Преобразовать в постоянную | `status == "active"`, no pending acceptance, `total_balance > 0` | «Нельзя преобразовать: временная ТМЦ участвует в незавершённой приёмке» or «Нет остатка для преобразования» |
| Слить с постоянной ТМЦ | `status == "active"`, no pending acceptance, `total_balance > 0` | Same as above |
| Слить с другой временной ТМЦ | `status == "active"`, no pending acceptance, `total_balance > 0` | Same as above |
| Удалить | `status == "active"`, `total_balance == 0`, no pending acceptance, no blocking operations | «Нельзя удалить: по временной ТМЦ есть остаток» or «Нельзя удалить: временная ТМЦ участвует в незавершённой приёмке» |

### 4.4 Unit mismatch rule for merge

When merging a temporary item (system unit `штука`) into a permanent item with a different unit (e.g. `бухта`):

- **Do not** silently add quantities with different units.
- Show a warning: «Единицы измерения не совпадают: временная ‚штука‘ → постоянная ‚бухта‘. Требуется ручное подтверждение.»
- Require explicit user confirmation before sending the merge request.
- The backend currently does not validate unit compatibility — this is a **frontend guard**. If the user confirms, the merge proceeds.

A future ADR or SyncServer change may add backend unit validation. Until then, the frontend warning is the safety net.

---

## 5. Screen Layout

### 5.1 Page structure

```
┌─ Django topbar ─────────────────────────────────────────┐
│ [brand]                        [user] [logout] [admin]   │
├─ Django sidebar ──┬─ Angular content workspace ──────────┤
│                   │                                      │
│  Склад            │  Временные ТМЦ        [Обновить] [Экспорт] │
│  ├ Номенклатура   │                                      │
│  ├ Операции       │  ┌─ Info card ────────────────────┐  │
│  ├ Остатки        │  │ Временные ТМЦ: 12              │  │
│  ├ Врем. ТМЦ  ◄── │  │ Требуют разбора: 7            │  │
│  ├ Приёмка        │  │ В незавершённой приёмке: 3     │  │
│  ├ Непринятое     │  │ Можно удалить: 2               │  │
│  ├ Выдача         │  └────────────────────────────────┘  │
│  └ ...            │                                      │
│                   │  ┌─ Filters ──────────────────────┐  │
│                   │  │ Поиск | Статус | Остаток | ...  │  │
│                   │  └────────────────────────────────┘  │
│                   │                                      │
│                   │  ┌─ Table ────────────────────────┐  │
│                   │  │ Название | Создана | Остаток |.. │  │
│                   │  │ row 1                          │  │
│                   │  │ row 2                          │  │
│                   │  │ ...                            │  │
│                   │  └────────────────────────────────┘  │
│                   │  Pagination: ◄ 1 2 3 ... ►  25/50/100│
└───────────────────┴──────────────────────────────────────┘
```

### 5.2 Info card

Always visible at top of the workspace. Explains purpose and shows live counts.

Content:

```
Временные позиции создаются для срочной приёмки, когда справочник ещё не заполнен.
Их нужно преобразовать в постоянные ТМЦ или слить с существующими.

Временные ТМЦ: {total_active}
Требуют разбора: {needs_review}
В незавершённой приёмке: {in_pending_acceptance}
Можно удалить: {can_delete}
```

Counts are derived from the current filtered dataset or separate lightweight counts. If counts come from a separate endpoint, that endpoint must be lightweight (no heavy joins).

### 5.3 Filters

| Filter | Control | Values/Source |
|---|---|---|
| Поиск | Text input | Searches `name`, `normalized_name`, `sku`, `description`, `created_by_user_id` |
| Статус | Dropdown | Все / Требует разбора / В приёмке / Можно преобразовать / Можно удалить / Преобразована / Смержена |
| Остаток | Dropdown | Все / Есть остаток / Нет остатка |
| Приёмка | Dropdown | Все / Есть незавершённая / Нет незавершённой |
| Создано | Date range | `created_after` / `created_before` |
| Создал | Text or dropdown | `created_by_user_id` / username |

Filters send parameters to `GET /bff/api/v1/temporary-items`. UI status filters (Требует разбора, Можно преобразовать, Можно удалить, В приёмке) are computed by combining SyncServer `status` filter with additional balance/operation checks where the BFF cannot filter directly. The preferred approach: fetch with `status=active` and apply client-side computed status filtering on the active set.

### 5.4 Table columns

| Column | Source | Sortable | Notes |
|---|---|---|---|
| Название | `name` (or `normalized_name`) | Yes | Primary text column |
| Создана | `created_at` | Yes | Format: `ДД.ММ.ГГГГ ЧЧ:ММ` |
| Остаток | Computed from balances | Yes | `total_balance` across all sites |
| Операции | Count from related operations | Yes | Number of operations referencing this temp item |
| Создал | `created_by_user_id` / username | Yes | Show token ID or username if available |
| Статус | Computed UI status | Yes | Badge with semantic color |
| Действия | Action buttons | No | Context-aware: [Открыть] always; [Преобразовать] [Слить] [Удалить] per role+status |

### 5.5 Table behavior

Per `Functional and WorkLogik.md` §I.6 and `ARCHITECTURE_FRONTEND_SPA.md` table contract:

- Sortable columns — sends `sort_by` and `sort_order` params to BFF, or sorts current client dataset for compute-only columns (остаток, операции).
- Pagination: 25 / 50 / 100 per page.
- Sticky table header — scroll only table body rows.
- Fixed toolbar/filter area above table.
- Default sort: **требует разбора first, then newest first** (because the screen must surface problems, not hide them).
- Visible loading skeleton, empty state («Нет временных ТМЦ»), error state, permission-denied state.

### 5.6 Row actions

Actions visible per row (context-aware, driven by role + computed UI status):

| UI status | Observer/Storekeeper | Chief/Root |
|---|---|---|
| Требует разбора | [Открыть] | [Открыть] [Преобразовать] [Слить] |
| Есть незавершённая приёмка | [Открыть] | [Открыть] |
| Можно удалить | [Открыть] | [Открыть] [Удалить] |
| Преобразована | [Открыть] | [Открыть] |
| Смержена | [Открыть] | [Открыть] |

### 5.7 Modal (row click)

Clicking a row opens a **modal overlay** inside the Angular workspace. Not a separate page.

Modal sections (top to bottom):

```
┌─ Modal: Временная ТМЦ: {name} ─────────────────── [X] ─┐
│                                                         │
│  Статус: {ui_status}                                    │
│  Создана: {created_at}                                  │
│  Создано токеном: {created_by_user_id}                  │
│  Создал пользователь: {username / если известно}        │
│  Системная категория: {category_name}                   │
│  Системная единица: {unit_symbol}                       │
│  Остаток: {total_balance} {unit}                        │
│                                                         │
│  ┌─ Остатки по складам ───────────────────────────┐    │
│  │ Основной склад              5 шт                │    │
│  │ Участок 2                   3 шт                │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─ Операции ─────────────────────────────────────┐    │
│  │ OP-2026-000127 · Приход · Проведена · 5 шт      │    │
│  │ OP-2026-000131 · Приход · Ожидает приёмки · 3 шт │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─ Действия ─────────────────────────────────────┐    │
│  │ [Преобразовать в постоянную]                     │    │
│  │ [Слить с постоянной ТМЦ]                         │    │
│  │ [Слить с другой временной ТМЦ]                   │    │
│  │ [Удалить]                                        │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─ Warning (conditional) ────────────────────────┐    │
│  │ ⚠ Эта временная ТМЦ участвует в незавершённой   │    │
│  │ приёмке. Преобразование, слияние и удаление      │    │
│  │ заблокированы до завершения приёмки.             │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

Modal dimensions and overflow:

- Modal must fit within the Angular workspace, not the full viewport.
- Scroll inside the modal body if content exceeds available height.
- Modal overlay covers the Angular content area, not the Django shell.

### 5.8 Modal sub-screens (action forms)

Each action button in the modal opens a **sub-form** inside the same modal (replace content or show as a step).

#### 5.8.1 Convert to permanent (Преобразовать в постоянную)

Form fields (analogous to creating a permanent item in nomenclature):

```
Преобразовать в постоянную ТМЦ

Название       [________________]  (prefilled with temp item name)
SKU            [________________]  (optional)
Категория      [▼ Выбрать      ]  (required, default NOT "uncategorized" — user must choose)
Единица изм.   [▼ Выбрать      ]  (required, default NOT "штука" — user must choose)
Ключевые слова [________________]  (optional, hashtags)
Описание       [________________]  (optional, textarea)
Активность     [☑ Активна       ]  (checkbox, default true)

Preview:
Временный остаток: {total_balance} {unit}
Будет создана постоянная ТМЦ
Остаток будет перенесён на новую постоянную ТМЦ

[Создать постоянную и перенести остатки]  [Отмена]
```

Required validations:

- Name is required, non-empty.
- Category is selected (not "uncategorized").
- Unit is selected (not "штука").

On submit: `POST /bff/api/v1/temporary-items/{id}/approve-as-item` with body containing `name`, `category_id`, `unit_id`, optional `sku`, `description`, `hashtags`.

The BFF currently calls `approve_as_item()` which sends an **empty body** to SyncServer. The SyncServer `approve-as-item` endpoint also accepts no request body — it creates the permanent item from the temp item's own data (name, unit_id=system default, category_id=uncategorized).

**Gap**: The current SyncServer `approve-as-item` does not accept user-chosen `category_id`, `unit_id` etc. The Angular form must either:

- **(Option A)** Send the chosen values to a **new or updated BFF endpoint** that first updates the backing item's category/unit, then calls `approve-as-item`.
- **(Option B)** Keep the current flow (no body) and let the user edit the resulting permanent item in nomenclature afterward.

**Decision**: Option A is preferred but requires a small SyncServer + BFF change (add optional body to `approve-as-item`). Until that backend change is done, implement Option B with a note: «После преобразования вы сможете изменить категорию и единицу измерения в справочнике номенклатуры.» The Stream B agent (section 7) must decide and document the chosen approach.

#### 5.8.2 Merge with permanent (Слить с постоянной ТМЦ)

```
Слить с постоянной ТМЦ

[Поиск постоянной ТМЦ по названию, SKU, ключевым словам]
  → debounced search, min 2 characters

Выбранная постоянная:
{name}
SKU: {sku}
Категория: {category_path}
Ед.: {unit_symbol}

Временный остаток: {temp_balance} {temp_unit}
Текущий остаток постоянной: {perm_balance} {perm_unit}
После слияния: {merged_balance} {perm_unit}

⚠ Если единицы не совпадают: предупреждение (см. §4.4)

[Слить с выбранной ТМЦ]  [Отмена]
```

On submit: `POST /bff/api/v1/temporary-items/{id}/merge` with body `{target_item_id, comment?}`.

Search target: `GET /bff/api/v1/catalog/items/search?q=...` (or equivalent catalog search BFF endpoint).

#### 5.8.3 Merge with another temporary item (Слить с другой временной ТМЦ)

```
Слить с другой временной ТМЦ

Исходная: {source_name} · {source_balance} {source_unit}

Целевая временная:
[Поиск временной ТМЦ]
  → search among active temp items, exclude self

После слияния:
Целевая временная ТМЦ получит суммарный остаток
Исходная станет смерженной/удаляемой

⚠ Это операция второго этапа. Рекомендуется сначала попробовать слияние с постоянной ТМЦ.

[Слить с выбранной временной ТМЦ]  [Отмена]
```

**Gap**: SyncServer currently has **no `merge temp→temp` endpoint** (per audit IV.3.1). This action requires a new SyncServer endpoint and corresponding BFF wrapper. Until implemented, the button should be present but **disabled with a tooltip**: «Слияние временных ТМЦ между собой будет доступно в следующем обновлении.» This is a deferred item — not blocking Angular screen acceptance.

#### 5.8.4 Delete (Удалить)

```
Удалить временную ТМЦ

Вы уверены, что хотите удалить «{name}»?

Остаток: {total_balance} (должен быть 0)
Операций: {operations_count}
Статус приёмки: {acceptance_status}

[Удалить]  [Отмена]
```

If not deletable (balance > 0 or pending acceptance), the delete button in the modal is **disabled** with an inline reason.

On submit: `DELETE /bff/api/v1/temporary-items/{id}`.

After successful delete, close modal and refresh table (or remove row optimistically).

---

## 6. Dashboard Reminder Card

The Django dashboard (`/client/` or future `/dashboard/`) must show a temporary items card. This is a **Django template change**, not Angular.

Current state: dashboard already shows `temp_item_count` via `TemporaryItemsAPI.list_temporary_items_page(filters={"status": "active", "page_size": 1})`.

Required enhancement:

```
┌─ Временные ТМЦ ──────────────────────────────────────┐
│                                                       │
│  Всего активных: 12                                   │
│                                                        │
│  7 требуют разбора                                    │
│  3 ожидают завершения приёмки                          │
│  2 можно удалить                                      │
│                                                        │
│  [Открыть временные ТМЦ]                              │
└───────────────────────────────────────────────────────┘
```

The card links to the new Angular business URL `/temporary-items/`.

The detailed counts (требуют разбора, ожидают приёмки, можно удалить) require additional BFF or SyncServer queries. If a lightweight count endpoint does not exist, the card may show only the total active count with a note «Требуют разбора» until a count-by-status endpoint is available. This is acceptable for initial delivery.

---

## 7. Orchestrator Implementation Levels And Workstreams

### 7.1 Launch order

1. **Stream A** first (Django host/route migration) — unlocks `/temporary-items/` URL for Angular.
2. **Stream B** next (Angular foundation: models, service, routes) — other streams depend on it.
3. **Stream C** and **Stream D** in parallel after A+B are stable.
4. **Stream E** after C+D produce testable UI.
5. Orchestrator final merge, build verification, evidence collection.

### 7.2 Parallel subagent streams

| Stream | Name | Files owned | Delivers |
|---|---|---|---|
| **A** | Django SPA host for `/temporary-items/` | `Warehouse_web/config/urls.py`, `Warehouse_web/apps/catalog/views.py` (SPA host), `Warehouse_web/templates/temporary_items/*` (SSR move), `Warehouse_web/apps/temporary_items/urls.py` (SSR → `/ssr/`) | `/temporary-items/` direct Angular mount; `/temporary-items/ssr/` SSR fallback; sidebar link update; Django route tests. |
| **B** | Angular foundation: models, service, BFF client, route | `Warehouse_frontend/src/app/core/models/temp-items.models.ts`, `src/app/core/services/temp-items.service.ts`, `src/app/core/api/temp-items-bff-api.service.ts`, `src/app/app.routes.ts`, `src/app/features/temporary-items/` skeleton | Typed `TemporaryItem` DTO (full), `TemporaryItemVm` with computed UI status, `TempItemsService` with all BFF calls, Angular route + lazy feature module. |
| **C** | Table, filters, info card | `src/app/features/temporary-items/pages/temp-items-page.*`, `src/app/features/temporary-items/components/temp-items-table.*`, `src/app/features/temporary-items/components/temp-items-filters.*`, `src/app/features/temporary-items/components/temp-items-info-card.*` | Working list screen with info card, filters (search/status/balance/acceptance/date/creator), sortable paginated table, computed UI statuses, sticky header, action buttons per role. |
| **D** | Modal: detail, actions, sub-forms | `src/app/features/temporary-items/components/temp-item-detail-modal.*`, `src/app/features/temporary-items/components/temp-item-convert-form.*`, `src/app/features/temporary-items/components/temp-item-merge-permanent-form.*`, `src/app/features/temporary-items/components/temp-item-merge-temp-form.*`, `src/app/features/temporary-items/components/temp-item-delete-form.*` | Modal with detail, balances per site, operations list, action buttons with gating, convert/merge/delete sub-forms with validation. |
| **E** | Tests, Playwright, evidence | `src/app/features/temporary-items/**/*.spec.ts`, `Warehouse_web/apps/bff_api/tests.py` (temp items), Django route tests, evidence table | Unit tests (service, mapper, VM logic), component tests (table, modal, forms), BFF integration tests, Playwright user scenarios, evidence collection. |

### 7.3 File conflict guardrails

| File pattern | Owned by | Rule |
|---|---|---|
| `Warehouse_web/config/urls.py` | Stream A | Other streams do not edit. |
| `Warehouse_web/apps/temporary_items/urls.py` | Stream A | Other streams do not edit. |
| `Warehouse_web/templates/temporary_items/*` | Stream A | Other streams do not edit. |
| `src/app/app.routes.ts` | Stream B | Stream A (if touching Angular routes) must coordinate with B. |
| `src/app/core/models/temp-items.models.ts` | Stream B | Other streams read, do not edit. |
| `src/app/core/services/temp-items.service.ts` | Stream B | Streams C/D read, do not edit. |
| `src/app/features/temporary-items/pages/*` | Stream C | Streams D/E read, do not edit. |
| `src/app/features/temporary-items/components/temp-items-*` (table, filters, info-card) | Stream C | Stream D reads info-card for modal context. |
| `src/app/features/temporary-items/components/temp-item-*` (detail-modal, forms) | Stream D | Stream E reads for tests. |
| `src/app/features/temporary-items/**/*.spec.ts` | Stream E | Other streams do not edit. |
| `src/styles/**` | Shared (see `TZ_FRONTEND_SHARED_STYLE_SYSTEM.md`) | Use `wh-*` primitives only. No per-stream style files. |

### 7.4 Subagent report format

Each subagent must return:

```markdown
## Stream {X}: {name}

### Files changed
- `path/to/file` — what changed

### Checks run
| Command | Result |
|---|---|
| `npm run build` | pass/fail |
| `python manage.py test ...` | pass/fail |

### Evidence
- Test log paths
- Screenshot paths (if UI)
- Playwright report paths (if e2e)

### Blockers
- Item — status
```

### 7.5 Orchestrator merge gates

| Gate | Prerequisites | Verification |
|---|---|---|
| **Gate 1** | Stream A complete | `/temporary-items/` serves Angular; `/temporary-items/ssr/` serves old SSR; Django route tests pass. |
| **Gate 2** | Stream B complete | `npm run build` passes; service unit tests pass. |
| **Gate 3** | Streams C + D complete, merged | Table renders with real/computed data; modal opens on row click; actions gated correctly; `npm run build` passes. |
| **Gate 4** | Stream E complete | Unit/component/integration tests pass; Playwright user scenarios pass; evidence table filled. |
| **Gate 5** | All gates passed + dashboard card | Orchestrator final verification; acceptance checklist review. |

---

## 8. Implementation Levels Detail

### L0 — Context and contract verification

Tasks:

- [ ] Re-read `Functional and WorkLogik.md` §IV and `ARCHITECTURE_FRONTEND_SPA.md`.
- [ ] Verify all 6 BFF endpoints are operational with a real or mock SyncServer.
- [ ] Confirm the catalog search endpoint exists or document the gap for merge-to-permanent search.
- [ ] Record current SyncServer `approve-as-item` body handling gap (see §5.8.1).
- [ ] Record temp→temp merge endpoint gap (see §5.8.3).
- [ ] Confirm dashboard Django view can support enhanced card.
- [ ] Completion report: state gaps, decisions, BFF endpoint inventory.

### L1 — Django SPA host and route migration (Stream A)

Tasks:

- [ ] Add Django SPA host view or reuse existing `SPAView`/`OperationsSPAView` pattern for `/temporary-items/`.
- [ ] Move existing SSR URL patterns from `apps/temporary_items/urls.py` under `/temporary-items/ssr/` (keep old patterns).
- [ ] Wire the Angular SPA host to render for `/temporary-items/`.
- [ ] Update sidebar link target to `/temporary-items/`.
- [ ] Update SSR templates if they contain hardcoded `/temporary-items/` links that should now point to `/temporary-items/ssr/`.
- [ ] Verify: `/temporary-items/` → Angular; `/temporary-items/ssr/` → SSR list; `/temporary-items/ssr/5/` → SSR detail; refresh on both works.
- [ ] Add Django route tests for the new SPA host and SSR fallback.

Acceptance:

- [ ] Direct navigation to `/temporary-items/` renders Angular inside Django shell.
- [ ] Browser refresh on `/temporary-items/` works (no 404).
- [ ] Old SSR is reachable at `/temporary-items/ssr/` and `/temporary-items/ssr/{id}/`.
- [ ] Sidebar «Временные ТМЦ» opens `/temporary-items/`.
- [ ] Django route tests pass.

### L2 — Angular foundation (Stream B)

Tasks:

- [ ] Expand `TemporaryItem` DTO: add `normalized_name`, `unit_id`, `unit_name`, `unit_symbol`, `category_id`, `category_name`, `description`, `hashtags`, `resolution_type`, `resolved_item_id`, `resolved_by_user_id`, `resolved_at`, `updated_at`, `backing_item_is_active`, `created_by_user_id` (full).
- [ ] Add `TemporaryItemVm` view model with computed UI status, action flags, total balance.
- [ ] Add `TempItemBalancePerSite` and `TempItemOperation` DTOs for modal.
- [ ] Create `TempItemsService` with methods: `loadList(filters, sort, pagination)`, `loadDetail(id)`, `loadOperations(id)`, `approveAsItem(id, body)`, `mergeToPermanent(id, targetItemId, comment?)`, `deleteItem(id)`.
- [ ] Create `TempItemsBffApiService` or reuse existing `bff-api.service.ts` (add temp-items paths).
- [ ] Add `temporary-items` lazy route in `app.routes.ts`.
- [ ] Create feature skeleton: `features/temporary-items/` with `pages/`, `components/`, `services/`, `models/` folders.
- [ ] Create `TempItemsStateService` (or use standalone signals in page) for list state management.

Acceptance:

- [ ] `npm run build` passes.
- [ ] Service unit tests for loadList parameters, UI status computation, action flags.
- [ ] Mocked BFF responses in tests.

### L3 — Table, filters, info card (Stream C)

Tasks:

- [ ] Build `temp-items-page` component as the main page, orchestrating info card + filters + table.
- [ ] Build `temp-items-info-card` showing live counts.
- [ ] Build `temp-items-filters` with all filter controls and debounced search.
- [ ] Build `temp-items-table` with columns, sorting, pagination, sticky header.
- [ ] Compute UI statuses from raw data.
- [ ] Apply role-based action button visibility per row.
- [ ] Default sort: requires review first, then newest first (see §5.5).
- [ ] Pagination: 25 / 50 / 100.
- [ ] Loading skeleton, empty state, error state, permission-denied state.
- [ ] Use `wh-*` shared primitives for table, badges, buttons, cards, loading/error/empty states.

Acceptance:

- [ ] Table renders with mock data; 7 columns visible.
- [ ] Sorting sends/receives sort parameters correctly.
- [ ] Pagination changes page and page size.
- [ ] Info card shows live counts matching data.
- [ ] Filters change table content (client-side or server-side).
- [ ] UI status badges use `wh-badge--{status}` classes.
- [ ] Observer/Storekeeper sees only [Открыть]; Chief/Root sees full actions.
- [ ] `npm run build` passes.
- [ ] Component tests for table, filters, info-card.

### L4 — Modal and action forms (Stream D)

Tasks:

- [ ] Build `temp-item-detail-modal` with sections: metadata, balances per site, operations list, action buttons, conditional warning.
- [ ] Build `temp-item-convert-form` (see §5.8.1).
- [ ] Build `temp-item-merge-permanent-form` with search + selection (see §5.8.2).
- [ ] Build `temp-item-merge-temp-form` (see §5.8.3) — disabled with tooltip until backend exists.
- [ ] Build `temp-item-delete-form` with confirmation and gating (see §5.8.4).
- [ ] Implement action gating per §4.3 — disabled buttons with reason tooltips.
- [ ] Implement unit mismatch warning for merge-to-permanent (§4.4).
- [ ] Implement double-submit protection for all POST/DELETE actions.
- [ ] After successful action, close modal and refresh table.
- [ ] After failed action, show inline error in modal.

Acceptance:

- [ ] Row click opens modal with detail data.
- [ ] Balances per site list renders.
- [ ] Operations list renders with type/status/qty.
- [ ] Warning shows when item has pending acceptance.
- [ ] Convert form validates required fields.
- [ ] Merge-to-permanent search finds items and shows preview.
- [ ] Unit mismatch warning shows when units differ.
- [ ] Delete button disabled when balance > 0 with reason shown.
- [ ] Double-submit blocked.
- [ ] `npm run build` passes.
- [ ] Component tests for modal and each form.

### L5 — Dashboard card enhancement (Django)

Tasks:

- [ ] Update `Warehouse_web/apps/client/views.py` dashboard context: add detailed temp item counts (requires new BFF or SyncServer call for breakdown).
- [ ] Update `Warehouse_web/templates/client/dashboard.html`: enhanced card with breakdown counts.
- [ ] Link card to `/temporary-items/` (new Angular URL).

If detailed counts require a new lightweight endpoint, this is a **Django + BFF** task (Stream A scope extension or new sub-stream).

Acceptance:

- [ ] Dashboard shows temporary items card with at least total active count and link.
- [ ] Card links to `/temporary-items/`.
- [ ] Django dashboard tests pass.

### L6 — Tests and evidence (Stream E)

Tasks:

- [ ] Unit tests: `TempItemsService`, status computation, action gating logic, mapper functions.
- [ ] Component tests: table rendering, filter interaction, modal open/close, form validation, action gating.
- [ ] Integration tests: BFF endpoints exercised through service mocks or real stand.
- [ ] Playwright user scenarios (see section 10).
- [ ] Evidence collection: logs, screenshots, test reports.

Acceptance:

- [ ] All unit tests pass.
- [ ] All component tests pass.
- [ ] Playwright scenarios A–E pass.
- [ ] Evidence table filled in section 13.

---

## 9. Real Test Stand Requirement

### 9.1 Stand description

| Component | Details |
|---|---|
| **PostgreSQL** | SyncServer database, Alembic migrations applied, seed data present. |
| **SyncServer** | Running at `http://localhost:8000`, health at `/api/v1/health`. |
| **Django** | Running at `http://localhost:8001`, health at `/healthz/`. |
| **Angular** | Built assets served by Django or dev server. |

### 9.2 Required seed data

- Users: admin (root), chief, storekeeper, observer — each with known credentials.
- Sites: Основной склад, Участок 2, Резерв.
- Categories: at least «Кабельная продукция / Витая пара», «Фильтры», «uncategorized».
- Units: штука, бухта, метр.
- Permanent catalog items: UTP Cat5e 305м (SKU: CBL-UTP-5E-305, unit: бухта, category: Кабельная продукция).
- Temporary items (minimal):
  - Active with balance > 0, no pending acceptance → «Требует разбора», actions available.
  - Active with balance > 0, has pending acceptance → «В приёмке», actions blocked.
  - Active with balance = 0, no pending acceptance → «Можно удалить».
  - `approved_as_item` → «Преобразована».
  - `merged_to_item` → «Смержена».
- At least one temp item with operations referencing it.
- Balances for temp items across multiple sites.

### 9.3 Environment variables (names only)

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

### 9.4 Health checks

| Service | Endpoint | Expected |
|---|---|---|
| SyncServer | `GET http://localhost:8000/api/v1/health` | 200 |
| Django | `GET http://localhost:8001/healthz/` | 200 |
| BFF temp items list | `GET http://localhost:8001/bff/api/v1/temporary-items?page=1&page_size=1` | 200 JSON |
| Angular screen | `GET http://localhost:8001/temporary-items/` | 200 HTML + Angular bootstraps |

### 9.5 Smoke commands

```bash
# Angular
cd Warehouse_frontend; npm run build

# Django
cd Warehouse_web; python manage.py check
cd Warehouse_web; python manage.py test apps.bff_api apps.temporary_items

# Stand verification (requires stand running)
curl http://localhost:8001/bff/api/v1/temporary-items?page=1&page_size=5
curl http://localhost:8001/temporary-items/
```

---

## 10. Test Strategy Ladder

| Level | Name | Applied | Notes |
|---|---|---|---|
| 1 | Static checks | Yes | `npm run build` (TypeScript + Angular compiler); `python manage.py check` |
| 2 | Unit tests | Yes | `TempItemsService`, status computation, action gating, mapper, form validation |
| 3 | Component tests | Yes | Table rendering, filter interaction, modal, convert/merge/delete forms |
| 4 | Integration tests | Yes | Angular service ↔ BFF (mocked or real); Django BFF ↔ SyncServer; Django route tests |
| 5 | Stand smoke tests | Yes | Against real SyncServer + PostgreSQL (see §9) |
| 6 | UI automation | Yes | Playwright scenarios (see §11) |
| 7 | User scenarios | Yes | See §11 |
| 8 | Regression pack | Yes | Dashboard temp count; existing operations with temp items; nomenclature item search; auth redirects; SSR fallback |
| 9 | Acceptance review | Yes | Evidence table + final checklist |

Non-applicable: Rust/mobile/WPF checks (this is a browser-only Angular screen).

---

## 11. Required User Scenarios (Playwright)

### Scenario A: List and filter

1. Login as chief storekeeper.
2. Navigate to `/temporary-items/`.
3. Verify: Django topbar and sidebar visible; Angular renders inside content area.
4. Verify: info card shows live counts.
5. Apply search filter — table updates.
6. Apply status filter — table updates.
7. Change page size to 50 — 50 rows shown.
8. Sort by «Создана» — order changes, sort indicator visible.
9. Verify: «Требует разбора» items appear first in default sort.

### Scenario B: Modal detail

1. Click row for active temp item with balance.
2. Verify: modal opens inside Angular workspace.
3. Verify: metadata section shows name, created date, creator, category, unit, balance.
4. Verify: balances per site list shows correct sites and quantities.
5. Verify: operations list shows related operations with type/status/qty.
6. Close modal — table still visible behind.

### Scenario C: Convert to permanent (chief/root)

1. Open modal for active temp item with balance > 0, no pending acceptance.
2. Click «Преобразовать в постоянную».
3. Fill form: name, category, unit.
4. Verify: preview shows balance transfer info.
5. Click «Создать постоянную и перенести остатки».
6. Verify: success notification; modal closes; table refreshes; item now shows «Преобразована».

### Scenario D: Merge with permanent

1. Open modal for active temp item with balance > 0.
2. Click «Слить с постоянной ТМЦ».
3. Search for "UTP Cat5e".
4. Select result.
5. Verify: preview shows source balance, target balance, merged balance.
6. Verify: if units differ, warning is shown.
7. Click «Слить с выбранной ТМЦ».
8. Verify: success; item now shows «Смержена».

### Scenario E: Delete (zero balance, no pending acceptance)

1. Open modal for active temp item with balance = 0, no pending acceptance.
2. Verify: «Удалить» button is enabled.
3. Click «Удалить».
4. Confirm.
5. Verify: success; row removed from table.

### Scenario F: Permission restrictions (observer)

1. Login as observer.
2. Navigate to `/temporary-items/`.
3. Verify: table visible.
4. Verify: only [Открыть] button visible; no [Преобразовать], [Слить], [Удалить].
5. Open modal.
6. Verify: all action buttons disabled or hidden.

### Scenario G: Blocked by pending acceptance

1. Open modal for temp item with pending acceptance.
2. Verify: warning banner visible.
3. Verify: all action buttons disabled with reason tooltips.

---

## 12. Regression Pack

| Flow | Check |
|---|---|
| Dashboard temp item count | Card still shows active count; links to new `/temporary-items/`. |
| Operations — create with temp item | Creating a RECEIVE operation with inline temp item still works end-to-end. |
| Nomenclature catalog search | Searching for items (used in merge-to-permanent) still works. |
| Auth redirect | Unauthenticated access to `/temporary-items/` redirects to Django login. |
| BFF health | `GET /bff/api/v1/temporary-items?page=1&page_size=1` returns 200. |
| SSR fallback | `/temporary-items/ssr/` renders old Django template. |
| Django admin | Admin panel still functional. |
| Existing operations SSR | Old operations SSR views unaffected by temp items route migration. |

---

## 13. Evidence Table

### 13.1 Orchestrator stream evidence

| Stream | Owner | Status | Files changed | Checks | Evidence |
|---|---|---|---|---|---|
| A — Django host | | Not started | | | |
| B — Angular foundation | | Not started | | | |
| C — Table, filters, info card | | Not started | | | |
| D — Modal, actions, forms | | Not started | | | |
| E — Tests, Playwright, evidence | | Not started | | | |

### 13.2 Verification evidence

| Check | Command / Tool | Result | Evidence |
|---|---|---|---|
| Static checks | `npm run build` | | |
| Static checks | `python manage.py check` | | |
| Unit tests | `npm test -- --watch=false` | | |
| Unit tests | `python manage.py test apps.bff_api` | | |
| Component tests | `npm test -- --watch=false` | | |
| Integration tests | `python manage.py test` (Django) | | |
| Stand smoke | `curl` health + BFF endpoints | | |
| UI automation | Playwright scenarios A–G | | |
| Regression | See §12 checks | | |

---

## 14. Risks And Blockers

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | SyncServer `approve-as-item` does not accept user-chosen category/unit | Medium | Option B in §5.8.1: convert with system defaults, user edits in nomenclature afterward. Document the gap. |
| R2 | No `merge temp→temp` SyncServer endpoint | Low | Button disabled with tooltip «будет доступно в следующем обновлении». Not blocking Angular acceptance. |
| R3 | No BFF endpoint for detailed temp item counts (dashboard card) | Low | Dashboard shows only total active count initially. Detailed breakdown deferred. |
| R4 | Catalog search BFF endpoint may not exist for merge target selection | Medium | Verify early in L0. If missing, create minimal `/bff/api/v1/catalog/items/search` wrapper. |
| R5 | SSR templates may contain links pointing to old non-`/ssr/` paths | Low | Stream A audits and fixes during route migration. |
| R6 | Playwright not configured in Warehouse_frontend | High | Stream E must set up Playwright config or coordinate with existing Django e2e tests. |
| R7 | Real stand may be unavailable during development | Medium | Mocked BFF responses for unit/component tests; leave stand items unchecked with «стенд недоступен» blocker. |

Blockers from audit IV:

| Gap | Status | This TZ handles? |
|---|---|---|
| IV.0 — No system default unit fallback | Backend gap | Deferred to SyncServer TZ |
| IV.2.1 — No balance column; no sorting; no sticky headers | SSR gap | **Yes** — Angular table fixes all three |
| IV.2.2 — Detail is page not modal; ops list not shown | SSR gap | **Yes** — Angular modal with detail + operations |
| IV.2.3 — Resolved items remain visible | SSR gap | **Yes** — Default filter to active; resolved items have distinct status |
| IV.3.1 — No temp→temp merge | Backend gap | **Deferred** — Button disabled with tooltip (R2) |

---

## 15. Final Acceptance Criteria

- [ ] `/temporary-items/` renders Angular inside Django shell (topbar + sidebar visible, Angular in content area).
- [ ] `/temporary-items/ssr/` serves old SSR as fallback.
- [ ] Info card shows live counts of active, needs-review, pending-acceptance, can-delete items.
- [ ] Table has 7 columns: Название, Создана, Остаток, Операции, Создал, Статус, Действия.
- [ ] Table supports sorting (all columns except Действия), default sort: needs-review first, newest first.
- [ ] Table supports pagination 25/50/100 with sticky header.
- [ ] Filters: search, UI status, balance presence, pending acceptance, date range, creator.
- [ ] UI statuses computed correctly from raw status + balances + pending acceptances.
- [ ] Row click opens modal with detail, balances per site, operations list, action buttons.
- [ ] Action buttons gated per §4.3 — disabled with reason tooltips.
- [ ] Convert-to-permanent form works (Option A or B per §5.8.1).
- [ ] Merge-to-permanent form works with search and unit mismatch warning.
- [ ] Merge-temp-to-temp button present but disabled with deferred tooltip.
- [ ] Delete button only enabled when balance = 0 and no pending acceptance.
- [ ] Observer/Storekeeper see read-only view; Chief/Root see full actions.
- [ ] Dashboard card links to `/temporary-items/`.
- [ ] No direct SyncServer calls from browser; no tokens in Angular code.
- [ ] `npm run build` passes.
- [ ] Django route tests pass.
- [ ] Angular unit + component tests pass.
- [ ] Playwright scenarios A–G pass.
- [ ] Evidence table filled.
- [ ] Route migration matrix updated: temporary items → `Angular primary`.

---

## 16. Out Of Scope

- SyncServer endpoint changes (new endpoints, body format changes) — separate TZ required.
- Temp→temp merge backend implementation — separate TZ required.
- Full catalog search BFF endpoint if missing — may be added as minimal wrapper, but full catalog search redesign is out of scope.
- PDF/document generation for temporary items.
- Mobile/desktop client temporary items screens.
- Dynamic Django sidebar menu — separate future TZ.
- Acceptance screen (приёмка) for temporary items — separate TZ per `Functional and WorkLogik.md` §II.4.
