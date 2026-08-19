import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationLineDraftVm, OperationType } from '../../../../core/models/operations.models';

export type SortColumn = 'itemName' | 'quantity' | 'availableQuantity' | 'lineNumber';
export type SortDirection = 'asc' | 'desc';

export interface LineQuantityChange {
  localId: string;
  quantity: number | null;
}

/** Per-row submit-error display state (TZ-FRONTEND §6). */
export interface LineSubmitErrorState {
  groupId: string;
  stale: boolean;
  text: string;
}

@Component({
  selector: 'app-operation-lines-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="lines-container">
      <table class="lines-data-table">
        <colgroup>
          <col class="col-num-col">
          <col class="col-item-col">
          <col class="col-qty-col">
          <col class="col-cat-col">
          <col class="col-avail-col">
          <col class="col-actions-col">
        </colgroup>
        <thead>
          <tr>
            <th class="col-num" (click)="toggleSort('lineNumber')"
                [attr.aria-sort]="sortColumn() === 'lineNumber' ? (sortDirection() === 'asc' ? 'ascending' : 'descending') : 'none'">
              №
              @if (sortColumn() === 'lineNumber') {
                <span class="sort-indicator">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-item" (click)="toggleSort('itemName')"
                [attr.aria-sort]="sortColumn() === 'itemName' ? (sortDirection() === 'asc' ? 'ascending' : 'descending') : 'none'">
              ТМЦ
              @if (sortColumn() === 'itemName') {
                <span class="sort-indicator">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-qty" (click)="toggleSort('quantity')"
                [attr.aria-sort]="sortColumn() === 'quantity' ? (sortDirection() === 'asc' ? 'ascending' : 'descending') : 'none'">
              {{ qtyLabel() }}
              @if (sortColumn() === 'quantity') {
                <span class="sort-indicator">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-cat-id">category_id</th>
            <th class="col-avail" (click)="toggleSort('availableQuantity')"
                [attr.aria-sort]="sortColumn() === 'availableQuantity' ? (sortDirection() === 'asc' ? 'ascending' : 'descending') : 'none'">
              {{ availLabel() }}
              @if (sortColumn() === 'availableQuantity') {
                <span class="sort-indicator">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-del"></th>
          </tr>
        </thead>
        <tbody>
          @for (line of filteredSortedLines(); track line.localId) {
            <tr
              [class.row--has-error]="!!submitErrorState(line.localId)"
              [class.row--has-error--stale]="!!submitErrorState(line.localId)?.stale"
              [class.unusable]="line.resolvedStatus && line.resolvedStatus !== 'active'"
              [attr.data-testid]="submitErrorState(line.localId) ? 'operation-line-row--error' : 'line-' + line.localId"
              [attr.data-line-status]="line.resolvedStatus ?? null"
            >
              <td class="col-num-cell">{{ line.lineNumber ?? '—' }}</td>
              <td class="col-item-cell">
                <div class="item-name">{{ line.itemName }}</div>
                <div class="item-meta">
                  <span class="item-meta-id">ID&nbsp;{{ line.itemId }}</span>
                  @if (line.sku) {
                    <span class="dot"></span>
                    <span class="item-meta-sku">SKU&nbsp;{{ line.sku }}</span>
                  }
                  @if (line.categoryName) {
                    <span class="dot"></span>
                    <span class="item-meta-cat">{{ line.categoryName }}</span>
                  }
                  <span class="dot"></span>
                  <span class="item-meta-unit">{{ line.unitName }}</span>
                  @if (line.resolvedStatus && line.resolvedStatus !== 'active') {
                    <span
                      class="line-status"
                      [class.line-status--merged]="line.resolvedStatus === 'merged'"
                      [class.line-status--deleted]="line.resolvedStatus === 'deleted'"
                      [class.line-status--inactive]="line.resolvedStatus === 'inactive'"
                      [class.line-status--missing]="line.resolvedStatus === 'missing'"
                      [attr.data-testid]="'line-blocked'"
                      [attr.data-status]="line.resolvedStatus"
                      [title]="line.blockReason ?? null">
                      {{ statusLabel(line.resolvedStatus) }}
                      @if (line.resolvedStatus === 'merged' && line.canonicalItemName) {
                        → {{ line.canonicalItemName }}@if (line.canonicalItemId) { ({{ line.canonicalItemId }})}
                      }
                    </span>
                  }
                </div>
              </td>
              <td class="col-qty">
                <input
                  type="number"
                  class="qty-input"
                  [class.qty-input--invalid]="!!line.error || !!submitErrorState(line.localId)"
                  [class.qty-input--readonly]="isReadonly()"
                  [ngModel]="line.quantity"
                  (ngModelChange)="onQtyChange(line.localId, $event)"
                  [disabled]="isReadonly()"
                  [attr.aria-invalid]="line.error || submitErrorState(line.localId) ? 'true' : null"
                  [attr.aria-describedby]="submitErrorState(line.localId) ? submitErrorHintId(line.localId) : null"
                  [attr.data-qty-for]="line.localId"
                  min="0"
                  step="0.001"
                />
                @if (line.error) {
                  <div class="qty-error">{{ line.error }}</div>
                } @else if (isObjectSourceFlow() && line.availableQuantity != null) {
                  <div class="qty-hint">Имеется на объекте: {{ line.availableQuantity }}</div>
                }
              </td>
              <td class="col-cat-id">
                <span class="cat-id-value">{{ line.categoryId ?? '—' }}</span>
              </td>
              <td class="col-avail">
                @if (line.inlineItem) {
                  <span class="avail-inline">будет создана при подтверждении</span>
                } @else if (isObjectSourceFlow()) {
                  @if (line.availableQuantity == null) {
                    <span class="avail-na">—</span>
                  } @else {
                    <span class="avail-value avail-value--object">{{ line.availableQuantity }}</span>
                  }
                } @else if (line.balanceState === 'LOADING') {
                  <span class="avail-loading">
                    <span class="mini-spinner" aria-hidden="true"></span>…
                  </span>
                } @else if (line.balanceState === 'ERROR') {
                  <span class="avail-error" data-testid="operation-line-balance-error">
                    <span class="dot" aria-hidden="true"></span>ошибка
                  </span>
                } @else if (line.balanceState === 'FRESH') {
                  <span
                    class="avail-value"
                    [class.avail-value--zero]="(line.availableQuantity ?? 0) === 0"
                  >{{ line.availableQuantity ?? 0 }}</span>
                } @else {
                  <span class="avail-na" data-testid="operation-line-balance-na">—</span>
                }
              </td>
              <td class="col-del">
                <button
                  class="remove-btn"
                  (click)="removeLine.emit(line.localId)"
                  title="Удалить"
                  aria-label="Удалить позицию"
                >×</button>
              </td>
            </tr>
            @if (submitErrorState(line.localId)) {
              <tr class="submit-error-detail-row">
                <td colspan="6">
                  <div class="submit-error-hint" [id]="submitErrorHintId(line.localId)" role="alert">
                    <span class="submit-error-hint-icon" aria-hidden="true">!</span>
                    <span data-testid="operation-line-submit-hint">{{ submitErrorState(line.localId)?.text }}</span>
                  </div>
                </td>
              </tr>
            }
          } @empty {
            <tr>
              <td colspan="6" class="empty-state">
                @if (lines().length === 0) {
                  Для добавления используйте поле «Добавить ТМЦ» выше
                } @else {
                  По фильтру добавленных позиций ничего не найдено
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    /* ─── Design tokens (TZ §11, scoped) ─────────────────────── */
    :host {
      --l-surface: #FFFFFF;
      --l-surface-2: #F8FAFC;
      --l-fg: #0F172A;
      --l-fg-2: #334155;
      --l-muted: #64748B;
      --l-muted-2: #94A3B8;
      --l-border: #E2E8F0;
      --l-border-2: #CBD5E1;
      --l-accent: #059669;
      --l-danger: #B91C1C;
      --l-danger-bg: #FEF2F2;
      --l-danger-border: #FECACA;
      --l-font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      --l-font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
      --l-r-sm: 4px;
      display: contents;
    }

    .lines-container {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
      background: var(--l-surface);
    }

    .lines-data-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 13px;
      table-layout: fixed;
      font-family: var(--l-font-body);
    }
    .lines-data-table col.col-num-col    { width: 44px; }
    .lines-data-table col.col-item-col   { width: auto; }
    .lines-data-table col.col-qty-col    { width: 130px; }
    .lines-data-table col.col-cat-col    { width: 130px; }
    .lines-data-table col.col-avail-col  { width: 130px; }
    .lines-data-table col.col-actions-col{ width: 60px; }

    .lines-data-table thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--l-surface-2);
      border-bottom: 1px solid var(--l-border-2);
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--l-muted);
      font-weight: 550;
      padding: 8px 10px;
      height: 34px;
      white-space: nowrap;
      user-select: none;
      cursor: pointer;
    }
    .lines-data-table thead th.col-cat-id,
    .lines-data-table thead th.col-del { cursor: default; }
    .lines-data-table thead th:hover:not(.col-cat-id):not(.col-del) { background: #F1F5F9; }

    .lines-data-table tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--l-border);
      vertical-align: top;
      height: 44px;
    }
    .lines-data-table tbody tr:hover td { background: var(--l-surface-2); }

    .col-num-cell {
      font-family: var(--l-font-mono);
      font-size: 12px;
      color: var(--l-muted);
      text-align: right;
      width: 28px;
    }
    .col-item-cell {
      min-width: 0;
      padding-right: 14px !important;
    }
    .col-qty, .col-cat-id, .col-avail, .col-del { vertical-align: top; }
    .col-del { text-align: right; padding-right: 14px !important; }

    .sort-indicator {
      margin-left: 4px;
      font-size: 10px;
      color: var(--l-muted-2);
    }

    .item-name {
      font-size: 13.5px;
      color: var(--l-fg);
      font-weight: 500;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
    }
    .item-meta {
      margin-top: 2px;
      font-size: 11.5px;
      color: var(--l-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      line-height: 1.3;
    }
    .item-meta-id { font-family: var(--l-font-mono); color: var(--l-muted); font-weight: 500; }
    .item-meta-sku { font-family: var(--l-font-mono); color: var(--l-muted-2); }
    .item-meta-cat { color: var(--l-muted); }
    .item-meta-unit { color: var(--l-muted-2); }
    .item-meta .dot {
      width: 3px; height: 3px;
      border-radius: 50%;
      background: var(--l-border-2);
      display: inline-block;
      flex-shrink: 0;
    }

    .qty-input {
      width: 72px;
      height: 28px;
      padding: 0 6px;
      border: 1px solid var(--l-border-2);
      border-radius: var(--l-r-sm);
      font-family: var(--l-font-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--l-fg);
      background: var(--l-surface);
      text-align: right;
      box-sizing: border-box;
      transition: border-color 120ms ease, box-shadow 120ms ease;
      -moz-appearance: textfield;
    }
    .qty-input::-webkit-outer-spin-button,
    .qty-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .qty-input:hover { border-color: var(--l-muted-2); }
    .qty-input:focus {
      outline: none;
      border-color: var(--l-accent);
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
    }
    .qty-input--invalid {
      border-color: var(--l-danger);
      box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.12);
      background: var(--l-danger-bg);
    }
    .qty-input--readonly {
      background: var(--l-surface-2);
      color: var(--l-fg);
      cursor: default;
    }
    .qty-error {
      font-size: 11px;
      color: var(--l-danger);
      margin-top: 4px;
      max-width: 220px;
    }
    .qty-hint {
      font-size: 11px;
      color: var(--l-muted-2);
      margin-top: 4px;
    }

    .col-cat-id .cat-id-value {
      font-family: var(--l-font-mono);
      font-size: 12px;
      color: var(--l-muted);
      letter-spacing: -0.01em;
    }

    .avail-value {
      font-family: var(--l-font-mono);
      font-size: 13px;
      font-weight: 500;
      color: var(--l-fg);
    }
    .avail-value--zero { color: var(--l-muted); }
    .avail-value--object { color: #2563EB; }
    .avail-loading {
      font-family: var(--l-font-mono);
      font-size: 13px;
      color: var(--l-muted-2);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .avail-error {
      font-family: var(--l-font-mono);
      font-size: 13px;
      color: var(--l-danger);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .avail-error .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--l-danger);
    }
    .avail-na {
      font-family: var(--l-font-mono);
      font-size: 13px;
      color: var(--l-muted-2);
    }
    .avail-inline {
      font-size: 11.5px;
      color: var(--l-muted);
      font-style: italic;
    }

    .mini-spinner {
      display: inline-block;
      width: 11px; height: 11px;
      border-radius: 50%;
      border: 1.5px solid var(--l-border-2);
      border-top-color: var(--l-muted);
      animation: lines-spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    @keyframes lines-spin { to { transform: rotate(360deg); } }

    .remove-btn {
      width: 26px; height: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid transparent;
      border-radius: var(--l-r-sm);
      background: transparent;
      color: var(--l-muted-2);
      cursor: pointer;
      font-size: 16px;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    }
    .remove-btn:hover {
      background: var(--l-danger-bg);
      color: var(--l-danger);
    }
    .remove-btn:focus-visible {
      outline: 2px solid var(--l-danger);
      outline-offset: 1px;
    }

    .empty-state {
      text-align: center;
      padding: 24px 16px;
      color: var(--l-muted-2);
      font-size: 13px;
    }

    /* Submit-error inline highlighting (TZ-FRONTEND). */
    .row--has-error > td {
      background-color: var(--l-danger-bg);
    }
    .row--has-error > td:first-child {
      box-shadow: inset 3px 0 0 var(--l-danger);
    }
    .row--has-error--stale > td:first-child {
      box-shadow: inset 3px 0 0 var(--l-danger);
      border-left-style: dashed;
    }
    .submit-error-detail-row > td {
      background-color: var(--l-danger-bg);
      border-bottom: 1px solid var(--l-danger-border);
      padding-top: 4px;
      padding-bottom: 4px;
    }
    .submit-error-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #991B1B;
      line-height: 1.4;
    }
    .submit-error-hint-icon {
      flex-shrink: 0;
      font-size: 13px;
      line-height: 1;
    }

    /* Blocked-line markers (TZ-V3.2 §5.2 W1.3). */
    .unusable {
      background: var(--l-danger-bg) !important;
    }
    .unusable td {
      color: var(--l-muted);
    }
    .line-status {
      display: inline-block;
      margin-left: 0;
      padding: 2px 8px;
      border-radius: var(--l-r-sm);
      font-size: 11px;
      font-weight: 550;
      vertical-align: middle;
    }
    .line-status--merged { background: #FFFBEB; color: #92400E; }
    .line-status--deleted { background: var(--l-danger-bg); color: var(--l-danger); }
    .line-status--inactive { background: #F3F4F6; color: var(--l-muted); }
    .line-status--missing { background: var(--l-danger-bg); color: var(--l-danger); }
  `]
})
export class OperationLinesTableComponent {
  lines = input.required<OperationLineDraftVm[]>();
  warehouseSiteId = input<string | null>(null);
  isBalanceRefreshing = input<boolean>(false);
  operationType = input<OperationType | null>(null);
  isObjectSourceFlow = input<boolean>(false);
  /** localId → submit-error display state (from the modal's SubmitErrorService). */
  submitErrorLines = input<Record<string, LineSubmitErrorState>>({});
  /** Filter text from the parent modal's lines-filter row (TZ §14). */
  nameFilter = input<string>('');
  /** Read-only mode (submitted/cancelled operation); qty inputs become disabled (TZ §9). */
  isReadonly = input<boolean>(false);

  quantityChange = output<LineQuantityChange>();
  removeLine = output<string>();
  sortChange = output<{ column: SortColumn; direction: SortDirection }>();

  readonly sortColumn = signal<SortColumn>('lineNumber');
  readonly sortDirection = signal<SortDirection>('asc');

  readonly qtyLabel = computed(() => {
    const t = this.operationType();
    if (t === 'RECEIVE') return 'Количество';
    return 'Отправляемое количество';
  });

  readonly availLabel = computed(() => {
    return this.isObjectSourceFlow() ? 'Имеется на объекте' : 'Имеется';
  });

  readonly filteredSortedLines = computed(() => {
    let result = [...this.lines()];

    // Name filter (driven by parent modal's lines-filter row).
    const filter = (this.nameFilter() ?? '').toLowerCase().trim();
    if (filter) {
      result = result.filter(l => l.itemName.toLowerCase().includes(filter));
    }

    // Sort
    const col = this.sortColumn();
    const dir = this.sortDirection();
    result.sort((a, b) => {
      let av: any;
      let bv: any;
      if (col === 'itemName') { av = a.itemName; bv = b.itemName; }
      else if (col === 'lineNumber') { av = a.lineNumber ?? 0; bv = b.lineNumber ?? 0; }
      else if (col === 'quantity') { av = a.quantity ?? 0; bv = b.quantity ?? 0; }
      else if (col === 'availableQuantity') { av = a.availableQuantity ?? 0; bv = b.availableQuantity ?? 0; }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  toggleSort(col: SortColumn): void {
    if (this.sortColumn() === col) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDirection.set('asc');
    }
    this.sortChange.emit({ column: this.sortColumn(), direction: this.sortDirection() });
  }

  onQtyChange(localId: string, value: number | null): void {
    this.quantityChange.emit({ localId, quantity: value });
  }

  submitErrorHintId(localId: string): string {
    return `submit-error-hint-${localId}`;
  }

  submitErrorState(localId: string): LineSubmitErrorState | undefined {
    return this.submitErrorLines()[localId];
  }

  statusLabel(status: 'active' | 'merged' | 'inactive' | 'deleted' | 'missing'): string {
    switch (status) {
      case 'merged': return 'Объединена';
      case 'deleted': return 'Удалена';
      case 'inactive': return 'Неактивна';
      case 'missing': return 'Отсутствует';
      case 'active': return 'Активна';
    }
  }
}