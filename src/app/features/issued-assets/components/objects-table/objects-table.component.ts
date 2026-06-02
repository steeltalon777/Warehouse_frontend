import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { IssueObject, IssueObjectType, ISSUE_OBJECT_TYPE_LABELS } from '../../../../core/models/issue-objects.models';
import { MinPipe } from '../../../../core/pipes/min.pipe';

@Component({
  selector: 'app-objects-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MinPipe],
  template: `
    <div class="objects-tab">
      <div class="toolbar">
        <div class="search-box">
          <input
            type="text"
            class="wh-form-input input search-input"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Поиск по наименованию..."
          />
        </div>
        <div class="filter-group">
          <select class="wh-form-input input filter-select" [ngModel]="typeFilter()" (ngModelChange)="onTypeFilterChange($event)">
            <option value="">Все типы</option>
            @for (entry of typeOptions; track entry.key) {
              <option [value]="entry.key">{{ entry.label }}</option>
            }
          </select>
          <label class="active-toggle">
            <input type="checkbox" [ngModel]="activeOnly()" (ngModelChange)="onActiveFilterChange($event)" />
            <span>Только активные</span>
          </label>
        </div>
        <div class="toolbar-actions">
          <button class="wh-btn wh-btn--primary btn btn-primary" (click)="onCreateClick()">+ Создать объект</button>
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
                <th class="col-name">Наименование</th>
                <th class="col-type">Тип</th>
                <th class="col-code">Код</th>
                <th class="col-qty">Позиций выдано</th>
                <th class="col-total">Всего количество</th>
                <th class="col-active">Активен</th>
                <th class="col-actions">Действия</th>
              </tr>
            </thead>
            <tbody>
              @for (obj of service.items(); track obj.id; let i = $index) {
                <tr class="clickable-row" (click)="onRowClick(obj)">
                  <td class="col-num">{{ (service.page() - 1) * service.pageSize() + i + 1 }}</td>
                  <td class="col-name">{{ obj.display_name }}</td>
                  <td class="col-type">{{ objectTypeLabel(obj.object_type) }}</td>
                  <td class="col-code">{{ obj.code || '—' }}</td>
                  <td class="col-qty">—</td>
                  <td class="col-total">—</td>
                  <td class="col-active">
                    <span class="status-badge" [class.active]="obj.is_active" [class.inactive]="!obj.is_active">
                      {{ obj.is_active ? 'Да' : 'Нет' }}
                    </span>
                  </td>
                  <td class="col-actions" (click)="$event.stopPropagation()">
                    <button class="wh-btn-icon btn-icon" title="Редактировать" (click)="onEditClick(obj)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="wh-btn-icon wh-btn-icon--danger btn-icon danger" title="Удалить" (click)="onDeleteClick(obj)">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="empty-state">Объекты выдачи не найдены</td>
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
    .objects-tab { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

    .toolbar { flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #E2E8F0; flex-wrap: wrap; }
    .search-box { flex: 1; min-width: 200px; max-width: 360px; }
    .search-input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; box-sizing: border-box; }
    .search-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-select { height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; }
    .active-toggle { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #64748B; cursor: pointer; white-space: nowrap; }
    .active-toggle input { margin: 0; }
    .toolbar-actions { margin-left: auto; }

    .table-wrapper { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; color: #1F2937; table-layout: fixed; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #E2E8F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data-table th { font-weight: 600; color: #475569; background: #F8FAFC; user-select: none; position: sticky; top: 0; z-index: 2; }
    .data-table tbody tr.clickable-row { cursor: pointer; transition: background 0.1s; }
    .data-table tbody tr.clickable-row:hover { background: #F8FAFC; }

    .col-num { width: 50px; text-align: center; }
    .col-name { width: auto; }
    .col-type { width: 160px; }
    .col-code { width: 100px; }
    .col-qty { width: 120px; text-align: center; }
    .col-total { width: 110px; text-align: center; }
    .col-active { width: 80px; text-align: center; }
    .col-actions { width: 90px; }

    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    .status-badge.active { background: #DCFCE7; color: #166534; }
    .status-badge.inactive { background: #FEE2E2; color: #991B1B; }

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

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-icon { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; color: #64748B; cursor: pointer; transition: all 0.15s; }
    .btn-icon:hover:not(:disabled) { background: #F1F5F9; color: #374151; border-color: #CBD5E1; }
    .btn-icon.danger:hover:not(:disabled) { background: #FEE2E2; color: #991B1B; border-color: #FECACA; }
  `]
})
export class ObjectsTableComponent implements OnInit {
  readonly service = inject(IssueObjectsService);
  private readonly router = inject(Router);

  readonly searchQuery = signal<string>('');
  readonly typeFilter = signal<string>('');
  readonly activeOnly = signal<boolean>(true);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly typeOptions = (Object.entries(ISSUE_OBJECT_TYPE_LABELS) as [IssueObjectType, string][])
    .map(([key, label]) => ({ key, label }));

  ngOnInit(): void {
    this.loadList();
  }

  private loadList(): void {
    this.service.loadList({
      search: this.searchQuery() || undefined,
      object_type: this.typeFilter() || undefined,
      is_active: this.activeOnly() ? true : undefined,
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadList(), 300);
  }

  onTypeFilterChange(value: string): void {
    this.typeFilter.set(value);
    this.loadList();
  }

  onActiveFilterChange(value: boolean): void {
    this.activeOnly.set(value);
    this.loadList();
  }

  onPageSizeChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.service.pageSize.set(value);
    this.service.page.set(1);
    this.loadList();
  }

  onPrevPage(): void {
    this.service.page.update(p => p - 1);
    this.loadList();
  }

  onNextPage(): void {
    this.service.page.update(p => p + 1);
    this.loadList();
  }

  onRowClick(obj: IssueObject): void {
    this.router.navigate(['/issued-assets/objects', obj.id]);
  }

  onCreateClick(): void {
    this.router.navigate(['/issued-assets/objects/new']);
  }

  onEditClick(obj: IssueObject): void {
    this.router.navigate(['/issued-assets/objects', obj.id, 'edit']);
  }

  async onDeleteClick(obj: IssueObject): Promise<void> {
    if (!confirm(`Удалить объект выдачи «${obj.display_name}»?`)) return;
    try {
      await this.service.deleteObject(obj.id);
      this.loadList();
    } catch {
      // error handled in service
    }
  }

  objectTypeLabel(type: string): string {
    return ISSUE_OBJECT_TYPE_LABELS[type as IssueObjectType] || type;
  }
}
