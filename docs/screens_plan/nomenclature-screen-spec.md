# UI Spec: Warehouse Angular — Nomenclature Screen

> Назначение документа: передать агенту разработки полную Markdown-спецификацию экрана по готовому Figma-макету.  
> Цель: реализовать экран в Angular без прямого доступа к Figma MCP, используя этот документ и PNG-экспорт макета.

---

## 1. Figma reference

Figma file:

```text
https://www.figma.com/design/Vpw1d1Sh0uA4mxuqaGKvSY/Warehouse-Angular-%E2%80%94-Nomenclature-Screen
```

Main screen frame:

```text
node-id=1-2
```

Direct frame link:

```text
https://www.figma.com/design/Vpw1d1Sh0uA4mxuqaGKvSY/Warehouse-Angular-%E2%80%94-Nomenclature-Screen?node-id=1-2
```

The link originally provided with `node-id=1-139` points to the notes block under the screen.  
The actual UI screen frame is `1:2`.

---

## 2. Screen name

```text
Номенклатура
```

Route suggestion:

```text
/catalog/nomenclature
```

Screen purpose:

The screen is used for warehouse catalog management:
- category tree navigation;
- item/TMC navigation;
- local inline edits;
- detailed editing in the right-side form;
- local change buffer;
- batch-style applying of accumulated changes.

Important business rule:

```text
Changes are not sent to the server immediately.
All changes are collected locally.
The user applies them using the “Применить” button.
```

---

## 3. Technology target

Implement in Angular.

Expected implementation style:

```text
Angular + TypeScript + HTML + SCSS
```

Do not copy React/Tailwind code from Figma tools directly.

Important:

```text
Do not install Tailwind unless the target project already uses Tailwind.
Do not introduce a new UI framework unless the project already uses it.
Follow the existing Angular project structure and style conventions.
```

---

## 4. Screen layout

Base design size:

```text
1440x900
```

Desktop-first layout.

Global page background:

```text
#F3F4F6
```

Main regions:

```text
Top navigation bar
Page header
Main workspace:
  Left panel: category/item tree
  Right panel: selected entity edit form
```

Approximate layout:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Top navigation bar                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Page header                                                                  │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ Left panel                    │ Right panel                                  │
│ Categories and items tree      │ Item/category edit form                      │
│                               │                                              │
└───────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 5. Exact visual layout from Figma

### 5.1 Top navigation bar

Position:

```text
x: 0
y: 0
width: 1440
height: 64
```

Style:

```text
background: #111827
```

Left text:

```text
Склад / Справочники / Номенклатура
```

Approximate position:

```text
x: 32
y: 21
font-size: 14
font-weight: 500
color: #D1D5DB
```

Right context text:

```text
chief_storekeeper · X-User-Token
```

Approximate position:

```text
x: 1168
y: 21
font-size: 13
font-weight: 400
color: #9CA3AF
```

---

### 5.2 Page header

Position:

```text
x: 24
y: 88
width: 1392
height: 92
```

Style:

```text
background: #FFFFFF
border: 1px solid #E5E7EB
border-radius: 16px
```

Title:

```text
Номенклатура
```

Title style:

```text
font-size: 28
font-weight: 700
color: #111827
```

Subtitle:

```text
Категории, ТМЦ, SKU, единицы измерения и ключевые слова. Изменения копятся локально и применяются батчем.
```

Subtitle style:

```text
font-size: 14
font-weight: 400
color: #6B7280
```

Header actions:

```text
Экспорт
Применить все
```

Button positions:

```text
Экспорт:
  x: 1190
  y: 116
  width: 88
  height: 36

Применить все:
  x: 1292
  y: 116
  width: 104
  height: 36
```

---

### 5.3 Left panel

Position:

```text
x: 24
y: 196
width: 456
height: 672
```

Style:

```text
background: #FFFFFF
border: 1px solid #E5E7EB
border-radius: 16px
```

Panel title:

```text
Категории и ТМЦ
```

Panel subtitle:

```text
Дерево с inline-редактированием
```

---

### 5.4 Right panel

Position:

```text
x: 504
y: 196
width: 912
height: 672
```

Style:

```text
background: #FFFFFF
border: 1px solid #E5E7EB
border-radius: 16px
```

---

## 6. Left panel details

### 6.1 Search input

Label:

```text
Поиск
```

Input value / placeholder:

```text
Название, SKU, ключевые слова
```

Position:

```text
x: 48
y: 276
width: 408
height: 40
```

Style:

```text
background: #FFFFFF
border: 1px solid #D1D5DB
border-radius: 8px
font-size: 13
text color: #111827
```

Behavior:

Search should filter locally by:
- category name;
- item name;
- item SKU;
- item keywords / hashtags.

Tree filtering rule:

```text
If a child item matches the search query, all its parent categories must remain visible.
```

---

### 6.2 Left panel buttons

Buttons:

```text
+ Категория
+ ТМЦ
Раскрыть всё
```

Approximate positions:

```text
+ Категория:
  x: 48
  y: 350
  width: 132
  height: 36

+ ТМЦ:
  x: 192
  y: 350
  width: 94
  height: 36

Раскрыть всё:
  x: 298
  y: 350
  width: 116
  height: 36
```

Button style:

Secondary button:

```text
background: #F3F4F6
border: 1px solid #D1D5DB
border-radius: 8px
text: #374151
font-size: 13
font-weight: 500
```

Ghost/white button:

```text
background: #FFFFFF
border: 1px solid #D1D5DB
border-radius: 8px
text: #374151
font-size: 13
font-weight: 500
```

---

## 7. Category/item tree

### 7.1 Tree content from mockup

Example tree:

```text
▾ Кабельная продукция
  ▾ Витая пара
    • UTP Cat5e 305м
      SKU: CBL-UTP-5E-305
    • FTP Cat6 305м
      SKU: CBL-FTP-6-305
  ▸ Оптика

▾ Инструмент
  • Перфоратор Bosch GBH 2-26
    SKU: BOSCH-GBH-226
  • Старый модем Huawei
    SKU: OLD-HW-001
  • Расходники без SKU
    Требуется SKU
```

Tree row height:

```text
36px
```

Tree row width:

```text
416px
```

Tree row x:

```text
44
```

First row y:

```text
408
```

Vertical step:

```text
40px
```

---

### 7.2 Tree node types

There are two node types:

```ts
type CatalogNodeType = 'category' | 'item';
```

Category node:
- uses expand/collapse icon;
- has children;
- shows name only.

Item node:
- leaf node;
- uses bullet marker;
- shows name;
- shows secondary metadata line: SKU or validation/error hint.

---

### 7.3 Tree states

The tree must support these visual states:

```text
normal
selected
dirty
inactive
error
expanded
collapsed
```

#### Normal category row

```text
background: #FFFFFF
text: #111827
icon: #6B7280
```

#### Selected row

Used in mockup for:

```text
Витая пара
```

Style:

```text
background: #EFF6FF
border: 1px solid #93C5FD
border-radius: 8px
main text: #111827
font-weight: 600
```

#### Dirty row

Used in mockup for:

```text
UTP Cat5e 305м
```

Style:

```text
background: #FFFBEB
border-radius: 8px
```

Badge:

```text
label: изменено
background: #FEF3C7
text: #92400E
border-radius: 11px
font-size: 11
font-weight: 500
```

#### Inactive row

Used in mockup for:

```text
Старый модем Huawei
```

Style:

```text
main text: #9CA3AF
icon: #9CA3AF
secondary text: #6B7280
```

Badge:

```text
label: неактивно
background: #F3F4F6
text: #6B7280
border-radius: 11px
font-size: 11
font-weight: 500
```

#### Error row

Used in mockup for:

```text
Расходники без SKU
```

Style:

```text
background: #FEF2F2
border: 1px solid #FCA5A5
border-radius: 8px
```

Badge:

```text
label: ошибка
background: #FEE2E2
text: #B91C1C
border-radius: 11px
font-size: 11
font-weight: 500
```

Secondary line:

```text
Требуется SKU
```

---

## 8. Pending changes bar

Position:

```text
x: 40
y: 798
width: 424
height: 54
```

Style:

```text
background: #F9FAFB
border: 1px solid #E5E7EB
border-radius: 14px
```

Content:

```text
Изменений: 3
Сбросить
Применить
```

Behavior:

- Shows current count of pending local changes.
- “Сбросить” clears all pending changes.
- “Применить” sends all pending changes to backend.
- If save fails, keep local pending changes and show an error.

---

## 9. Right panel: selected item form

The mockup shows selected item mode.

Badge:

```text
выбрана ТМЦ
```

Badge style:

```text
background: #DBEAFE
text: #1D4ED8
border-radius: 11px
font-size: 11
font-weight: 500
```

Title:

```text
UTP Cat5e 305м
```

Title style:

```text
font-size: 24
font-weight: 700
color: #111827
```

Subtitle:

```text
Полное редактирование выбранного элемента. Правки попадут в локальный batch.
```

Subtitle style:

```text
font-size: 13
font-weight: 400
color: #6B7280
```

---

### 9.1 Item form fields

Fields:

```text
Название *
SKU *
Единица измерения *
Категория *
Ключевые слова
Описание
Активность
```

#### Field: Название

```text
label: Название *
value: UTP Cat5e 305м
x: 536
y: 328
width: 408
height: 40
```

#### Field: SKU

```text
label: SKU *
value: CBL-UTP-5E-305
x: 968
y: 328
width: 384
height: 40
```

#### Field: Единица измерения

```text
label: Единица измерения *
value: бухта
x: 536
y: 406
width: 260
height: 40
```

#### Field: Категория

```text
label: Категория *
value: Кабельная продукция / Витая пара
x: 820
y: 406
width: 532
height: 40
```

#### Field: Ключевые слова

```text
label: Ключевые слова
value: кабель, витая пара, cat5e, utp, сеть
x: 536
y: 484
width: 816
height: 40
```

#### Field: Описание

```text
label: Описание
value: Бухта кабеля UTP Cat5e 305м для сетевой инфраструктуры склада.
x: 536
y: 582
width: 816
height: 96
```

#### Field common style

```text
background: #FFFFFF
border: 1px solid #D1D5DB
border-radius: 8px
label color: #6B7280
value color: #111827
label font-size: 12
value font-size: 13
```

---

### 9.2 Active switch

Container:

```text
x: 536
y: 704
width: 816
height: 54
background: #F9FAFB
border: 1px solid #E5E7EB
border-radius: 12px
```

Title:

```text
Активность
```

Description:

```text
Активные ТМЦ доступны в операциях и поиске.
```

Switch ON:

```text
track:
  x: 1288
  y: 720
  width: 44
  height: 24
  background: #2563EB
  border-radius: 12px

knob:
  x: 1310
  y: 724
  width: 16
  height: 16
  background: #FFFFFF
```

---

### 9.3 Item form actions

Actions:

```text
Деактивировать
Удалить
Сбросить
Добавить в изменения
```

Positions:

```text
Деактивировать:
  x: 536
  y: 792
  width: 140
  height: 40

Удалить:
  x: 690
  y: 792
  width: 88
  height: 40

Сбросить:
  x: 1108
  y: 792
  width: 96
  height: 40

Добавить в изменения:
  x: 1218
  y: 792
  width: 156
  height: 40
```

Danger button style:

```text
background: #FEF2F2
border: 1px solid #FCA5A5
text: #B91C1C
border-radius: 8px
font-size: 13
font-weight: 500
```

Primary button style:

```text
background: #2563EB
text: #FFFFFF
border-radius: 8px
font-size: 13
font-weight: 500
```

Secondary button style:

```text
background: #F3F4F6
border: 1px solid #D1D5DB
text: #374151
border-radius: 8px
font-size: 13
font-weight: 500
```

---

## 10. Right panel: category form

The mockup currently shows item form, but the screen must also support category editing.

When selected node type is `category`, show category form.

Badge:

```text
выбрана категория
```

Fields:

```text
Название *
Код
Родительская категория
Сортировка
Активность
```

Actions:

```text
Деактивировать
Удалить
Сбросить
Добавить в изменения
```

Behavior:
- editing category name updates local form draft;
- changing parent category updates `parent_id`;
- deactivation creates pending update with `is_active=false`;
- delete should be disabled or converted to deactivate if backend has no DELETE endpoint.

---

## 11. Empty state

If no tree node is selected, right panel should show an empty state.

Suggested text:

```text
Выберите категорию или ТМЦ
```

Suggested description:

```text
После выбора элемента здесь появится форма редактирования.
```

---

## 12. Interaction behavior

### 12.1 Selection

When user clicks a tree node:

```text
selectedNode = clicked node
```

Right panel:
- if node is item → show item form;
- if node is category → show category form.

Selected row must use selected visual state.

---

### 12.2 Local edit draft

Edits in the right form should not mutate server state immediately.

Implementation idea:

```text
selectedDraft = copy(selectedNode data)
```

When fields change:
- update local draft;
- do not call API.

When user clicks “Добавить в изменения”:
- validate form;
- add or update pending change in change buffer;
- mark node as dirty in tree.

---

### 12.3 Inline editing

Tree inline editing is required conceptually.

MVP implementation options:
1. Implement immediate inline editable text inputs inside tree rows.
2. Or implement inline edit later, while using right form as full edit mode.

If implemented:
- editing tree row name updates local draft;
- pending change is added/updated in change buffer;
- row becomes dirty.

---

### 12.4 Apply changes

When user clicks “Применить”:

1. Validate all pending changes.
2. Send changes to backend.
3. On success:
   - clear change buffer;
   - reload categories tree;
   - reload items;
   - reload units;
   - rebuild tree;
   - clear dirty states.
4. On failure:
   - keep pending changes;
   - show error;
   - mark failed rows with error state if possible.

---

### 12.5 Reset changes

Form reset:
- resets currently selected form draft only.

Pending bar reset:
- clears all pending changes.
- resets dirty states in tree.

---

### 12.6 Delete behavior

If backend has no physical DELETE endpoint:

```text
Do not implement physical delete.
```

Options:
- disable the “Удалить” button;
- or ask confirmation and convert action to deactivate (`is_active=false`).

Preferred MVP:

```text
Disable “Удалить” and show tooltip:
“Удаление пока недоступно. Используйте деактивацию.”
```

---

## 13. API endpoints

Use existing catalog endpoints.

Read endpoints:

```http
GET /api/v1/catalog/categories/tree
GET /api/v1/catalog/items
GET /api/v1/catalog/units
```

Write endpoints:

```http
POST /api/v1/catalog/admin/categories
PATCH /api/v1/catalog/admin/categories/{category_id}

POST /api/v1/catalog/admin/items
PATCH /api/v1/catalog/admin/items/{item_id}
```

Authentication:
- use existing project auth mechanism;
- API requires `X-User-Token`;
- catalog admin calls may require `X-Site-Id` for `chief_storekeeper`;
- never hardcode tokens in components.

---

## 14. Batch behavior

Current backend may not have a dedicated batch endpoint.

MVP approach:

```text
Keep a local batch/change buffer in frontend.
On apply, send sequential POST/PATCH requests.
```

Preferred future backend endpoint:

```http
POST /api/v1/catalog/admin/batch
```

Suggested payload:

```json
{
  "changes": [
    {
      "entity_type": "item",
      "entity_id": "uuid",
      "action": "update",
      "payload": {
        "name": "UTP Cat5e 305м",
        "sku": "CBL-UTP-5E-305",
        "unit_id": "uuid",
        "category_id": "uuid",
        "hashtags": ["кабель", "витая пара", "cat5e", "utp", "сеть"],
        "is_active": true
      }
    }
  ]
}
```

---

## 15. Suggested Angular file structure

Adapt paths to the existing project conventions.

Suggested feature structure:

```text
src/app/features/catalog/
  pages/
    nomenclature-page/
      nomenclature-page.component.ts
      nomenclature-page.component.html
      nomenclature-page.component.scss

  components/
    catalog-tree/
      catalog-tree.component.ts
      catalog-tree.component.html
      catalog-tree.component.scss

    catalog-tree-node/
      catalog-tree-node.component.ts
      catalog-tree-node.component.html
      catalog-tree-node.component.scss

    item-edit-form/
      item-edit-form.component.ts
      item-edit-form.component.html
      item-edit-form.component.scss

    category-edit-form/
      category-edit-form.component.ts
      category-edit-form.component.html
      category-edit-form.component.scss

    pending-changes-bar/
      pending-changes-bar.component.ts
      pending-changes-bar.component.html
      pending-changes-bar.component.scss

  services/
    catalog-api.service.ts
    catalog-tree-store.service.ts
    catalog-change-buffer.service.ts

  models/
    catalog.models.ts
```

If the project uses standalone components, implement components as standalone.
If the project uses Angular modules, register components in the appropriate module.

---

## 16. Component responsibilities

### 16.1 `nomenclature-page`

Responsibilities:
- load categories/items/units;
- own selected node;
- wire tree and form;
- own page-level loading/error state;
- call tree store to build tree;
- call change buffer for pending edits;
- call API service on apply.

Must not:
- contain all tree rendering logic inline;
- contain all form logic inline.

---

### 16.2 `catalog-tree`

Responsibilities:
- render tree;
- expose selection event;
- expose expand/collapse event;
- receive dirty/error/inactive state from VM;
- optionally emit inline edit events.

Inputs:

```ts
nodes: CatalogTreeNodeVm[];
selectedNodeId?: string | null;
```

Outputs:

```ts
nodeSelected: EventEmitter<CatalogTreeNodeVm>;
nodeInlineEdited: EventEmitter<CatalogInlineEditEvent>;
```

---

### 16.3 `catalog-tree-node`

Responsibilities:
- render one tree row;
- show indentation;
- show expand/collapse icon;
- show item SKU/meta;
- show badges:
  - изменено
  - неактивно
  - ошибка

Inputs:

```ts
node: CatalogTreeNodeVm;
```

Outputs:

```ts
selected: EventEmitter<CatalogTreeNodeVm>;
expandedChanged: EventEmitter<CatalogTreeNodeVm>;
inlineEdited: EventEmitter<CatalogInlineEditEvent>;
```

---

### 16.4 `item-edit-form`

Responsibilities:
- render item form;
- manage local form validation;
- emit submit/reset/deactivate/delete events.

Inputs:

```ts
item: CatalogItemVm;
units: UnitDto[];
categories: CategoryDto[];
```

Outputs:

```ts
saveDraft: EventEmitter<CatalogPendingChange>;
resetDraft: EventEmitter<void>;
deactivate: EventEmitter<string>;
deleteRequested: EventEmitter<string>;
```

---

### 16.5 `category-edit-form`

Responsibilities:
- render category form;
- manage local form validation;
- emit submit/reset/deactivate/delete events.

Inputs:

```ts
category: CategoryDto;
categories: CategoryDto[];
```

Outputs:

```ts
saveDraft: EventEmitter<CatalogPendingChange>;
resetDraft: EventEmitter<void>;
deactivate: EventEmitter<string>;
deleteRequested: EventEmitter<string>;
```

---

### 16.6 `pending-changes-bar`

Responsibilities:
- show pending changes count;
- emit apply/reset.

Inputs:

```ts
count: number;
isSaving: boolean;
```

Outputs:

```ts
apply: EventEmitter<void>;
reset: EventEmitter<void>;
```

---

## 17. Suggested TypeScript models

```ts
export type CatalogNodeType = 'category' | 'item';

export type CatalogNodeState =
  | 'normal'
  | 'selected'
  | 'dirty'
  | 'inactive'
  | 'error';

export type CatalogPendingAction =
  | 'create'
  | 'update'
  | 'deactivate'
  | 'delete';

export interface CatalogTreeNodeVm {
  id: string;
  type: CatalogNodeType;
  name: string;

  sku?: string;
  meta?: string;

  parentId?: string | null;
  categoryId?: string | null;
  unitId?: string | null;

  isActive: boolean;

  level: number;
  children?: CatalogTreeNodeVm[];

  expanded: boolean;
  selected: boolean;
  dirty: boolean;
  error?: string | null;

  pendingAction?: CatalogPendingAction;
  state?: CatalogNodeState;
}

export interface CatalogPendingChange {
  localId: string;
  entityType: 'category' | 'item' | 'unit';
  entityId?: string;
  action: CatalogPendingAction;
  payload: Record<string, unknown>;
}

export interface CatalogInlineEditEvent {
  nodeId: string;
  nodeType: CatalogNodeType;
  field: string;
  value: unknown;
}

export interface CategoryDto {
  id: string;
  name: string;
  code?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  is_active: boolean;
}

export interface ItemDto {
  id: string;
  name: string;
  sku: string;
  category_id?: string | null;
  unit_id: string;
  description?: string | null;
  hashtags?: string[];
  is_active: boolean;
}

export interface UnitDto {
  id: string;
  name: string;
  symbol?: string;
  is_active: boolean;
}
```

---

## 18. Styling tokens extracted from mockup

### Colors

```scss
$color-page-bg: #F3F4F6;
$color-topbar-bg: #111827;

$color-panel-bg: #FFFFFF;
$color-panel-border: #E5E7EB;

$color-text-main: #111827;
$color-text-muted: #6B7280;
$color-text-disabled: #9CA3AF;

$color-input-border: #D1D5DB;

$color-primary: #2563EB;
$color-primary-text: #FFFFFF;

$color-selected-bg: #EFF6FF;
$color-selected-border: #93C5FD;

$color-dirty-bg: #FFFBEB;
$color-dirty-badge-bg: #FEF3C7;
$color-dirty-badge-text: #92400E;

$color-inactive-badge-bg: #F3F4F6;
$color-inactive-badge-text: #6B7280;

$color-error-bg: #FEF2F2;
$color-error-border: #FCA5A5;
$color-error-badge-bg: #FEE2E2;
$color-error-text: #B91C1C;

$color-danger-bg: #FEF2F2;
$color-danger-border: #FCA5A5;
$color-danger-text: #B91C1C;
```

### Radii

```scss
$radius-panel: 16px;
$radius-card: 14px;
$radius-control: 8px;
$radius-badge: 11px;
$radius-switch: 12px;
```

### Typography

Font family:

```text
Inter, system-ui, sans-serif
```

Text sizes:

```scss
$title-size: 28px;
$form-title-size: 24px;
$panel-title-size: 18px;
$body-size: 14px;
$control-size: 13px;
$label-size: 12px;
$badge-size: 11px;
$meta-size: 10px;
```

---

## 19. Suggested SCSS layout skeleton

```scss
.nomenclature-page {
  min-height: 100vh;
  background: #F3F4F6;
  color: #111827;
}

.topbar {
  height: 64px;
  background: #111827;
  color: #D1D5DB;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
}

.page-header {
  margin: 24px;
  height: 92px;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.workspace {
  margin: 16px 24px 32px;
  display: grid;
  grid-template-columns: 456px 1fr;
  gap: 24px;
}

.catalog-tree-panel,
.edit-panel {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
}

.catalog-tree-panel {
  min-height: 672px;
  padding: 24px 16px 16px;
  display: flex;
  flex-direction: column;
}

.edit-panel {
  min-height: 672px;
  padding: 24px 32px;
}
```

---

## 20. Implementation plan for agent

1. Inspect existing Angular project:
   - routing style;
   - modules vs standalone components;
   - SCSS conventions;
   - existing API services;
   - auth interceptor.
2. Create or adapt catalog feature structure.
3. Add TypeScript models.
4. Add `catalog-api.service.ts`.
5. Add `catalog-change-buffer.service.ts`.
6. Add `catalog-tree-store.service.ts`.
7. Implement static layout from this spec.
8. Add mock data to verify UI layout.
9. Implement selection behavior.
10. Implement item form.
11. Implement category form.
12. Implement pending change buffer.
13. Implement local search.
14. Implement apply changes:
    - sequential POST/PATCH for MVP;
    - reload data after success.
15. Add/confirm route `/catalog/nomenclature`.
16. Run Angular build.
17. Fix compile errors.
18. Summarize changed files.

---

## 21. Acceptance criteria

The task is done when:

- screen opens in Angular;
- layout visually matches Figma;
- left tree panel is rendered;
- search input exists and filters locally;
- category/item rows show states:
  - selected;
  - dirty;
  - inactive;
  - error;
- selecting a row opens the correct form in the right panel;
- item form has all required fields;
- category form is supported;
- edits do not call API immediately;
- pending changes are stored locally;
- pending bar shows correct count;
- reset works;
- apply sends changes;
- data reloads after successful apply;
- Angular build passes.

---

## 22. Agent warning

Do not implement the whole screen as one giant component.

Do not call HTTP from tree rows or form components.

Do not introduce Tailwind just because Figma context may show Tailwind-like code.

Do not hardcode auth tokens.

Do not implement physical delete unless backend endpoint exists.

Use the current project architecture.
