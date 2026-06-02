import { Component, OnDestroy, OnInit, signal, computed, inject, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OperationsService } from '../../../../core/services/operations.service';
import { AuthContextService } from '../../../../core/services/auth-context.service';
import { CatalogSearchService } from '../../../../core/services/catalog-search.service';
import { snapshotDraft } from '../../components/operation-create-modal/operation-draft-mappers';
import {
  OperationsFilterVm,
  OperationListRowVm,
  OperationDraftVm,
  OperationType,
  OperationStatus,
  STATUS_TABS,
  OperationDto,
  OPERATION_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
} from '../../../../core/models/operations.models';
import { OperationsFilterPanelComponent } from '../../components/operations-filter-panel/operations-filter-panel.component';
import { OperationsStatusTabsComponent } from '../../components/operations-status-tabs/operations-status-tabs.component';
import { OperationsTableComponent } from '../../components/operations-table/operations-table.component';
import { OperationCreateModalComponent } from '../../components/operation-create-modal/operation-create-modal.component';
import { OperationConfirmModalComponent } from '../../components/operation-confirm-modal/operation-confirm-modal.component';
import { firstValueFrom } from 'rxjs';

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
            (numberClick)="onRowEdit($event)"
            (rowInvoice)="onRowInvoice($event)"
            (rowAccept)="onRowAccept($event)"
            (rowDelete)="onRowDelete($event)"
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
        (delete)="onDraftDelete($event)"
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
      min-height: 0;
    }

    .page-header {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 20px;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
      min-height: 0;
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
      padding: 8px 20px;
      min-height: 0;
    }

    .table-card {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #FFFFFF;
      margin: 8px 20px 12px;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      min-height: 0;
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
export class OperationsPageComponent implements OnInit, OnDestroy {
  readonly service = inject(OperationsService);
  private authContextService = inject(AuthContextService);
  private catalogSearchService = inject(CatalogSearchService);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private loadSequence = 0;
  private readonly itemSearchCache = new Map<string, string[]>();

  constructor() {
    effect(() => {
      const role = this.authContextService.authContext()?.role ?? 'observer';
      if (role !== 'root' && this.activeStatusTab() === 'cancelled') {
        this.activeStatusTab.set('all');
        this.filters.update(f => ({ ...f, page: 1 }));
        void this.loadList();
      }
    });
  }

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
    void this.loadList();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
  }

  // ─── List loading ────────────────────────────────────────────

  private scheduleSearchLoad(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      void this.loadList();
    }, 250);
  }

  private async resolveSearchItemIds(search: string): Promise<string[]> {
    const query = search.trim();
    const cacheKey = query.toLowerCase();
    if (query.length < 2) {
      return [];
    }

    const cachedIds = this.itemSearchCache.get(cacheKey);
    if (cachedIds) {
      return cachedIds;
    }

    const results = await firstValueFrom(this.catalogSearchService.searchItemsOnce(query, 50));
    const ids = results.map(item => item.id).filter(Boolean);
    this.itemSearchCache.set(cacheKey, ids);
    return ids;
  }

  private async loadList(): Promise<void> {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    const currentLoad = ++this.loadSequence;
    const f = this.filters();
    const itemIds = await this.resolveSearchItemIds(f.search);
    if (currentLoad !== this.loadSequence) {
      return;
    }
    // Apply active status tab filter
    const tab = STATUS_TABS.find(t => t.key === this.activeStatusTab());
    const filtersWithStatus: OperationsFilterVm = {
      ...f,
      status: tab?.status ?? null,
      itemIds,
      page: f.page,
    };
    await this.service.loadList(filtersWithStatus);
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
    if (Object.prototype.hasOwnProperty.call(newFilters, 'search')) {
      this.scheduleSearchLoad();
      return;
    }
    void this.loadList();
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
    void this.loadList();
  }

  onStatusTabChange(tabKey: string): void {
    this.activeStatusTab.set(tabKey);
    this.filters.update(f => ({ ...f, page: 1 }));
    void this.loadList();
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
    void this.loadList();
  }

  onPageSizeChange(size: number): void {
    this.filters.update(f => ({ ...f, pageSize: size, page: 1 }));
    void this.loadList();
  }

  // ─── Row actions ─────────────────────────────────────────────

  onRowClick(row: OperationListRowVm): void {
    // TODO: open detail modal
  }

  async onRowEdit(row: OperationListRowVm): Promise<void> {
    try {
      const dto = await this.service.getOperation(row.id);
      if (!dto) return;
      const draft = this.service.mapDtoToDraftVm(dto);
      draft.lastSavedSnapshot = snapshotDraft(draft);
      this.editingDraft.set(draft);
      this.showCreateModal.set(true);
    } catch {
      // error already in service.error
    }
  }

  onRowSubmit(row: OperationListRowVm): void {
    this.confirmingOperation.set(row);
    this.showConfirmModal.set(true);
  }

  async onRowCancel(row: OperationListRowVm): Promise<void> {
    if (!confirm('Отменить операцию?')) return;
    try {
      await this.service.cancelOperation(row.id);
      void this.loadList();
    } catch {
      // error already in service.error
    }
  }

  onRowInvoice(row: OperationListRowVm): void {
    // Invoice button — will be implemented when PDF endpoint is ready
    // For now, the button is disabled with tooltip
  }

  onRowAccept(row: OperationListRowVm): void {
    // TODO: navigate to acceptance screen or open modal
  }

  private buildRowFromDto(dto: OperationDto): OperationListRowVm {
    const normalizedType = dto.type === 'ADJUSTMENT' ? 'CORRECTION' : dto.type;
    const typeLabel = OPERATION_TYPE_LABELS[normalizedType as OperationType] ?? dto.type;
    const statusLabel = OPERATION_STATUS_LABELS[dto.status] ?? dto.status;
    const displayNumber = dto.display_number || dto.number || this.computeClientDisplayNumber(dto);
    const directionLabel = this.buildDirectionLabel(dto);
    const statusLines = this.buildStatusLines(dto);

    return {
      id: dto.id,
      number: displayNumber,
      displayNumber,
      type: normalizedType as OperationType,
      typeLabel,
      status: dto.status,
      statusLabel,
      statusLines,
      createdAt: dto.created_at,
      createdByUserId: dto.created_by_user_id,
      createdByLabel: dto.created_by_label || 'Пользователь',
      sourceSiteId: dto.source_site_id,
      sourceSiteName: dto.source_site_name,
      destinationSiteId: dto.destination_site_id,
      destinationSiteName: dto.destination_site_name,
      personName: dto.person_name,
      issueObjectId: dto.issue_object_id,
      issueObjectName: dto.issue_object_name_snapshot,
      directionLabel,
      siteName: dto.site_name || null,
      linesCount: dto.lines_count ?? (dto.lines?.length ?? 0),
      positionCount: dto.lines_count ?? (dto.lines?.length ?? 0),
      acceptanceStateLabel: dto.acceptance_state_label || '',
      canInvoice: dto.status === 'submitted' || dto.status === 'pending',
      canOpen: true,
      canEdit: false,
      canSubmit: false,
      canDelete: false,
      canCancel: false,
      canPrint: false,
      canAccept: false,
    };
  }

  private computeClientDisplayNumber(op: OperationDto): string {
    if (op.site_id && op.created_at) {
      try {
        const d = new Date(op.created_at);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const MM = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        return `${op.site_id}/${hh}${mm}/${dd}${MM}${yy}`;
      } catch { }
    }
    return op.id.slice(0, 8).toUpperCase();
  }

  private buildDirectionLabel(op: OperationDto): string {
    const srcName = op.source_site_name || (op.source_site_id ? `Склад #${op.source_site_id}` : null);
    const dstName = op.destination_site_name || (op.destination_site_id ? `Склад #${op.destination_site_id}` : null);
    const siteName = op.site_name || (op.site_id ? `Склад #${op.site_id}` : null);
    const issueObjName = op.issue_object_name_snapshot || null;

    switch (op.type) {
      case 'MOVE':
        return `${srcName || '—'} → ${dstName || '—'}`;
      case 'RECEIVE':
        return `→ ${siteName || dstName || '—'}`;
      case 'EXPENSE':
        return `${siteName || srcName || '—'} → расход`;
      case 'WRITE_OFF':
        return `${siteName || srcName || '—'} → списание`;
      case 'ISSUE':
        return `${siteName || srcName || '—'} → ${issueObjName || 'объект'}`;
      case 'ISSUE_RETURN':
        return `${issueObjName || 'объект'} → ${siteName || srcName || '—'}`;
      case 'CORRECTION':
      case 'ADJUSTMENT':
        return `${siteName || srcName || '—'} → корректировка`;
      default:
        if (srcName && dstName) return `${srcName} → ${dstName}`;
        if (srcName) return srcName;
        if (dstName) return `→ ${dstName}`;
        return '—';
    }
  }

  private buildStatusLines(op: OperationDto): string[] {
    const lines: string[] = [];
    const statusLabel = OPERATION_STATUS_LABELS[op.status] ?? op.status;
    lines.push(statusLabel);

    if (op.acceptance_state && op.acceptance_state !== 'not_required') {
      const accLabel = op.acceptance_state_label || this.getAcceptanceStateLabel(op.acceptance_state);
      lines.push(accLabel);
    }

    return lines.slice(0, 4);
  }

  private getAcceptanceStateLabel(state: string): string {
    const labels: Record<string, string> = {
      'pending': 'Приёмка: ожидает',
      'in_progress': 'Приёмка: частично',
      'resolved': 'Приёмка: закрыта',
    };
    return labels[state] || state;
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
      let result: OperationDto | null = null;
      if (draft.id) {
        result = await this.service.updateOperation(draft.id, draft);
      } else {
        result = await this.service.createOperation(draft);
      }
      if (result) {
        const savedDraft = this.service.mapDtoToDraftVm(result);
        savedDraft.lastSavedSnapshot = snapshotDraft(savedDraft);
        this.editingDraft.set(savedDraft);
      }
      void this.loadList();
    } catch {
      // error already in service.error
    }
  }

  async onDraftSubmit(draft: OperationDraftVm): Promise<void> {
    if (draft.id) {
      let row = this.rows().find(r => r.id === draft.id);
      if (!row) {
        const dto = await this.service.getOperation(draft.id);
        if (dto) row = this.buildRowFromDto(dto);
      }
      if (row) {
        this.confirmingOperation.set(row);
        this.showConfirmModal.set(true);
      }
      return;
    }

    // New unsaved draft: save first, then open confirm modal
    try {
      const result = await this.service.createOperation(draft);
      if (!result) return;

      const savedDraft = this.service.mapDtoToDraftVm(result);
      savedDraft.lastSavedSnapshot = snapshotDraft(savedDraft);
      this.editingDraft.set(savedDraft);

      // Refresh list in background
      void this.loadList();

      // Open confirm modal with the newly created operation
      const row = this.buildRowFromDto(result);
      this.confirmingOperation.set(row);
      this.showConfirmModal.set(true);
    } catch {
      // error already in service.error
    }
  }

  onDraftCancel(): void {
    this.showCreateModal.set(false);
    this.editingDraft.set(null);
  }

  async onDraftDelete(draft: OperationDraftVm): Promise<void> {
    if (!draft.id) return;
    if (!confirm('Удалить черновик?')) return;
    try {
      await this.service.deleteOperation(draft.id);
      this.showCreateModal.set(false);
      this.editingDraft.set(null);
      void this.loadList();
    } catch {
      // error already in service.error
    }
  }

  async onRowDelete(row: OperationListRowVm): Promise<void> {
    if (!confirm('Удалить черновик?')) return;
    try {
      await this.service.deleteOperation(row.id);
      void this.loadList();
    } catch {
      // error already in service.error
    }
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
      void this.loadList();
    } catch {
      // error already in service.error
    }
  }

  onConfirmCancel(): void {
    this.showConfirmModal.set(false);
    this.confirmingOperation.set(null);
  }
}
