import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IssuedAssetsService, IssuedAssetsFilter } from '../../../../core/services/issued-assets.service';
import { IssuedAssetRow } from '../../../../core/models/assets.models';
import { MinPipe } from '../../../../core/pipes/min.pipe';

@Component({
  selector: 'app-property-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MinPipe],
  template: `
    <div class="property-tab">
      <div class="toolbar">
        <div class="search-box">
          <input
            type="text"
            class="wh-form-input input search-input"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Поиск по наименованию, артикулу..."
          />
        </div>
      </div>

      <div class="table-wrapper">
        @if (service.isLoading()) {
          <div class="wh-state wh-state--loading loading-state">
            <div class="spinner"></div>
            <span>Загрузка...</span>
          </div>
        } @else if (service.error(); as err) {
          <div class="wh-state wh-state--error error-state">{{ err }}</div>
        } @else {
          <table class="wh-table data-table">
            <thead class="sticky-header">
              <tr>
                <th class="col-num">№</th>
                <th class="col-name">Наименование ТМЦ</th>
                <th class="col-sku">Артикул</th>
                <th class="col-object">Объект выдачи</th>
                <th class="col-type">Тип объекта</th>
                <th class="col-qty">Количество</th>
                <th class="col-date">Дата обновления</th>
              </tr>
            </thead>
            <tbody>
              @for (row of service.items(); track row.inventory_subject_id; let i = $index) {
                <tr>
                  <td class="col-num">{{ (service.page() - 1) * service.pageSize() + i + 1 }}</td>
                  <td class="col-name">{{ row.display_name || row.resolved_item_name || row.item_name || '—' }}</td>
                  <td class="col-sku">{{ row.sku || '—' }}</td>
                  <td class="col-object">{{ row.issue_object_name }}</td>
                  <td class="col-type">{{ objectTypeLabel(row.issue_object_type) }}</td>
                  <td class="col-qty">{{ row.qty }}</td>
                  <td class="col-date">{{ row.updated_at | date:'dd.MM.yyyy HH:mm' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-state">Выданное имущество не найдено</td>
                </tr>
              }
            </tbody>
          </table>

          @if (service.totalCount() > 0) {
            <div class="pagination-bar">
              <div class="page-size">
                <span>На странице:</span>
                <select [value]="service.pageSize()" (change)="onPageSizeChange($event)">
                  <option [value]="10">10</option>
                  <option [value]="20">20</option>
                  <option [value]="50">50</option>
                </select>
              </div>
              <div class="page-info">
                {{ ((service.page() - 1) * service.pageSize()) + 1 }}–{{ [service.page() * service.pageSize(), service.totalCount()] | min }} из {{ service.totalCount() }}
              </div>
              <div class="page-buttons">
                <button class="wh-btn wh-btn--secondary btn-page" [disabled]="service.page() <= 1" (click)="onPrevPage()">←</button>
                <span class="page-current">{{ service.page() }}</span>
                <button class="wh-btn wh-btn--secondary btn-page" [disabled]="service.page() * service.pageSize() >= service.totalCount()" (click)="onNextPage()">→</button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .property-tab { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

    .toolbar { flex-shrink: 0; padding: 12px 16px; border-bottom: 1px solid #E2E8F0; }
    .search-box { max-width: 360px; }
    .search-input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; box-sizing: border-box; }
    .search-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }

    .table-wrapper { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; color: #1F2937; table-layout: fixed; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #E2E8F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data-table th { font-weight: 600; color: #475569; background: #F8FAFC; user-select: none; position: sticky; top: 0; z-index: 2; }
    .data-table tbody tr { transition: background 0.1s; }
    .data-table tbody tr:hover { background: #F8FAFC; }

    .col-num { width: 50px; text-align: center; }
    .col-name { width: auto; }
    .col-sku { width: 110px; }
    .col-object { width: 180px; }
    .col-type { width: 150px; }
    .col-qty { width: 100px; text-align: center; }
    .col-date { width: 140px; }

    .loading-state, .error-state { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 40px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 40px 16px; color: #94A3B8; font-size: 14px; }

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
export class PropertyTableComponent implements OnInit {
  readonly service = inject(IssuedAssetsService);
  readonly searchQuery = signal<string>('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.service.loadList();
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.service.loadList({ search: value || undefined });
    }, 300);
  }

  onPageSizeChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.service.setPageSize(value);
    this.service.loadList({ search: this.searchQuery() || undefined, page_size: value, page: 1 });
  }

  onPrevPage(): void {
    const page = this.service.page() - 1;
    this.service.setPage(page);
    this.service.loadList({ search: this.searchQuery() || undefined, page });
  }

  onNextPage(): void {
    const page = this.service.page() + 1;
    this.service.setPage(page);
    this.service.loadList({ search: this.searchQuery() || undefined, page });
  }

  objectTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      person: 'Человек',
      base: 'База',
      vehicle: 'Машина/Техника',
      department: 'Подразделение/Группа',
      contractor: 'Контрагент',
      other_object: 'Прочий объект',
      system_repo: 'Системный',
    };
    return labels[type] || type;
  }
}
