import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { TemporaryItemVm, TempItemsListFilters, TempItemsSort } from '../../../core/models/temp-items.models';
import { TempItemsInfoCardComponent } from '../components/temp-items-info-card.component';
import { TempItemsFiltersComponent, TempItemsFilterValues } from '../components/temp-items-filters.component';
import { TempItemsTableComponent } from '../components/temp-items-table.component';
import { TempItemDetailModalComponent } from '../components/temp-item-detail-modal.component';
import { TempItemConvertFormComponent } from '../components/temp-item-convert-form.component';
import { TempItemMergePermanentFormComponent } from '../components/temp-item-merge-permanent-form.component';
import { TempItemMergeTempFormComponent } from '../components/temp-item-merge-temp-form.component';
import { TempItemDeleteFormComponent } from '../components/temp-item-delete-form.component';

@Component({
  selector: 'app-temp-items-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    TempItemsInfoCardComponent,
    TempItemsFiltersComponent,
    TempItemsTableComponent,
    TempItemDetailModalComponent,
    TempItemConvertFormComponent,
    TempItemMergePermanentFormComponent,
    TempItemMergeTempFormComponent,
    TempItemDeleteFormComponent,
  ],
  template: `
    <div class="wh-page temp-items-page">
      <!-- Header -->
      <div class="wh-page-header page-header">
        <div class="header-info">
          <h1 class="page-title">Временные ТМЦ</h1>
          <p class="page-subtitle">Управление временными позициями: преобразование, слияние и удаление.</p>
        </div>
        <div class="header-actions">
          <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onRefresh()" [disabled]="service.isLoading()">Обновить</button>
          <button class="wh-btn wh-btn--secondary btn btn-secondary" disabled>Экспорт</button>
        </div>
      </div>

      <!-- Info Card -->
      <div class="section">
        <app-temp-items-info-card
          [totalActive]="service.totalActive()"
          [needsReviewCount]="service.needsReviewCount()"
          [inPendingCount]="service.inPendingAcceptanceCount()"
          [canDeleteCount]="service.canDeleteCount()"
        />
      </div>

      <!-- Filters -->
      <div class="wh-panel filters-section">
        <app-temp-items-filters
          [filters]="filterValues()"
          (filtersChange)="onFiltersChange($event)"
          (reset)="onFiltersReset()"
        />
      </div>

      <!-- Table -->
      <div class="wh-card table-section">
        @if (service.isLoading()) {
          <div class="wh-state wh-state--loading loading-state">
            <div class="spinner"></div>
            <span>Загрузка...</span>
          </div>
        } @else if (service.error(); as err) {
          <div class="wh-state wh-state--error error-state">{{ err }}</div>
        } @else {
          <app-temp-items-table
            [rows]="service.items()"
            [sortColumn]="sortColumn()"
            [sortDir]="sortDirection()"
            [pageSize]="service.pageSize()"
            [page]="service.page()"
            [totalCount]="service.totalCount()"
            (sort)="onSort($event)"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
            (rowClick)="onRowClick($event)"
            (convert)="onRowConvert($event)"
            (merge)="onRowMerge($event)"
            (deleteItem)="onRowDelete($event)"
          />
        }
      </div>
    </div>

    <!-- Detail Modal -->
    @if (showModal() && selectedItem()) {
      <app-temp-item-detail-modal
        [item]="selectedItem()!"
        [role]="service.role()"
        (close)="closeModal()"
        (convert)="onConvertAction($event)"
        (mergePermanent)="onMergePermanentAction($event)"
        (mergeTemp)="onMergeTempAction($event)"
        (deleteItem)="onDeleteAction($event)"
      />
    }

    <!-- Sub-form modals -->
    @if (showConvertForm() && convertItem()) {
      <app-temp-item-convert-form
        [item]="convertItem()!"
        (submit)="onConvertSubmit($event)"
        (cancel)="showConvertForm.set(false)"
      />
    }

    @if (showMergePermanentForm() && mergeItem()) {
      <app-temp-item-merge-permanent-form
        [item]="mergeItem()!"
        (submit)="onMergePermanentSubmit($event)"
        (cancel)="showMergePermanentForm.set(false)"
      />
    }

    @if (showMergeTempForm() && mergeTempItem()) {
      <app-temp-item-merge-temp-form
        [item]="mergeTempItem()!"
        (submit)="onMergeTempSubmit($event)"
        (cancel)="showMergeTempForm.set(false)"
      />
    }

    @if (showDeleteForm() && deleteItem()) {
      <app-temp-item-delete-form
        [item]="deleteItem()!"
        (submit)="onDeleteSubmit($event)"
        (cancel)="showDeleteForm.set(false)"
      />
    }
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    .temp-items-page { display: flex; flex-direction: column; height: 100%; background: #F1F5F9; overflow: hidden; }
    .page-header { flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .header-info { min-width: 0; }
    .page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0; }
    .page-subtitle { font-size: 13px; color: #64748B; margin: 4px 0 0; }
    .header-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
    .section { padding: 0 20px; margin-top: 12px; flex-shrink: 0; }
    .filters-section { flex-shrink: 0; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; padding: 12px 20px; }
    .table-section { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #FFFFFF; margin: 12px 20px 16px; border: 1px solid #E2E8F0; border-radius: 10px; }
    .loading-state, .error-state { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 40px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class TempItemsPageComponent implements OnInit {
  readonly service = inject(TempItemsService);

  readonly sortColumn = signal<string>('createdAt');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly filterValues = signal<TempItemsFilterValues>({
    search: '', uiStatus: null, hasBalance: null, hasPendingAcceptance: null,
    createdAfter: '', createdBefore: '', createdByUserId: '',
  });

  readonly showModal = signal(false);
  readonly selectedItem = signal<TemporaryItemVm | null>(null);
  readonly showConvertForm = signal(false);
  readonly convertItem = signal<TemporaryItemVm | null>(null);
  readonly showMergePermanentForm = signal(false);
  readonly mergeItem = signal<TemporaryItemVm | null>(null);
  readonly showMergeTempForm = signal(false);
  readonly mergeTempItem = signal<TemporaryItemVm | null>(null);
  readonly showDeleteForm = signal(false);
  readonly deleteItem = signal<TemporaryItemVm | null>(null);

  ngOnInit(): void {
    this.service.loadRole().then(() => this.loadList());
  }

  private loadList(): void {
    const f = this.filterValues();
    const filters: TempItemsListFilters = {};
    if (f.search) filters.search = f.search;
    if (f.uiStatus) filters.ui_status = f.uiStatus;
    if (f.hasBalance !== null) filters.has_balance = f.hasBalance;
    if (f.hasPendingAcceptance !== null) filters.has_pending_acceptance = f.hasPendingAcceptance;
    if (f.createdAfter) filters.created_after = f.createdAfter;
    if (f.createdBefore) filters.created_before = f.createdBefore;
    if (f.createdByUserId) filters.created_by_user_id = f.createdByUserId;

    const sort: TempItemsSort = { sort_by: this.sortColumn(), sort_order: this.sortDirection() };
    this.service.loadList(filters, sort);
  }

  onRefresh(): void {
    this.loadList();
  }

  onFiltersChange(partial: Partial<TempItemsFilterValues>): void {
    this.filterValues.update(f => ({ ...f, ...partial }));
    this.loadList();
  }

  onFiltersReset(): void {
    this.filterValues.set({
      search: '', uiStatus: null, hasBalance: null, hasPendingAcceptance: null,
      createdAfter: '', createdBefore: '', createdByUserId: '',
    });
    this.loadList();
  }

  onSort(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
    this.loadList();
  }

  onPageChange(page: number): void {
    this.service.setPage(page);
  }

  onPageSizeChange(size: number): void {
    this.service.setPageSize(size);
  }

  onRowClick(item: TemporaryItemVm): void {
    this.selectedItem.set(item);
    this.showModal.set(true);
  }

  onRowConvert(item: TemporaryItemVm): void {
    this.convertItem.set(item);
    this.showConvertForm.set(true);
  }

  onRowMerge(item: TemporaryItemVm): void {
    this.mergeItem.set(item);
    this.showMergePermanentForm.set(true);
  }

  onRowDelete(item: TemporaryItemVm): void {
    this.deleteItem.set(item);
    this.showDeleteForm.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedItem.set(null);
  }

  onConvertAction(item: TemporaryItemVm): void {
    this.closeModal();
    this.convertItem.set(item);
    this.showConvertForm.set(true);
  }

  onMergePermanentAction(item: TemporaryItemVm): void {
    this.closeModal();
    this.mergeItem.set(item);
    this.showMergePermanentForm.set(true);
  }

  onMergeTempAction(item: TemporaryItemVm): void {
    this.closeModal();
    this.mergeTempItem.set(item);
    this.showMergeTempForm.set(true);
  }

  onDeleteAction(item: TemporaryItemVm): void {
    this.closeModal();
    this.deleteItem.set(item);
    this.showDeleteForm.set(true);
  }

  async onConvertSubmit(item: TemporaryItemVm): Promise<void> {
    this.showConvertForm.set(false);
    this.convertItem.set(null);
    await this.loadList();
  }

  async onMergePermanentSubmit(item: TemporaryItemVm): Promise<void> {
    this.showMergePermanentForm.set(false);
    this.mergeItem.set(null);
    await this.loadList();
  }

  async onMergeTempSubmit(item: TemporaryItemVm): Promise<void> {
    this.showMergeTempForm.set(false);
    this.mergeTempItem.set(null);
    await this.loadList();
  }

  async onDeleteSubmit(item: TemporaryItemVm): Promise<void> {
    this.showDeleteForm.set(false);
    this.deleteItem.set(null);
    await this.loadList();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeModal();
    this.showConvertForm.set(false);
    this.showMergePermanentForm.set(false);
    this.showMergeTempForm.set(false);
    this.showDeleteForm.set(false);
  }
}
