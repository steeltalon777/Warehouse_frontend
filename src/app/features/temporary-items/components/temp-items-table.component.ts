import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemporaryItemVm, TempItemUiStatus, TEMP_ITEM_UI_STATUS_COLORS } from '../../../core/models/temp-items.models';

@Component({
  selector: 'app-temp-items-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="table-wrapper">
      <table class="wh-table data-table">
        <thead>
          <tr>
            <th class="col-name" (click)="sort.emit('name')">
              Название
              @if (sortColumn() === 'name') { <span class="sort-arrow">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span> }
            </th>
            <th class="col-date" (click)="sort.emit('createdAt')">
              Создана
              @if (sortColumn() === 'createdAt') { <span class="sort-arrow">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span> }
            </th>
            <th class="col-balance" (click)="sort.emit('totalBalance')">
              Остаток
              @if (sortColumn() === 'totalBalance') { <span class="sort-arrow">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span> }
            </th>
            <th class="col-ops" (click)="sort.emit('operationsCount')">
              Операции
              @if (sortColumn() === 'operationsCount') { <span class="sort-arrow">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span> }
            </th>
            <th class="col-author" (click)="sort.emit('createdByUserId')">
              Создал
              @if (sortColumn() === 'createdByUserId') { <span class="sort-arrow">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span> }
            </th>
            <th class="col-status" (click)="sort.emit('uiStatus')">
              Статус
              @if (sortColumn() === 'uiStatus') { <span class="sort-arrow">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span> }
            </th>
            <th class="col-actions">Действия</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr class="data-row" (click)="rowClick.emit(row)">
              <td class="col-name">
                <a class="item-link" (click)="$event.stopPropagation(); navigateToCatalog.emit(row.id)" [title]="'Открыть в каталоге: ' + row.name">
                  {{ row.name }}
                </a>
              </td>
              <td class="col-date">{{ row.createdAt }}</td>
              <td class="col-balance">{{ row.totalBalance }} {{ row.unitSymbol || '' }}</td>
              <td class="col-ops">{{ row.operationsCount }}</td>
              <td class="col-author">{{ row.createdByUserId }}</td>
              <td class="col-status">
                <span class="status-badge wh-badge" [class]="statusClass(row.uiStatus)">
                  {{ row.uiStatusLabel }}
                </span>
              </td>
              <td class="col-actions" (click)="$event.stopPropagation()">
                <div class="action-buttons">
                  <button class="wh-btn-icon btn-icon" title="Открыть" (click)="rowClick.emit(row)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  @if (row.uiStatus === 'needs_review') {
                    <button class="wh-btn-icon btn-icon btn-confirm" title="Подтвердить" (click)="confirmItem.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                  }
                  @if (row.canConvert) {
                    <button class="wh-btn-icon btn-icon" title="Преобразовать" (click)="convert.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                  }
                  @if (row.canMergeToPermanent) {
                    <button class="wh-btn-icon btn-icon" title="Слить" (click)="merge.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
                    </button>
                  }
                  @if (row.canDelete) {
                    <button class="wh-btn-icon wh-btn-icon--danger btn-icon danger" title="Удалить" (click)="deleteItem.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7" class="empty-state">Временные ТМЦ не найдены</td>
            </tr>
          }
        </tbody>
      </table>

      @if (totalCount() > 0) {
        <div class="pagination-bar">
          <div class="page-size">
            <span>На странице:</span>
            <select [value]="pageSize()" (change)="onPageSizeChange($event)">
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
          <div class="page-info">
            {{ ((page() - 1) * pageSize()) + 1 }}–{{ Math.min(page() * pageSize(), totalCount()) }} из {{ totalCount() }}
          </div>
          <div class="page-buttons">
            <button class="wh-btn wh-btn--secondary btn-page" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">←</button>
            <span class="page-current">{{ page() }}</span>
            <button class="wh-btn wh-btn--secondary btn-page" [disabled]="page() * pageSize() >= totalCount()" (click)="pageChange.emit(page() + 1)">→</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .table-wrapper { flex: 1; overflow: auto; display: flex; flex-direction: column; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; color: #1F2937; table-layout: fixed; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #E2E8F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data-table th { font-weight: 600; color: #475569; background: #F8FAFC; cursor: pointer; user-select: none; position: sticky; top: 0; z-index: 2; }
    .data-table th:hover { background: #F1F5F9; }
    .data-table tbody .data-row { cursor: pointer; transition: background 0.1s; }
    .data-table tbody .data-row:hover { background: #F8FAFC; }
    .col-name { width: auto; min-width: 140px; }
    .col-date { width: 140px; }
    .col-balance { width: 90px; text-align: right; }
    .col-ops { width: 80px; text-align: center; }
    .col-author { width: 120px; }
    .col-status { width: 150px; }
    .col-actions { width: 120px; }
    .sort-arrow { margin-left: 4px; font-size: 10px; color: #94A3B8; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; line-height: 1.4; }
    .action-buttons { display: flex; gap: 4px; }
    .btn-icon { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; color: #64748B; cursor: pointer; transition: all 0.15s; }
    .btn-icon:hover:not(:disabled) { background: #F1F5F9; color: #374151; border-color: #CBD5E1; }
    .btn-icon.danger:hover:not(:disabled) { background: #FEE2E2; color: #991B1B; border-color: #FECACA; }
    .btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
    .empty-state { text-align: center; padding: 40px 16px; color: #94A3B8; font-size: 14px; }
    .pagination-bar { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #E2E8F0; background: #FFFFFF; gap: 12px; }
    .page-size { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; }
    .page-size select { height: 28px; padding: 0 6px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; font-family: inherit; }
    .page-info { font-size: 13px; color: #64748B; }
    .page-buttons { display: flex; align-items: center; gap: 6px; }
    .btn-page { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #D1D5DB; border-radius: 6px; background: #FFFFFF; font-size: 14px; color: #374151; cursor: pointer; }
    .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-current { font-size: 13px; font-weight: 600; color: #1E293B; min-width: 24px; text-align: center; }
    .btn-confirm { color: #16A34A; }
    .btn-confirm:hover { background: #F0FDF4; }
    .item-link { color: #2563EB; text-decoration: none; cursor: pointer; }
    .item-link:hover { text-decoration: underline; color: #1D4ED8; }
  `]
})
export class TempItemsTableComponent {
  readonly Math = Math;
  readonly rows = input<TemporaryItemVm[]>([]);
  readonly sortColumn = input<string>('');
  readonly sortDir = input<'asc' | 'desc'>('desc');
  readonly pageSize = input<number>(20);
  readonly page = input<number>(1);
  readonly totalCount = input<number>(0);

  readonly sort = output<string>();
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly rowClick = output<TemporaryItemVm>();
  readonly convert = output<TemporaryItemVm>();
  readonly merge = output<TemporaryItemVm>();
  readonly deleteItem = output<TemporaryItemVm>();
  readonly confirmItem = output<TemporaryItemVm>();
  readonly navigateToCatalog = output<string>();

  onPageSizeChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSizeChange.emit(value);
  }

  statusClass(uiStatus: TempItemUiStatus): string {
    const color = TEMP_ITEM_UI_STATUS_COLORS[uiStatus] || 'neutral';
    return `wh-badge--${color}`;
  }
}
