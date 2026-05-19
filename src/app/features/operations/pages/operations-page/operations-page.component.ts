import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../../../core/services/operations.service';
import {
  OperationsFilterVm,
  OperationListRowVm,
  OperationDraftVm,
  OperationType,
  OperationStatus,
  STATUS_TABS,
} from '../../../../core/models/operations.models';
import { OperationsFilterPanelComponent } from '../../components/operations-filter-panel/operations-filter-panel.component';
import { OperationsStatusTabsComponent } from '../../components/operations-status-tabs/operations-status-tabs.component';
import { OperationsTableComponent } from '../../components/operations-table/operations-table.component';
import { OperationCreateModalComponent } from '../../components/operation-create-modal/operation-create-modal.component';
import { OperationConfirmModalComponent } from '../../components/operation-confirm-modal/operation-confirm-modal.component';

@Component({
  selector: 'app-operations-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OperationsFilterPanelComponent,
    OperationsStatusTabsComponent,
    OperationsTableComponent,
    OperationCreateModalComponent,
    OperationConfirmModalComponent,
  ],
  template: `
    <div class="wh-page operations-page">
      <!-- Page Header -->
      <div class="wh-page-header page-header">
        <div class="header-info">
          <h1 class="page-title">Операции</h1>
          <p class="page-subtitle">
            Журнал складских операций: черновики, подтверждение и проведённые документы.
          </p>
        </div>
        <div class="header-actions">
          <button class="wh-btn wh-btn--primary btn btn-primary" (click)="onCreateClick()">+ Создать операцию</button>
          <button class="wh-btn wh-btn--secondary btn btn-secondary" disabled>Приёмка</button>
          <button class="wh-btn wh-btn--secondary btn btn-secondary" disabled>Экспорт</button>
        </div>
      </div>

      <!-- Filters & Status Tabs -->
      <div class="wh-panel filters-card">
        <app-operations-filter-panel
          [filters]="filters()"
          [sites]="sites()"
          (filtersChange)="onFiltersChange($event)"
          (reset)="onFiltersReset()"
        />
        <app-operations-status-tabs
          [activeTab]="activeStatusTab()"
          (tabChange)="onStatusTabChange($event)"
        />
      </div>

      <!-- Table -->
      <div class="wh-card table-card">
        @if (isLoading()) {
          <div class="wh-state wh-state--loading loading-overlay">
            <div class="spinner"></div>
            <span>Загрузка операций...</span>
          </div>
        } @else if (error()) {
          <div class="wh-state wh-state--error error-banner">{{ error() }}</div>
        } @else {
          <app-operations-table
            [rows]="sortedRows()"
            [sortColumn]="sortColumn()"
            [sortDirection]="sortDirection()"
            [pageSize]="pageSize()"
            [page]="page()"
            [totalCount]="totalCount()"
            (sort)="onSort($event)"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
            (rowClick)="onRowClick($event)"
            (rowEdit)="onRowEdit($event)"
            (rowSubmit)="onRowSubmit($event)"
            (rowCancel)="onRowCancel($event)"
          />
        }
      </div>
    </div>

    <!-- Create/Edit Modal -->
    @if (showCreateModal()) {
      <app-operation-create-modal
        [draft]="editingDraft()"
        [sites]="sites()"
        [isSaving]="service.isSaving()"
        [isSubmitting]="service.isSubmitting()"
        (save)="onDraftSave($event)"
        (submit)="onDraftSubmit($event)"
        (cancel)="onDraftCancel()"
      />
    }

    <!-- Confirm Modal -->
    @if (showConfirmModal()) {
      <app-operation-confirm-modal
        [operation]="confirmingOperation()"
        [isSubmitting]="service.isSubmitting()"
        (confirm)="onConfirmSubmit()"
        (cancel)="onConfirmCancel()"
      />
    }
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    .operations-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #F1F5F9;
      overflow: hidden;
    }

    .page-header {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 20px;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
    }
    .header-info { min-width: 0; }
    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }
    .page-subtitle {
      font-size: 13px;
      color: #64748B;
      margin: 4px 0 0;
    }
    .header-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      border: 1px solid transparent;
      font-family: inherit;
    }
    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-primary {
      background: #334155;
      color: #FFFFFF;
      border-color: #334155;
    }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary {
      background: #FFFFFF;
      border-color: #D1D5DB;
      color: #374151;
    }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }

    .filters-card {
      flex-shrink: 0;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
      padding: 12px 20px;
    }

    .table-card {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #FFFFFF;
      margin: 12px 20px 16px;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
    }

    .loading-overlay {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #64748B;
      font-size: 14px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #E2E8F0;
      border-top-color: #3B82F6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-banner {
      margin: 16px;
      padding: 12px 16px;
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FECACA;
      border-radius: 8px;
      font-size: 14px;
    }
  `]
})
export class OperationsPageComponent implements OnInit {
  readonly service = inject(OperationsService);

  // ─── Filters state ───────────────────────────────────────────
  readonly filters = signal<OperationsFilterVm>({
    search: '',
    type: null,
    status: null,
    siteId: null,
    createdAfter: null,
    createdBefore: null,
    updatedAfter: null,
    updatedBefore: null,
    createdByUserId: null,
    onlyMine: false,
    page: 1,
    pageSize: 20,
  });

  readonly activeStatusTab = signal<string>('all');
  readonly sortColumn = signal<string>('createdAt');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  // ─── Modal state ─────────────────────────────────────────────
  readonly showCreateModal = signal<boolean>(false);
  readonly showConfirmModal = signal<boolean>(false);
  readonly editingDraft = signal<OperationDraftVm | null>(null);
  readonly confirmingOperation = signal<OperationListRowVm | null>(null);

  // ─── Derived data ────────────────────────────────────────────
  readonly isLoading = this.service.isLoading;
  readonly error = this.service.error;
  readonly rows = this.service.rows;
  readonly totalCount = this.service.totalCount;
  readonly page = this.service.page;
  readonly pageSize = this.service.pageSize;
  readonly sites = this.service.sites;

  readonly sortedRows = computed(() => {
    const col = this.sortColumn();
    const dir = this.sortDirection();
    const data = [...this.rows()];
    data.sort((a, b) => {
      let av: any = (a as any)[col];
      let bv: any = (b as any)[col];
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  });

  ngOnInit(): void {
    this.service.loadSites();
    this.loadList();
  }

  // ─── List loading ────────────────────────────────────────────

  private loadList(): void {
    const f = this.filters();
    // Apply active status tab filter
    const tab = STATUS_TABS.find(t => t.key === this.activeStatusTab());
    const filtersWithStatus: OperationsFilterVm = {
      ...f,
      status: tab?.status ?? null,
      page: f.page,
    };
    this.service.loadList(filtersWithStatus);
  }

  // ─── Header actions ──────────────────────────────────────────

  onCreateClick(): void {
    this.editingDraft.set({
      type: 'MOVE',
      status: 'draft',
      lines: [],
    });
    this.showCreateModal.set(true);
  }

  // ─── Filter events ───────────────────────────────────────────

  onFiltersChange(newFilters: Partial<OperationsFilterVm>): void {
    this.filters.update(f => ({ ...f, ...newFilters, page: 1 }));
    this.loadList();
  }

  onFiltersReset(): void {
    this.filters.set({
      search: '',
      type: null,
      status: null,
      siteId: null,
      createdAfter: null,
      createdBefore: null,
      updatedAfter: null,
      updatedBefore: null,
      createdByUserId: null,
      onlyMine: false,
      page: 1,
      pageSize: this.pageSize(),
    });
    this.activeStatusTab.set('all');
    this.loadList();
  }

  onStatusTabChange(tabKey: string): void {
    this.activeStatusTab.set(tabKey);
    this.filters.update(f => ({ ...f, page: 1 }));
    this.loadList();
  }

  // ─── Sort / Pagination ───────────────────────────────────────

  onSort(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
    // Client-side sort for now; backend sort can be added later
    // this.loadList();
  }

  onPageChange(page: number): void {
    this.filters.update(f => ({ ...f, page }));
    this.loadList();
  }

  onPageSizeChange(size: number): void {
    this.filters.update(f => ({ ...f, pageSize: size, page: 1 }));
    this.loadList();
  }

  // ─── Row actions ─────────────────────────────────────────────

  onRowClick(row: OperationListRowVm): void {
    // TODO: open detail modal
  }

  onRowEdit(row: OperationListRowVm): void {
    // TODO: load operation and open edit modal
    this.editingDraft.set({
      id: row.id,
      type: row.type,
      status: 'draft',
      sourceSiteId: row.sourceSiteId,
      destinationSiteId: row.destinationSiteId,
      personName: row.personName,
      lines: [],
    });
    this.showCreateModal.set(true);
  }

  onRowSubmit(row: OperationListRowVm): void {
    this.confirmingOperation.set(row);
    this.showConfirmModal.set(true);
  }

  async onRowCancel(row: OperationListRowVm): Promise<void> {
    if (!confirm('Отменить операцию?')) return;
    try {
      await this.service.cancelOperation(row.id);
      this.loadList();
    } catch {
      // error already in service.error
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showConfirmModal()) {
      this.onConfirmCancel();
    } else if (this.showCreateModal()) {
      this.onDraftCancel();
    }
  }

  // ─── Modal events ────────────────────────────────────────────

  async onDraftSave(draft: OperationDraftVm): Promise<void> {
    try {
      if (draft.id) {
        await this.service.updateOperation(draft.id, draft);
      } else {
        await this.service.createOperation(draft);
      }
      this.showCreateModal.set(false);
      this.editingDraft.set(null);
      this.loadList();
    } catch {
      // error already in service.error
    }
  }

  onDraftSubmit(draft: OperationDraftVm): void {
    // Open confirm modal instead of direct submit
    const row = this.rows().find(r => r.id === draft.id);
    if (row) {
      this.confirmingOperation.set(row);
      this.showConfirmModal.set(true);
    }
  }

  onDraftCancel(): void {
    this.showCreateModal.set(false);
    this.editingDraft.set(null);
  }

  async onConfirmSubmit(): Promise<void> {
    const op = this.confirmingOperation();
    if (!op) return;
    try {
      await this.service.submitOperation(op.id);
      this.showConfirmModal.set(false);
      this.confirmingOperation.set(null);
      this.showCreateModal.set(false);
      this.editingDraft.set(null);
      this.loadList();
    } catch {
      // error already in service.error
    }
  }

  onConfirmCancel(): void {
    this.showConfirmModal.set(false);
    this.confirmingOperation.set(null);
  }
}
