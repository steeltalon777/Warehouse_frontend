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
        <div class="table-scroll" data-testid="operations-table-scroll">
        <table class="wh-table data-table" data-testid="operations-table">
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
            <th class="col-direction" (click)="sort.emit('directionLabel')">
              Направление
              @if (sortColumn() === 'directionLabel') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-positions" (click)="sort.emit('linesCount')">
              Поз.
              @if (sortColumn() === 'linesCount') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-comment" (click)="sort.emit('comment')">
              Комментарий
              @if (sortColumn() === 'comment') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-date" (click)="sort.emit('createdAt')">
              Дата
              @if (sortColumn() === 'createdAt') {
                <span class="sort-arrow">{{ sortDirection() === 'asc' ? '▲' : '▼' }}</span>
              }
            </th>
            <th class="col-actions">Действия</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.id) {
            <tr class="row" data-testid="operation-row">
              <td class="col-number" data-testid="operation-number-link">
                @if (row.displayNumber || row.number) {
                  <button class="wh-link number-link" (click)="numberClick.emit(row)" title="Открыть операцию">
                    {{ row.displayNumber || row.number }}
                  </button>
                }
              </td>
              <td class="col-type" data-testid="operation-type-cell">
                <span class="badge type-badge wh-badge {{ typeClass(row.type) }}">
                  {{ row.typeLabel }}
                </span>
              </td>
              <td class="col-status" data-testid="operation-status-cell">
                <div class="status-stack">
                  @for (line of row.statusLines; track $index) {
                    @if (line.kind === 'operation_status') {
                      <span class="status-line {{ statusClass(row.status) }}">{{ line.label }}</span>
                    } @else {
                      <span class="status-line {{ acceptanceClass(line.acceptanceState) }}">{{ line.label }}</span>
                    }
                  }
                </div>
              </td>
              <td class="col-direction" data-testid="operation-direction-cell" [title]="row.directionLabel">{{ row.directionLabel }}</td>
              <td class="col-positions" data-testid="operation-items-count-cell">{{ row.positionCount }}</td>
              <td
                class="col-comment"
                data-testid="operation-comment-cell"
                [attr.title]="row.comment?.trim() ? row.comment : null"
              >
                <span class="comment-text">{{ row.comment?.trim() || '—' }}</span>
              </td>
              <td class="col-date" data-testid="operation-date-cell">{{ row.createdAt | date:'dd.MM.yyyy HH:mm' }}</td>
              <td class="col-actions" (click)="$event.stopPropagation()">
                <div class="action-stack">
                  @if (row.canInvoice) {
                    <button
                      class="wh-btn-icon btn-icon"
                      data-testid="operation-action-pdf"
                      [disabled]="invoiceLoadingOperationId() === row.id"
                      [title]="invoiceLoadingOperationId() === row.id ? 'Формируется накладная...' : 'Накладная'"
                      [attr.aria-label]="invoiceLoadingOperationId() === row.id ? 'Накладная (формируется)' : 'Накладная'"
                      (click)="rowInvoice.emit(row)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    </button>
                  } @else {
                    <button class="wh-btn-icon btn-icon" disabled title="Накладная доступна для черновиков и проведённых операций" aria-label="Накладная (недоступно)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    </button>
                  }
                  @if (row.canEdit) {
                    <button class="wh-btn-icon btn-icon" data-testid="operation-action-edit" title="Редактировать" aria-label="Редактировать операцию" (click)="rowEdit.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  }
                  @if (row.canSubmit) {
                    <button class="wh-btn-icon wh-btn-icon--success btn-icon success" data-testid="operation-action-submit" title="Подтвердить" aria-label="Подтвердить операцию" (click)="rowSubmit.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                  }
                  @if (row.canCancel) {
                    <button class="wh-btn-icon wh-btn-icon--danger btn-icon danger" data-testid="operation-action-cancel" title="Отменить" aria-label="Отменить операцию" (click)="rowCancel.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  }
                  @if (row.canAccept) {
                    <button class="wh-btn-icon btn-icon" title="Приёмка" aria-label="Приёмка" (click)="rowAccept.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    </button>
                  }
                  @if (row.canDelete) {
                    <button class="wh-btn-icon wh-btn-icon--danger btn-icon" data-testid="operation-action-delete" title="Удалить" aria-label="Удалить операцию" (click)="rowDelete.emit(row)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  }
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="empty-state" data-testid="operations-empty-state">Операции не найдены</td>
            </tr>
          }
        </tbody>
      </table>
      </div>

      <!-- Pagination -->
      @if (totalCount() > 0) {
        <div class="pagination-bar" data-testid="operations-pagination">
          <div class="page-size">
            <span>На странице:</span>
            <select [value]="pageSize()" data-testid="operations-page-size-select" (change)="onPageSizeChange($event)">
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
    :host { display: flex; flex: 1; min-height: 0; height: 100%; }
    .table-wrapper { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
    .table-scroll { flex: 1; min-height: 0; overflow: auto; }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      color: #1F2937;
      table-layout: fixed;
    }
    .data-table th, .data-table td {
      padding: 8px 8px;
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

    .col-number { width: 9%; min-width: 80px; }
    .col-type { width: 8%; min-width: 80px; }
    .col-status { width: 7%; min-width: 70px; }
    .col-direction { width: 18%; min-width: 130px; }
    .col-positions { width: 4%; min-width: 40px; text-align: center; }
    .col-comment { width: 28%; min-width: 220px; max-width: 28%; }
    .comment-text {
      display: block;
      max-width: 42ch;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .col-date { width: 13%; min-width: 130px; white-space: nowrap; }
    .col-actions { width: 160px; min-width: 160px; text-align: center; }

    .number-link {
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      color: #2563EB;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .number-link:hover { color: #1D4ED8; }

    .sort-arrow { margin-left: 4px; font-size: 10px; color: #94A3B8; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
    }

    .status-stack {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .status-line {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;
    }

    .action-stack {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 6px;
      align-items: center;
      justify-content: center;
    }
    .btn-icon {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      background: #FFFFFF;
      color: #64748B;
      cursor: pointer;
      transition: all 0.15s;
      padding: 0;
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

    .wh-badge--acceptance-pending { background: #FEF3C7; color: #92400E; }
    .wh-badge--acceptance-in-progress { background: #DBEAFE; color: #1E40AF; }
    .wh-badge--acceptance-resolved { background: #ECFDF5; color: #065F46; }
    .wh-badge--acceptance-unknown { background: #F3F4F6; color: #6B7280; }
  `]
})
export class OperationsTableComponent {
  rows = input.required<OperationListRowVm[]>();
  sortColumn = input.required<string>();
  sortDirection = input.required<'asc' | 'desc'>();
  pageSize = input.required<number>();
  page = input.required<number>();
  totalCount = input.required<number>();
  invoiceLoadingOperationId = input<string | null>(null);

  sort = output<string>();
  pageChange = output<number>();
  pageSizeChange = output<number>();
  rowClick = output<OperationListRowVm>();
  numberClick = output<OperationListRowVm>();
  rowEdit = output<OperationListRowVm>();
  rowSubmit = output<OperationListRowVm>();
  rowCancel = output<OperationListRowVm>();
  rowInvoice = output<OperationListRowVm>();
  rowAccept = output<OperationListRowVm>();
  rowDelete = output<OperationListRowVm>();

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

  acceptanceClass(state: string | undefined | null): string {
    switch (state) {
      case 'pending': return 'wh-badge--acceptance-pending';
      case 'in_progress': return 'wh-badge--acceptance-in-progress';
      case 'resolved': return 'wh-badge--acceptance-resolved';
      default: return 'wh-badge--acceptance-unknown';
    }
  }
}
