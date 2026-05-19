# Warehouse Frontend Styles

This directory contains the shared visual style system for the Warehouse Angular frontend.

## Partials

| File | Purpose |
|---|---|
| `_tokens.scss` | CSS custom properties (colors, spacing, radii, shadows, typography). |
| `_primitives.scss` | Base layout and primitive classes: page, workspace, card, panel, button, form-input, table base. |
| `_tables.scss` | Table system: card wrapper, scroll container, data table with sticky header, sortable headers, pagination, empty/loading/error states. |
| `_badges.scss` | Badge base plus status and operation-type modifiers. |
| `_modals.scss` | Modal overlay, modal sizes, header/body/footer, close button. |
| `_states.scss` | Loading spinner, error banner, empty state, permission state. |
| `_forms.scss` | Form fields, labels, inputs, select, textarea, layout helpers, validation message. |
| `_legacy-aliases.scss` | Deprecated non-`wh-*` aliases kept for backward compatibility. |

## Naming Rule

All product-level shared classes use the `wh-` prefix.

- Layout: `.wh-page`, `.wh-workspace`, `.wh-card`, `.wh-panel`
- Components: `.wh-btn`, `.wh-badge`, `.wh-modal`, `.wh-data-table`
- States: `.wh-loading-state`, `.wh-empty-state`, `.wh-error-banner`
- Forms: `.wh-field`, `.wh-input`, `.wh-select`, `.wh-textarea`

Legacy aliases (`.btn`, `.badge`, `.modal-header`, etc.) are deprecated and will be removed in a future cleanup.

## Example Usage

### Page

```html
<div class="wh-page">
  <div class="wh-page-header">
    <h1>Title</h1>
    <button class="wh-btn wh-btn--primary">Create</button>
  </div>
  <div class="wh-workspace">
    <div class="wh-card">...</div>
  </div>
</div>
```

### Table

```html
<div class="wh-table-card">
  <div class="wh-table-scroll">
    <table class="wh-data-table">
      <thead>
        <tr>
          <th class="wh-sortable-th">
            Name <span class="wh-sort-indicator wh-sort-indicator--asc"></span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Item A</td></tr>
      </tbody>
    </table>
  </div>
  <div class="wh-pagination">
    <span>1–10 of 100</span>
    <div class="wh-page-size">
      <select><option>10</option><option>20</option><option>50</option></select>
    </div>
  </div>
</div>
```

### Modal

```html
<div class="wh-modal-overlay">
  <div class="wh-modal wh-modal--md">
    <div class="wh-modal-header">
      <h2>Confirm</h2>
      <button class="wh-modal-close" aria-label="Close">&times;</button>
    </div>
    <div class="wh-modal-body">...</div>
    <div class="wh-modal-footer">
      <button class="wh-btn wh-btn--secondary">Cancel</button>
      <button class="wh-btn wh-btn--primary">OK</button>
    </div>
  </div>
</div>
```

### Badge

```html
<span class="wh-badge wh-badge--status-pending">Pending</span>
<span class="wh-badge wh-badge--type-receive">Receive</span>
```

## Guidelines

- Component-local styles should compose shared classes (e.g., add an extra class to the element) rather than redefine primitive rules.
- Prefer tokens (`var(--wh-color-*)`) over hard-coded values.
- New shared classes must use the `wh-` prefix and live in the appropriate partial.
