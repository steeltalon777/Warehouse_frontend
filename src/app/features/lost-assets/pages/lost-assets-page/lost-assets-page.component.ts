import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LostAssetsService } from '../../../../core/services/lost-assets.service';
import { OperationsService } from '../../../../core/services/operations.service';
import {
  LostAssetRow,
  LostAssetsFilterVm,
  LOST_ASSET_STATUS_LABELS,
} from '../../../../core/models/assets.models';
import { SiteDto } from '../../../../core/models/operations.models';

@Component({
  selector: 'app-lost-assets-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wh-page lost-assets-page">
      <div class="wh-page-header page-header">
        <div class="header-info">
          <h1 class="page-title">Непринятое / Ненайденное</h1>
          <p class="page-subtitle">Позиции, по которым зафиксирована недостача при приёмке</p>
        </div>
      </div>

      <div class="wh-panel filters-card">
        <div class="filters-row">
          <div class="filter-field">
            <label class="filter-label">Поиск</label>
            <input
              class="wh-input filter-input"
              type="text"
              placeholder="По названию ТМЦ, номеру операции..."
              [ngModel]="filters().search"
              (ngModelChange)="onSearchChange($event)"
            />
          </div>
          <div class="filter-field">
            <label class="filter-label">Склад</label>
            <select
              class="wh-select filter-select"
              [ngModel]="filters().siteId ?? ''"
              (ngModelChange)="onSiteChange($event)"
            >
              <option value="">Все склады</option>
              @for (site of sites(); track site.id) {
                <option [value]="site.id">{{ site.name }}</option>
              }
            </select>
          </div>
          <div class="filter-field">
            <label class="filter-label">Операция</label>
            <input
              class="wh-input filter-input"
              type="text"
              placeholder="ID операции"
              [ngModel]="filters().operationId ?? ''"
              (ngModelChange)="onOperationIdChange($event)"
            />
          </div>
          <div class="filter-actions">
            <button class="wh-btn wh-btn--primary btn btn-primary" (click)="applyFilters()">Применить</button>
            <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="resetFilters()">Сбросить</button>
          </div>
        </div>
      </div>

      <div class="wh-card table-card">
        @if (isLoading()) {
          <div class="wh-state wh-state--loading loading-overlay">
            <div class="spinner"></div>
            <span>Загрузка...</span>
          </div>
        } @else if (error()) {
          <div class="wh-state wh-state--error error-banner">{{ error() }}</div>
        } @else {
          <div class="table-wrapper">
            <table class="wh-table data-table">
              <thead class="sticky-header">
                <tr>
                  <th class="col-item">ТМЦ</th>
                  <th class="col-qty">Количество</th>
                  <th class="col-operation">Операция</th>
                  <th class="col-dest">Склад назначения</th>
                  <th class="col-src">Склад-источник</th>
                  <th class="col-status">Статус</th>
                  <th class="col-date">Дата</th>
                  <th class="col-actions">Действия</th>
                </tr>
              </thead>
              <tbody>
                @for (row of items(); track row.operation_line_id) {
                  <tr class="data-row">
                    <td class="col-item">
                      <button class="wh-link item-link" (click)="openDetail(row)">
                        {{ row.display_name || row.item_name }}
                      </button>
                    </td>
                    <td class="col-qty">{{ row.qty }} {{ row.unit_symbol || '' }}</td>
                    <td class="col-operation">
                      <button class="wh-link op-link" (click)="openOperation(row)">
                        {{ row.operation_id }}
                      </button>
                    </td>
                    <td class="col-dest">{{ row.site_name || '—' }}</td>
                    <td class="col-src">{{ row.source_site_name || '—' }}</td>
                    <td class="col-status">
                      <span class="badge status-badge wh-badge" [class]="statusClass(row.status)">
                        {{ statusLabel(row.status) }}
                      </span>
                    </td>
                    <td class="col-date">{{ row.updated_at ? (row.updated_at | date:'dd.MM.yyyy HH:mm') : '—' }}</td>
                    <td class="col-actions" (click)="$event.stopPropagation()">
                      <button class="wh-btn wh-btn--secondary btn btn-sm" (click)="openDetail(row)">Подробнее</button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="empty-state">Нет потерянных активов.</td>
                  </tr>
                }
              </tbody>
            </table>

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
                  {{ ((page() - 1) * pageSize()) + 1 }}–{{ min(page() * pageSize(), totalCount()) }} из {{ totalCount() }}
                </div>
                <div class="page-buttons">
                  <button class="wh-btn wh-btn--secondary btn-page" [disabled]="page() <= 1" (click)="onPageChange(page() - 1)">←</button>
                  <span class="page-current">{{ page() }}</span>
                  <button class="wh-btn wh-btn--secondary btn-page" [disabled]="page() * pageSize() >= totalCount()" (click)="onPageChange(page() + 1)">→</button>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    .lost-assets-page { display: flex; flex-direction: column; height: 100%; background: #F1F5F9; overflow: hidden; }
    .page-header { flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .header-info { min-width: 0; }
    .page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0; }
    .page-subtitle { font-size: 13px; color: #64748B; margin: 4px 0 0; }
    .filters-card { flex-shrink: 0; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; padding: 8px 20px; }
    .filters-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
    .filter-field { display: flex; flex-direction: column; gap: 4px; }
    .filter-label { font-size: 12px; font-weight: 500; color: #64748B; }
    .filter-input, .filter-select { height: 32px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; font-family: inherit; background: #FFFFFF; }
    .filter-input { width: 220px; }
    .filter-select { min-width: 160px; }
    .filter-actions { display: flex; gap: 8px; margin-left: auto; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
    .table-card { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #FFFFFF; margin: 8px 20px 12px; border: 1px solid #E2E8F0; border-radius: 10px; min-height: 0; }
    .table-wrapper { flex: 1; overflow: auto; display: flex; flex-direction: column; min-height: 0; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; color: #1F2937; table-layout: fixed; }
    .data-table th, .data-table td { padding: 8px 8px; text-align: left; border-bottom: 1px solid #E2E8F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data-table th { font-weight: 600; color: #475569; background: #F8FAFC; cursor: pointer; user-select: none; position: sticky; top: 0; z-index: 2; }
    .data-table th:hover { background: #F1F5F9; }
    .data-table tbody .data-row { cursor: pointer; transition: background 0.1s; }
    .data-table tbody .data-row:hover { background: #F8FAFC; }
    .col-item { width: 22%; min-width: 140px; }
    .col-qty { width: 10%; min-width: 80px; text-align: right; }
    .col-operation { width: 12%; min-width: 100px; }
    .col-dest { width: 14%; min-width: 100px; }
    .col-src { width: 14%; min-width: 100px; }
    .col-status { width: 10%; min-width: 80px; }
    .col-date { width: 12%; min-width: 100px; }
    .col-actions { width: 10%; min-width: 80px; text-align: center; }
    .item-link, .op-link { background: none; border: none; padding: 0; font: inherit; color: #2563EB; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
    .item-link:hover, .op-link:hover { color: #1D4ED8; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; line-height: 1.4; }
    .status-badge.wh-badge--open { background: #FEF9C3; color: #854D0E; }
    .status-badge.wh-badge--resolved { background: #DCFCE7; color: #166534; }
    .status-badge.wh-badge--unknown { background: #F3F4F6; color: #6B7280; }
    .empty-state { text-align: center; padding: 40px 16px; color: #94A3B8; font-size: 14px; }
    .loading-overlay { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-banner { margin: 16px; padding: 12px 16px; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; border-radius: 8px; font-size: 14px; }
    .pagination-bar { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #E2E8F0; background: #FFFFFF; gap: 12px; }
    .page-size { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; }
    .page-size select { height: 28px; padding: 0 6px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; font-family: inherit; }
    .page-info { font-size: 13px; color: #64748B; }
    .page-buttons { display: flex; align-items: center; gap: 6px; }
    .btn-page { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #D1D5DB; border-radius: 6px; background: #FFFFFF; font-size: 14px; color: #374151; cursor: pointer; }
    .btn-page:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-current { font-size: 13px; font-weight: 600; color: #1E293B; min-width: 24px; text-align: center; }
  `]
})
export class LostAssetsPageComponent implements OnInit {
  readonly service = inject(LostAssetsService);
  private readonly operationsService = inject(OperationsService);
  private readonly router = inject(Router);

  readonly items = signal<LostAssetRow[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly isLoading = this.service.isLoading;
  readonly error = this.service.error;
  readonly sites = this.operationsService.sites;

  readonly filters = signal<LostAssetsFilterVm>({
    search: '',
    siteId: null,
    operationId: null,
    page: 1,
    pageSize: 20,
  });

  readonly min = Math.min;

  ngOnInit(): void {
    this.operationsService.loadSites();
    void this.loadList();
  }

  private async loadList(): Promise<void> {
    const f = this.filters();
    try {
      const result = await this.service.listLostAssets(f);
      this.items.set(result.items);
      this.totalCount.set(result.totalCount);
      this.page.set(result.page);
      this.pageSize.set(result.pageSize);
    } catch {
      // error already in service
    }
  }

  onSearchChange(value: string): void {
    this.filters.update(f => ({ ...f, search: value, page: 1 }));
  }

  onSiteChange(value: string): void {
    this.filters.update(f => ({ ...f, siteId: value || null, page: 1 }));
  }

  onOperationIdChange(value: string): void {
    this.filters.update(f => ({ ...f, operationId: value || null, page: 1 }));
  }

  applyFilters(): void {
    this.filters.update(f => ({ ...f, page: 1 }));
    void this.loadList();
  }

  resetFilters(): void {
    this.filters.set({
      search: '',
      siteId: null,
      operationId: null,
      page: 1,
      pageSize: this.pageSize(),
    });
    void this.loadList();
  }

  onPageChange(page: number): void {
    this.filters.update(f => ({ ...f, page }));
    void this.loadList();
  }

  onPageSizeChange(event: Event): void {
    const size = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSize.set(size);
    this.filters.update(f => ({ ...f, pageSize: size, page: 1 }));
    void this.loadList();
  }

  openDetail(row: LostAssetRow): void {
    this.router.navigate(['/operations/lost-assets', row.operation_line_id]);
  }

  openOperation(row: LostAssetRow): void {
    this.router.navigate(['/operations', row.operation_id]);
  }

  statusLabel(status: string | undefined): string {
    if (!status) return 'Открыт';
    return LOST_ASSET_STATUS_LABELS[status] || status;
  }

  statusClass(status: string | undefined): string {
    if (!status) return 'wh-badge--open';
    return `wh-badge--${status}`;
  }
}
