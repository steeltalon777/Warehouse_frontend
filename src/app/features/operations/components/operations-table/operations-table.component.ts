import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MinPipe } from '../../../../core/pipes/min.pipe';
import {
  OperationListRowVm,
} from '../../../../core/models/operations.models';

@Component({
  selector: 'app-operations-table',
  standalone: true,
  imports: [CommonModule, MinPipe],
  template: `
      <div class="table-wrapper">
        <table class="wh-table data-table">
        <thead class="sticky-header">
          <tr>
            <th class="col-number" (click)="sort.emit('number')">
              №
              @if (sortColumn() === 'number') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-type" (click)="sort.emit('type')">
              Тип
              @if (sortColumn() === 'type') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-status" (click)="sort.emit('status')">
              Статус
              @if (sortColumn() === 'status') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-direction">Направление</th>
            <th class="col-date" (click)="sort.emit('createdAt')">
              Дата создания
              @if (sortColumn() === 'createdAt') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-author" (click)="sort.emit('createdByLabel')">
              Автор
              @if (sortColumn() === 'createdByLabel') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-lines" (click)="sort.emit('linesCount')">
              Позиций
              @if (sortColumn() === 'linesCount') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-actions">Действия</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr class="row" (click)="rowClick.emit(row)">
              <td class="col-number">{{ row.number }}</td>
              <td class="col-type">
                <span class="badge type-badge wh-badge {{ typeClass(row.type) }}">
                  {{ row.typeLabel }}
                </span>
              </td>
              <td class="col-status">
                <span class="badge status-badge wh-badge {{ statusClass(row.status) }}">
                  {{ row.statusLabel }}
                </span>
              </td>
              <td class="col-direction">{{ row.directionLabel }}</td>
              <td class="col-date">{{ row.createdAt | date:'dd.MM.yyyy HH:mm' }}</td>
              <td class="col-author">{{ row.createdByLabel }}</td>
              <td class="col-lines">{{ row.linesCount }}</td>
              <td class="col-actions" (click)="$event.stopPropagation()">
                <div class="action-buttons">
                  @if (row.canEdit) {
                    <button class="wh-btn-icon btn-icon" title="Редактировать" aria-label="Редактировать операцию" (click)="rowEdit.emit(row)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  }
                  @if (row.canSubmit) {
                    <button class="wh-btn-icon wh-btn-icon--success btn-icon success" title="Подтвердить" aria-label="Подтвердить операцию" (click)="rowSubmit.emit(row)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  }
                  @if (row.canCancel) {
                    <button class="wh-btn-icon wh-btn-icon--danger btn-icon danger" title="Отменить" aria-label="Отменить операцию" (click)="rowCancel.emit(row)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  }
                  @if (row.canPrint) {
                    <button class="wh-btn-icon btn-icon" title="Печать" disabled>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    </button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="empty-state">Операции не найдены</td>
            </tr>
          }
        </tbody>
      </table>

      <!-- Pagination -->
      @if (totalCount() > 0) {
        <div class="pagination-bar">
          <div class="page-size">
            <span>На странице:</span>
            <select [value]="pageSize()" (change)="onPageSizeChange($event)">
              <option [value]="10">10</option>
              <option [value]="20">20</option>
              <option [value]="50">50</option>
            </select>
          </div>

          <div class="page-info">
            {{ ((page() - 1) * pageSize()) + 1 }}–{{ [page() * pageSize(), totalCount()] | min }} из {{ totalCount() }}
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

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      color: #1F2937;
      table-layout: fixed;
    }
    .data-table th, .data-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #E2E8F0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .data-table th {
      font-weight: 600;
      color: #475569;
      background: #F8FAFC;
      cursor: pointer;
      user-select: none;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .data-table th:hover { background: #F1F5F9; }
    .data-table tbody tr { cursor: pointer; transition: background 0.1s; }
    .data-table tbody tr:hover { background: #F8FAFC; }

    .col-number { width: 90px; }
    .col-type { width: 110px; }
    .col-status { width: 130px; }
    .col-direction { width: auto; }
    .col-date { width: 140px; }
    .col-author { width: 130px; }
    .col-lines { width: 80px; text-align: center; }
    .col-actions { width: 130px; }

    .sort-arrow { margin-left: 4px; font-size: 10px; color: #94A3B8; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
    }

    .action-buttons {
      display: flex;
      gap: 4px;
    }
    .btn-icon {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      background: #FFFFFF;
      color: #64748B;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-icon:hover:not(:disabled) { background: #F1F5F9; color: #374151; border-color: #CBD5E1; }
    .btn-icon.success:hover:not(:disabled) { background: #DCFCE7; color: #166534; border-color: #BBF7D0; }
    .btn-icon.danger:hover:not(:disabled) { background: #FEE2E2; color: #991B1B; border-color: #FECACA; }
    .btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }

    .empty-state {
      text-align: center;
      padding: 40px 16px;
      color: #94A3B8;
      font-size: 14px;
    }

    .pagination-bar {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-top: 1px solid #E2E8F0;
      background: #FFFFFF;
      gap: 12px;
    }
    .page-size { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; }
    .page-size select {
      height: 28px;
      padding: 0 6px;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
    }
    .page-info { font-size: 13px; color: #64748B; }
    .page-buttons { display: flex; align-items: center; gap: 6px; }
    .btn-page {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      background: #FFFFFF;
      font-size: 14px;
      color: #374151;
      cursor: pointer;
    }
    .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-current { font-size: 13px; font-weight: 600; color: #1E293B; min-width: 24px; text-align: center; }
  `]
})
export class OperationsTableComponent {
  rows = input.required<OperationListRowVm[]>();
  sortColumn = input.required<string>();
  sortDirection = input.required<'asc' | 'desc'>();
  pageSize = input.required<number>();
  page = input.required<number>();
  totalCount = input.required<number>();

  sort = output<string>();
  pageChange = output<number>();
  pageSizeChange = output<number>();
  rowClick = output<OperationListRowVm>();
  rowEdit = output<OperationListRowVm>();
  rowSubmit = output<OperationListRowVm>();
  rowCancel = output<OperationListRowVm>();

  onPageSizeChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSizeChange.emit(value);
  }

  typeClass(type: string | undefined): string {
    return type ? `wh-badge--type-${type.toLowerCase()}` : 'wh-badge--type-unknown';
  }

  statusClass(status: string | undefined): string {
    return status ? `wh-badge--status-${status}` : 'wh-badge--status-unknown';
  }
}
