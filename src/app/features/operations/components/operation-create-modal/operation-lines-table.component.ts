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
      <!-- Table-local filter is useful only for longer added-position lists. -->
      @if (showTableFilter()) {
        <div class="table-filter-row">
          <label class="filter-label">Фильтр добавленных позиций</label>
          <input
            type="text"
            class="wh-form-input filter-input"
            [ngModel]="nameFilter()"
            (ngModelChange)="nameFilter.set($event)"
            placeholder="Фильтр уже добавленных ТМЦ..."
            aria-label="Фильтр добавленных позиций"
          />
        </div>
      }

      <div class="table-scroll">
        <table class="wh-table lines-data-table">
          <thead>
            <tr>
              <th class="col-num" (click)="toggleSort('lineNumber')">
                №
                @if (sortColumn() === 'lineNumber') {
                  <span class="sort-indicator">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="col-name" (click)="toggleSort('itemName')">
                ТМЦ
                @if (sortColumn() === 'itemName') {
                  <span class="sort-indicator">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="col-qty" (click)="toggleSort('quantity')">
                {{ qtyLabel() }}
                @if (sortColumn() === 'quantity') {
                  <span class="sort-indicator">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
                }
              </th>
              <th class="col-avail" (click)="toggleSort('availableQuantity')">
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
                <td class="col-num">{{ line.lineNumber ?? '—' }}</td>
                <td class="col-name">
                  <div class="item-info">
                    <span class="item-name">{{ line.itemName }}</span>
                    @if (line.sku) {
                      <span class="item-sku">{{ line.sku }}</span>
                    }
                    @if (line.categoryName) {
                      <span class="item-cat">{{ line.categoryName }}</span>
                    }
                    <span class="item-unit">{{ line.unitName }}</span>
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
                    class="wh-form-input qty-input"
                    [class.qty-input--invalid]="!!line.error || !!submitErrorState(line.localId)"
                    [ngModel]="line.quantity"
                    (ngModelChange)="onQtyChange(line.localId, $event)"
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
                <td class="col-avail">
                  @if (line.inlineItem) {
                    <span class="avail-inline">будет создана при подтверждении</span>
                  } @else if (isBalanceRefreshing()) {
                    <span class="avail-loading">…</span>
                  } @else if (isObjectSourceFlow() && line.availableQuantity == null) {
                    <span class="avail-na">—</span>
                  } @else {
                    <span class="avail-value" [class.avail-value--object]="isObjectSourceFlow()">
                      {{ availableQuantity(line) }}
                    </span>
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
                  <td colspan="5">
                    <div class="submit-error-hint" [id]="submitErrorHintId(line.localId)" role="alert">
                      <span class="submit-error-hint-icon" aria-hidden="true">!</span>
                      <span data-testid="operation-line-submit-hint">{{ submitErrorState(line.localId)?.text }}</span>
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td colspan="5" class="empty-state">
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
    </div>
  `,
  styles: [`
    .lines-container {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
    }
    .table-filter-row {
      flex-shrink: 0;
      margin-bottom: 6px;
    }
    .filter-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #64748B;
      margin-bottom: 4px;
    }
    .filter-input {
      width: 100%;
      height: 32px;
      padding: 0 10px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      box-sizing: border-box;
    }
    .filter-input:focus {
      outline: none;
      border-color: #3B82F6;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
    }

    .table-scroll {
      flex: 1;
      overflow-y: auto;
      min-height: 100px;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
    }

    .lines-data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      table-layout: fixed;
    }
    .lines-data-table th,
    .lines-data-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #E2E8F0;
      text-align: left;
    }
    .lines-data-table th {
      font-weight: 600;
      color: #475569;
      background: #F8FAFC;
      font-size: 12px;
      cursor: pointer;
      user-select: none;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .lines-data-table th:hover { background: #F1F5F9; }
    .lines-data-table tbody tr:hover { background: #FAFAFA; }

    .col-num { width: 40px; text-align: center; color: #94A3B8; font-size: 12px; white-space: nowrap; }
    .col-name { width: 55%; }
    .col-qty { width: 20%; }
    .col-avail { width: 15%; }
    .col-del { width: 5%; text-align: center; }

    .sort-indicator {
      margin-left: 4px;
      font-size: 10px;
      color: #94A3B8;
    }

    .item-info {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .item-name { font-weight: 500; color: #1F2937; }
    .item-sku { font-size: 11px; color: #94A3B8; }
    .item-cat { font-size: 11px; color: #6B7280; }
    .item-unit { font-size: 11px; color: #94A3B8; }

    .qty-input {
      width: 100%;
      max-width: 120px;
      height: 32px;
      padding: 0 8px;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      box-sizing: border-box;
    }
    .qty-input:focus {
      outline: none;
      border-color: #3B82F6;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
    }
    .qty-input--invalid {
      border-color: #DC2626;
      background: #FEF2F2;
    }
    .qty-input--invalid:focus {
      border-color: #DC2626;
      box-shadow: 0 0 0 2px rgba(220,38,38,0.15);
    }
    .qty-error {
      font-size: 11px;
      color: #DC2626;
      margin-top: 2px;
      max-width: 220px;
    }
    .qty-hint {
      font-size: 11px;
      color: #94A3B8;
      margin-top: 2px;
    }

    .avail-value { font-weight: 500; color: #059669; }
    .avail-value--object { color: #2563EB; }
    .avail-loading { color: #94A3B8; }
    .avail-na { color: #CBD5E1; }
    .avail-inline { font-size: 11px; color: #64748B; font-style: italic; }

    .remove-btn {
      width: 26px; height: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid #E2E8F0; border-radius: 6px;
      background: #FFFFFF; color: #64748B; cursor: pointer;
      font-size: 16px;
    }
    .remove-btn:hover { background: #FEE2E2; color: #991B1B; border-color: #FECACA; }

    .empty-state {
      text-align: center;
      padding: 24px 16px;
      color: #94A3B8;
      font-size: 13px;
    }

    /* Submit-error inline highlighting (TZ-FRONTEND). */
    .row--has-error > td {
      background-color: #FEF2F2;
    }
    .row--has-error > td:first-child {
      border-left: 3px solid var(--color-error, #c00);
    }
    .row--has-error--stale > td:first-child {
      border-left-style: dashed;
    }
    .submit-error-detail-row > td {
      background-color: #FEF2F2;
      border-bottom: 1px solid #FECACA;
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
      background: #FEF2F2 !important;
    }
    .unusable td {
      color: #6B7280;
    }
    .line-status {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      vertical-align: middle;
    }
    .line-status--merged { background: #FFFBEB; color: #D97706; }
    .line-status--deleted { background: #FEF2F2; color: #DC2626; }
    .line-status--inactive { background: #F3F4F6; color: #6B7280; }
    .line-status--missing { background: #FEF2F2; color: #DC2626; }
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

  quantityChange = output<LineQuantityChange>();
  removeLine = output<string>();
  sortChange = output<{ column: SortColumn; direction: SortDirection }>();

  readonly sortColumn = signal<SortColumn>('lineNumber');
  readonly sortDirection = signal<SortDirection>('asc');
  readonly nameFilter = signal<string>('');

  readonly showTableFilter = computed(() => this.lines().length > 3);

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

    // Name filter
    const filter = this.nameFilter().toLowerCase().trim();
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

  availableQuantity(line: OperationLineDraftVm): number {
    return line.availableQuantity ?? 0;
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