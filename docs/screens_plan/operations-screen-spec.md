# UI Spec: Warehouse Angular — Operations Screen

> Экран `/operations` — журнал складских документов. Создание, редактирование и подтверждение операции идут через модальные окна поверх списка.  
> Приёмка в эту спецификацию НЕ входит: это отдельный экран/окно сверки факта “ожидалось / приехало / расхождение”.

---

## 1. Назначение экрана

Название:

```text
Операции
```

Route:

```text
/operations
```

Главный смысл:

```text
Показать список складских операций, дать фильтры, открыть создание/редактирование черновика и подтвердить черновик операции.
```

Ключевое доменное правило:

```text
Подтверждение операции ≠ приёмка.

Подтверждение:
черновик становится полноценной операцией / документом движения.

Приёмка:
отдельная сверка товара по количеству: сколько ожидалось, сколько фактически приехало, есть ли расхождение.
```

---

## 2. Важное ограничение layout

Angular НЕ рисует общий shell.

Django уже даёт:
- верхнюю панель;
- левую sidebar;
- пользователя/admin/logout;
- глобальную навигацию.

Angular должен рисовать только правую рабочую область.

```text
Django shell
├─ top navbar
├─ left sidebar
└─ Angular content area
   └─ /operations
      ├─ page header
      ├─ filters card
      ├─ operations table
      └─ modal overlays
```

Не рисовать повторно:
- top navbar;
- sidebar;
- logout;
- admin controls;
- общий app shell.

---

## 3. Figma / screenshot references

Ожидаемые картинки для агента:

```text
operations-clean-list.png
operation-create-modal.png
operation-confirm-modal.png
```

Текущие Figma frame names:

```text
Операции Django v2 — список + модалка создания
Операции Django v2 — подтверждение черновика
Операции Django v2 — чистый список
```

Если чистого списка нет, его можно получить вручную:
- duplicate frame `Операции Django v2 — список + модалка создания`;
- удалить `Modal overlay`;
- удалить `Operation create modal`;
- переименовать в `Операции Django v2 — чистый список`.

---

## 4. Target stack

```text
Angular + TypeScript + HTML + SCSS
```

Правила:
- не добавлять Tailwind, если его нет в проекте;
- не добавлять новую UI-библиотеку без необходимости;
- соблюдать существующий Angular project style;
- не хардкодить токены;
- не вызывать HTTP из table row / modal child components напрямую.

---

## 5. API facts

Base API prefix:

```text
/api/v1
```

Operations API:

```http
GET    /api/v1/operations
GET    /api/v1/operations/{operation_id}
POST   /api/v1/operations
PATCH  /api/v1/operations/{operation_id}
POST   /api/v1/operations/{operation_id}/submit
POST   /api/v1/operations/{operation_id}/cancel
```

Operations list query parameters:

```text
site_id
type
status
created_by_user_id
created_after
created_before
updated_after
updated_before
search
page
page_size
```

Auth header:

```text
X-User-Token: <uuid>
```

Read roles:

```text
root
chief_storekeeper
storekeeper
observer
```

Write roles:

```text
root
chief_storekeeper
storekeeper
```

MOVE rule:

```text
MOVE requires both source_site_id and destination_site_id.
```

Catalog read endpoints useful for modal item search/cache:

```http
GET /api/v1/catalog/items
GET /api/v1/catalog/categories
GET /api/v1/catalog/categories/tree
GET /api/v1/catalog/units
GET /api/v1/catalog/sites
```

Balances endpoints useful for quantity hints:

```http
GET /api/v1/balances
GET /api/v1/balances/by-site
GET /api/v1/balances/summary
```

---

## 6. Domain model summary

Operation is a warehouse movement document.

Operation fields:

```text
id
type
status
created_by
source_site_id
target_site_id
person_name
comment
created_at
updated_at
```

Operation item fields:

```text
operation_id
item_id
quantity
```

Known statuses:

```text
draft
created
pending
submitted
rejected
cancelled
```

UI labels:

```text
draft       → Черновик
created     → Подтверждена / Создана
pending     → Ожидает подтверждения / Ожидает приёмки
submitted   → Проведена
rejected    → Отклонена
cancelled   → Отменена
```

MVP operation types:

```text
RECEIVE       → Приход
MOVE          → Перемещение
ISSUE         → Выдача
ISSUE_RETURN  → Возврат выдачи
```

---

## 7. Role and permission rules

### root

Can:
- view all operations;
- create operations on any site;
- confirm operations;
- cancel operations;
- perform admin actions.

### chief_storekeeper

Can:
- view all operations;
- create operations on any site;
- confirm operations;
- cancel operations within business rules.

### storekeeper

Can:
- view operations;
- create operations only from own working site;
- edit own draft operations if server allows;
- cancel own draft operations if server allows;
- cannot confirm operations.

Important UI rule:

```text
For storekeeper, source_site_id is fixed to user's working site and must not be freely selected as another source site.
```

### observer

Can:
- view operations;
- cannot create operations;
- cannot edit operations;
- cannot confirm operations;
- cannot cancel operations.

UI may hide/disable forbidden actions, but SyncServer remains source of truth.

---

## 8. Screen layout

Target screenshot size:

```text
1920x1080
```

Approximate existing Django shell:

```text
topbar height: 58px
sidebar width: 220px
content x-start: 244px
content width: about 1632px
```

Angular content layout:

```text
Операции                                      [+ Создать операцию] [Приёмка] [Экспорт]
Журнал складских операций: черновики, подтверждение и проведённые документы.

┌───────────────────────────────────────────────────────────────────────────┐
│ Фильтры и поиск                                                           │
│ [Поиск] [Тип операции] [Статус] [Склад] [Период] [Автор] [Только мои]      │
│ [Все] [Черновики] [На подтверждении] [Ожидают приёмки] [Проведённые]      │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│ Список операций                                                           │
│ Операция/дата | Тип | Статус | Направление | Ответственный | Строки | ... │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Header actions

Buttons:

```text
+ Создать операцию
Приёмка
Экспорт
```

Behavior:
- `+ Создать операцию`: opens create/edit modal in create mode;
- `Приёмка`: navigates to future acceptance screen;
- `Экспорт`: future action, may be disabled/stubbed.

---

## 10. Filters card

Fields:
- `Поиск`
- `Тип операции`
- `Статус`
- `Склад`
- `Период`
- `Автор`
- `Только мои`
- `Сбросить`

Search placeholder:

```text
номер, ТМЦ, SKU, получатель, комментарий
```

Behavior:
- search filters by operation number, item name, SKU, recipient/person name, comment;
- type filters by operation type;
- status filters by operation status;
- site filters by source/target site;
- period filters by created date;
- author filters by `created_by_user_id`;
- `Только мои` filters by current user.

---

## 11. Status tabs

Quick tabs:

```text
Все
Черновики
На подтверждении
Ожидают приёмки
Проведённые
Отменённые
```

Suggested mapping:

```ts
const statusTabs = [
  { key: 'all', label: 'Все', status: null },
  { key: 'drafts', label: 'Черновики', status: 'draft' },
  { key: 'confirm', label: 'На подтверждении', status: 'created' },
  { key: 'acceptance', label: 'Ожидают приёмки', status: 'pending' },
  { key: 'submitted', label: 'Проведённые', status: 'submitted' },
  { key: 'cancelled', label: 'Отменённые', status: 'cancelled' },
];
```

Exact mapping must be aligned with backend status semantics.

---

## 12. Operations table

Columns:

```text
Операция / дата
Тип
Статус
Направление / склад
Ответственный
Строки
Действия
```

Example rows:

```text
OP-2026-000128
19.05.2026 14:20
Перемещение
Ожидает приёмки
Основной склад → Участок 2
admin
5 строк

OP-2026-000127
19.05.2026 12:10
Приход
Черновик
Поставщик Альфа → Основной склад
admin
3 строки

OP-2026-000126
18.05.2026 16:44
Выдача
Проведена
Основной склад → Иванов И.И.
storekeeper
2 строки
```

Row behavior:
- click row: open operation detail modal/panel;
- hover row: show quick action buttons;
- draft row: `Открыть`, `Подтвердить`, `...`;
- awaiting acceptance row: `Открыть`, `Приёмка`, `...`;
- submitted row: `Открыть`, `Печать`, `...`.

---

## 13. Visual states

### Type badges

```text
Перемещение → blue badge
Приход      → green badge
Выдача      → yellow badge
Возврат     → gray badge
```

### Status badges

```text
Черновик          → gray badge
Подтверждена      → blue badge
Ожидает приёмки   → yellow badge
Проведена         → green badge
Отменена          → red badge
```

### Row hover

```scss
background: #F8FAFC;
show actions;
```

---

## 14. Create/edit operation modal

Used for:
- creating new operation;
- editing existing draft;
- opening prefilled operation from `/balances`.

Modal title examples:

```text
Новая операция: Перемещение
Редактирование черновика: OP-2026-000127
```

Modal badge:

```text
Черновик
```

Top fields:
- `Тип операции`
- `Откуда`
- `Куда`
- `Получатель`
- `Комментарий`

### Field visibility by operation type

RECEIVE:
- type visible;
- destination site required;
- source may be supplier/source text;
- recipient hidden/disabled;
- comment visible.

MOVE:
- type visible;
- source site required;
- destination site required;
- recipient hidden/disabled;
- comment visible.

ISSUE:
- type visible;
- source site required;
- destination site hidden/disabled;
- recipient required;
- comment visible.

ISSUE_RETURN:
- type visible;
- recipient/person context required;
- destination site required;
- comment visible.

---

## 15. Cached item search

Section title:

```text
Поиск ТМЦ из кеша Django
```

Search placeholder:

```text
UTP Cat5e, перфоратор, фильтр...
```

Search sources:
- Django local catalog cache;
- item name;
- SKU;
- keywords/hashtags;
- category if available.

Search result must show:
- item name;
- SKU;
- category;
- unit;
- current stock hint for selected source site if relevant.

After selecting item:
- add it to operation lines;
- do not immediately call server unless user saves/submits draft.

---

## 16. Temporary item creation

Button:

```text
Создать временную ТМЦ
```

Purpose:
- allow temporary item when permanent catalog item is not found.

Temporary item fields:
- name;
- unit;
- approximate category;
- comment;
- keywords.

Rules:
- RECEIVE: temporary item allowed;
- MOVE: temporary item should be forbidden unless there is existing temporary stock/balance;
- ISSUE: temporary item forbidden;
- ISSUE_RETURN: temporary item generally forbidden.

UI badge:

```text
временная ТМЦ
```

---

## 17. Operation lines table

Columns:

```text
ТМЦ
SKU / статус
На складе
Количество
Ед.
Ошибка
Действия
```

Example normal line:

```text
UTP Cat5e 305м
SKU: CBL-UTP-5E-305
На складе: 12 бухт
Количество: 5
Ед.: бухт
Ошибка: —
Badge: из остатков
```

Example insufficient stock line:

```text
Перфоратор Bosch GBH 2-26
SKU: BOSCH-GBH-226
На складе: 3 шт
Количество: 5
Ошибка: Недостаточно
```

Серверная ошибка приходит в problem envelope (`urn:warehouse:problem:operation-submit-rejected`); см. `docs/TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE.md` §3, §6-§9 (inline-подсветка, toast, scroll/focus, stale-очистка, a11y) и ADR-0025.

Example temporary item line:

```text
Фильтр масляный неизвестный
SKU / статус: TEMP
На складе: —
Количество: 2
Ед.: шт
Badge: временная ТМЦ
```

---

## 18. Stock hint rules

For MOVE:
- show source site stock;
- quantity must not exceed source stock.

For ISSUE:
- show source site stock;
- quantity must not exceed source stock.

For RECEIVE:
- show current destination site stock as reference;
- quantity may exceed current stock.

For temporary item:
- stock hint may be `—`;
- allowed for receive;
- blocked for move/issue unless backend supports temporary stock.

---

## 19. Modal actions

Actions:
- `Сохранить черновик`
- `Подтвердить операцию`
- `Отмена`
- `Закрыть`

Behavior:

Save draft:
- create mode: `POST /api/v1/operations`;
- edit mode: `PATCH /api/v1/operations/{operation_id}`.

Confirm operation:
- opens confirm modal first;
- does not perform acceptance.

Cancel:
- closes modal after confirmation if unsaved changes exist.

---

## 20. Confirm draft modal

Purpose:

```text
Confirm draft operation and convert it into a full operation.
```

Important:

```text
This is not acceptance.
This is not quantity reconciliation.
```

Modal title:

```text
Подтвердить операцию?
```

Text:

```text
Черновик станет полноценной операцией. Это действие не является приёмкой товара.
```

Warning:

```text
После подтверждения операция будет недоступна для обычного редактирования.
Для приходов и перемещений далее может потребоваться отдельная приёмка.
```

Summary:
- type;
- source site;
- destination site;
- lines count;
- author.

Actions:
- `Отмена`
- `Подтвердить операцию`

API call:

```http
POST /api/v1/operations/{operation_id}/submit
```

Payload:

```json
{
  "submit": true
}
```

After success:
- close confirm modal;
- close/update create modal;
- reload operations list;
- show success notification.

---

## 21. Operation detail modal / future panel

Table row click should be prepared for operation detail.

Detail modal may show:
- operation number/id;
- status;
- type;
- created date;
- created by;
- source site;
- destination site;
- person/recipient;
- comment;
- line items;
- actions allowed by status/role.

This can be implemented after MVP list + create/confirm modal.

---

## 22. Acceptance excluded

Acceptance is not implemented in create/edit modal.

Acceptance has separate business logic:

```text
Expected quantity
Actual accepted quantity
Difference
Acceptance comment
Accept / accept with difference / reject
```

Future routes:

```text
/operations/acceptance
/operations/{operation_id}/acceptance
```

The list may show:
- tab `Ожидают приёмки`;
- button `Приёмка`;
- row action `Приёмка`.

But actual acceptance UI is out of scope here.

---

## 23. Prefill from balances

When user starts operation from `/balances`, navigate to `/operations` with query params.

Example MOVE:

```text
/operations?modal=create&type=MOVE&source_site_id=<site_id>&item_id=<item_id>
```

Example RECEIVE:

```text
/operations?modal=create&type=RECEIVE&destination_site_id=<site_id>&item_id=<item_id>
```

Example ISSUE:

```text
/operations?modal=create&type=ISSUE&source_site_id=<site_id>&item_id=<item_id>
```

On `/operations`:
- detect query params;
- open create modal;
- load item;
- load stock hint;
- add selected item as first line;
- show badge `из остатков`.

---

## 24. Suggested Angular structure

```text
src/app/features/inventory/
  operations/
    pages/
      operations-page/
        operations-page.component.ts
        operations-page.component.html
        operations-page.component.scss

    components/
      operations-filter-panel/
      operations-status-tabs/
      operations-table/
      operation-row-actions/
      operation-create-modal/
      operation-confirm-modal/
      operation-lines-table/
      item-cache-search/
      temporary-item-form/
      operation-detail-modal/

    services/
      operations-api.service.ts
      operation-draft-store.service.ts
      operation-prefill.service.ts
      item-cache-search.service.ts
      stock-hint.service.ts

    models/
      operation.models.ts
      operation-ui.models.ts
```

Adapt to actual project conventions.

---

## 25. Component responsibilities

### operations-page

- loads operations list;
- owns filters;
- owns selected status tab;
- opens/closes modals;
- handles prefill from balances;
- calls API service;
- reloads list after save/submit/cancel.

### operations-filter-panel

- renders filters;
- emits filter changes;
- emits reset.

### operations-status-tabs

- renders status shortcuts;
- emits selected tab.

### operations-table

- renders operation rows;
- emits row click and row action events.

### operation-create-modal

- renders create/edit draft form;
- handles operation type dependent fields;
- manages line items;
- emits save/confirm/cancel events.

### item-cache-search

- searches local Django catalog cache;
- shows search results;
- emits selected item.

### temporary-item-form

- creates local temporary item draft;
- emits temporary item line.

### operation-lines-table

- renders line items;
- edits quantities;
- shows stock hints;
- shows validation errors;
- removes lines.

### operation-confirm-modal

- shows confirmation summary;
- emits final confirm/cancel.

---

## 26. Suggested TypeScript models

```ts
export type OperationType =
  | 'RECEIVE'
  | 'MOVE'
  | 'ISSUE'
  | 'ISSUE_RETURN';

export type OperationStatus =
  | 'draft'
  | 'created'
  | 'pending'
  | 'submitted'
  | 'rejected'
  | 'cancelled';

export interface OperationsFilterVm {
  search: string;
  type: OperationType | null;
  status: OperationStatus | null;
  siteId: string | null;
  createdAfter: string | null;
  createdBefore: string | null;
  createdByUserId: string | null;
  onlyMine: boolean;
  page: number;
  pageSize: number;
}

export interface OperationListRowVm {
  id: string;
  number: string;
  type: OperationType;
  typeLabel: string;
  status: OperationStatus;
  statusLabel: string;
  createdAt: string;
  createdByUserId: string;
  createdByLabel: string;
  sourceSiteId?: string | null;
  sourceSiteName?: string | null;
  destinationSiteId?: string | null;
  destinationSiteName?: string | null;
  personName?: string | null;
  directionLabel: string;
  linesCount: number;
  canOpen: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canCancel: boolean;
  canPrint: boolean;
  canAccept: boolean;
}

export interface OperationDraftVm {
  id?: string;
  type: OperationType;
  status: 'draft';
  sourceSiteId?: string | null;
  destinationSiteId?: string | null;
  personName?: string | null;
  comment?: string | null;
  lines: OperationLineDraftVm[];
}

export interface OperationLineDraftVm {
  localId: string;
  itemId?: string | null;
  itemName: string;
  sku?: string | null;
  unitId?: string | null;
  unitName: string;
  quantity: number | null;
  availableQuantity?: number | null;
  sourceSiteQuantity?: number | null;
  destinationSiteQuantity?: number | null;
  isTemporary: boolean;
  fromBalances: boolean;
  error?: string | null;
}

export interface TemporaryItemDraftVm {
  name: string;
  unitId: string | null;
  categoryId?: string | null;
  comment?: string | null;
  keywords?: string[];
}
```

---

## 27. Validation rules

General:
- operation type required;
- at least one line required;
- quantity must be greater than 0;
- each line requires item or temporary item.

MOVE:
- source_site_id required;
- destination_site_id required;
- source and destination must be different;
- quantity must not exceed source stock.

RECEIVE:
- destination_site_id required;
- quantity must be greater than 0;
- temporary items allowed.

ISSUE:
- source_site_id required;
- recipient/person_name required;
- quantity must not exceed source stock;
- temporary items forbidden.

ISSUE_RETURN:
- target/destination site required;
- recipient/person context required;
- temporary items generally forbidden.

---

## 28. Styling tokens

```scss
$color-page-bg: #F1F5F9;
$color-shell-sidebar: #0F1B2E;
$color-panel-bg: #FFFFFF;
$color-panel-border: #DDE3EA;
$color-border: #E2E8F0;

$color-text-main: #0F172A;
$color-text-muted: #64748B;
$color-text-disabled: #94A3B8;

$color-button-primary: #334155;
$color-button-blue: #2563EB;
$color-button-success: #16A34A;

$color-row-hover: #F8FAFC;

$radius-card: 10px;
$radius-control: 6px;
$radius-modal: 12px;
$radius-badge: 11px;
```

---

## 29. MVP behavior

MVP includes:
- `/operations` route;
- clean list screen;
- filters;
- status tabs;
- operations table;
- row hover actions;
- create/edit modal;
- cached item search placeholder/integration;
- operation lines table;
- stock hint display;
- temporary item marker;
- save draft;
- confirm draft modal;
- submit API call.

MVP may stub:
- print;
- export;
- acceptance screen;
- temporary item backend;
- advanced audit/history.

---

## 30. Implementation plan for agent

1. Inspect Angular project structure.
2. Confirm embedded-in-Django layout constraints.
3. Identify existing routing and auth/interceptor patterns.
4. Create operation models.
5. Create operations API service.
6. Create operations page component.
7. Create filters and status tabs.
8. Create operations table.
9. Create create/edit operation modal.
10. Create item cache search component.
11. Create operation lines table.
12. Add stock hint service or stub.
13. Add confirm draft modal.
14. Wire `GET /operations`, `POST /operations`, `PATCH /operations/{id}`, `POST /operations/{id}/submit`.
15. Add prefill from `/balances` query params.
16. Run Angular build.
17. Fix compile errors.
18. Summarize changed files.

---

## 31. Acceptance criteria

Done when:
- `/operations` opens inside existing Django shell content area;
- Angular does not render duplicate topbar/sidebar;
- filters are visible and usable;
- status tabs are visible;
- operations table renders rows;
- row hover actions appear;
- `+ Создать операцию` opens modal;
- modal supports operation type, source/destination, recipient/comment;
- modal supports cached item search area;
- modal supports temporary item marker/form placeholder;
- line table shows item, SKU/status, stock hint, quantity, unit, error;
- quantity validation warns on insufficient stock for MOVE/ISSUE;
- save draft action is wired or stubbed;
- confirm action opens confirm modal;
- confirm modal calls submit endpoint or stub;
- acceptance UI is not implemented inside create/edit modal;
- Angular build passes.

---

## 32. Agent warnings

Do not build this as a full-screen standalone Angular shell.
Do not duplicate Django navbar or sidebar.
Do not mix confirmation and acceptance.
Do not implement acceptance in the create/edit modal.
Do not allow direct stock mutation from UI.
Do not let observer create or confirm operations.
Do not let storekeeper confirm operations.
Do not let storekeeper choose another source site as arbitrary source.
Do not create temporary items for move/issue unless explicitly supported.
