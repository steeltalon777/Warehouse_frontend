import { Component, HostListener, OnDestroy, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OperationsService } from '../../../../core/services/operations.service';
import { AuthContextService } from '../../../../core/services/auth-context.service';
import { CatalogSearchService } from '../../../../core/services/catalog-search.service';
import { DocumentsService } from '../../../../core/services/documents.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { DraftStorageService } from '../../../../core/services/draft-storage.service';
import { snapshotDraft } from '../../components/operation-create-modal/operation-draft-mappers';
import {
  OperationsFilterVm,
  OperationListRowVm,
  StatusLineVm,
  OperationDraftVm,
  OperationType,
  OperationStatus,
  STATUS_TABS,
  OperationDto,
  OperationSubmitResult,
  OPERATION_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
} from '../../../../core/models/operations.models';
import { OperationsFilterPanelComponent } from '../../components/operations-filter-panel/operations-filter-panel.component';
import { OperationsStatusTabsComponent } from '../../components/operations-status-tabs/operations-status-tabs.component';
import { OperationsTableComponent } from '../../components/operations-table/operations-table.component';
import { OperationCreateModalComponent } from '../../components/operation-create-modal/operation-create-modal.component';
import { OperationConfirmModalComponent } from '../../components/operation-confirm-modal/operation-confirm-modal.component';
import { firstValueFrom } from 'rxjs';

function currentDateTimeLocal(): string {
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

type OperationSubmitState =
  | 'editing'
  | 'submitting'
  | 'submitted'
  | 'outcome_unknown'
  | 'resolving'
  | 'retry_allowed'
  | 'submit_failed'
  | 'refreshing_list'
  | 'refresh_failed'
  | 'completed';

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
    <div class="wh-page operations-page" data-testid="operations-page">
      <!-- Page Header -->
      <div class="wh-page-header page-header">
        <div class="header-info">
          <h1 class="page-title" data-testid="operations-title">Операции</h1>
          <p class="page-subtitle">
            Журнал складских операций: черновики, подтверждение и проведённые документы.
          </p>
        </div>
        <div class="header-actions">
          <button class="wh-btn wh-btn--primary btn btn-primary" data-testid="operations-create-button" (click)="onCreateClick()">+ Создать операцию</button>
          <button class="wh-btn wh-btn--secondary btn btn-secondary" data-testid="operations-acceptance-button" disabled>Приёмка</button>
          <button class="wh-btn wh-btn--secondary btn btn-secondary" data-testid="operations-export-button" disabled>Экспорт</button>
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
          <div class="wh-state wh-state--loading loading-overlay" data-testid="operations-loading-state">
            <div class="spinner"></div>
            <span>Загрузка операций...</span>
          </div>
        } @else if (error()) {
          <div class="wh-state wh-state--error error-banner" data-testid="operations-error-message">{{ error() }}</div>
        } @else {
          <app-operations-table
            [rows]="sortedRows()"
            [sortColumn]="sortColumn()"
            [sortDirection]="sortDirection()"
            [pageSize]="pageSize()"
            [page]="page()"
            [totalCount]="totalCount()"
            [invoiceLoadingOperationId]="invoiceLoadingOperationId()"
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
           [isSubmitting]="service.isSubmitting() || submitState() === 'submitting' || submitState() === 'resolving'"
           [submitError]="createModalSubmitError()"
           [submitState]="submitState()"
           [submitMessage]="submitMessage()"
           (save)="onDraftSave($event)"
           (submit)="onDraftSubmit($event)"
           (retrySubmit)="onDraftSubmit($event)"
           (resolveSubmit)="onResolveDraftSubmit($event)"
           (retryRefresh)="onRetryListRefresh()"
          (cancel)="onDraftCancel()"
          (delete)="onDraftDelete($event)"
          (cancelOperation)="onDraftOperationCancel($event)"
          (acceptOperation)="onDraftAccept($event)"
          (restore)="onDraftRestore($event)"
        />
    }

    <!-- Confirm Modal -->
    @if (showConfirmModal()) {
       <app-operation-confirm-modal
         [operation]="confirmingOperation()"
         [isSubmitting]="service.isSubmitting() || submitState() === 'submitting' || submitState() === 'resolving'"
         (confirm)="onConfirmSubmit()"
         (cancel)="onConfirmCancel()"
       />
       @if (submitMessage()) {
         <div class="confirm-result-banner" [class.confirm-result-banner--warning]="submitState() === 'outcome_unknown' || submitState() === 'retry_allowed' || submitState() === 'refresh_failed'">
           {{ submitMessage() }}
           @if (submitState() === 'outcome_unknown') {
             <button class="btn btn-secondary" (click)="onResolveConfirmSubmit()">Проверить результат</button>
           }
           @if (submitState() === 'retry_allowed') {
             <button class="btn btn-primary" (click)="onConfirmSubmit()">Повторить</button>
           }
           @if (submitState() === 'refresh_failed') {
             <button class="btn btn-secondary" (click)="onRetryListRefresh()">Обновить список</button>
           }
         </div>
       }
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
    .confirm-result-banner {
      position: fixed;
      left: 50%;
      bottom: 24px;
      z-index: 1200;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      border-radius: 8px;
      color: #047857;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
      font-size: 14px;
    }
    .confirm-result-banner--warning {
      background: #FFFBEB;
      border-color: #FDE68A;
      color: #92400E;
    }
  `]
})
export class OperationsPageComponent implements OnInit, OnDestroy {
  readonly service = inject(OperationsService);
  private readonly diag = inject(DiagnosticsService);
  private readonly draftStorage = inject(DraftStorageService);
  private authContextService = inject(AuthContextService);
  private catalogSearchService = inject(CatalogSearchService);
  private documentsService = inject(DocumentsService);
  private router = inject(Router);
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
    acceptanceState: null,
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
  readonly invoiceLoadingOperationId = signal<string | null>(null);
  readonly createModalSubmitError = signal<string>('');
  readonly submitState = signal<OperationSubmitState>('editing');
  readonly lastSubmitResult = signal<OperationSubmitResult | null>(null);
  readonly submitMessage = signal<string>('');
  private lastSubmittedDraft: OperationDraftVm | null = null;

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
    // Diagnostics TZ Stage 3 WP-4: navigation_away_with_unsaved
    const draft = this.editingDraft();
    if (draft && this.createModalSubmitError() === '') {
      this.diag.track('navigation_away_with_unsaved', { draft });
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
      acceptanceState: tab?.acceptanceState ?? null,
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
      effectiveAt: currentDateTimeLocal(),
      lines: [],
    });
    this.createModalSubmitError.set('');
    this.resetSubmitUx();
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
      acceptanceState: null,
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
      this.createModalSubmitError.set('');
      this.showCreateModal.set(true);
    } catch {
      // error already in service.error
    }
  }

  onRowSubmit(row: OperationListRowVm): void {
    this.resetSubmitUx();
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

  async onRowInvoice(row: OperationListRowVm): Promise<void> {
    if (!row.canInvoice || this.invoiceLoadingOperationId()) {
      return;
    }

    const pendingWindow = window.open('', '_blank');
    this.invoiceLoadingOperationId.set(row.id);
    this.service.error.set(null);

    try {
      const result = await firstValueFrom(this.documentsService.openOperationWaybill(row.id));
      if (!result?.pdf_url) {
        throw new Error('Django BFF не вернул ссылку на PDF накладной.');
      }

      if (pendingWindow) {
        pendingWindow.location.href = result.pdf_url;
        pendingWindow.focus();
      } else {
        window.location.assign(result.pdf_url);
      }
    } catch (err: any) {
      if (pendingWindow && !pendingWindow.closed) {
        pendingWindow.close();
      }
      const message = err?.message || 'Не удалось сформировать или открыть накладную.';
      this.service.error.set(message);
      window.alert(message);
    } finally {
      if (this.invoiceLoadingOperationId() === row.id) {
        this.invoiceLoadingOperationId.set(null);
      }
    }
  }

  onRowAccept(row: OperationListRowVm): void {
    void this.router.navigate(['/operations', row.id, 'acceptance']);
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
      canInvoice: dto.status === 'draft' || dto.status === 'submitted',
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
        return `${dd}${MM}${yy}/${hh}${mm}/${op.site_id}`;
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

  private buildStatusLines(op: OperationDto): StatusLineVm[] {
    const lines: StatusLineVm[] = [];
    const statusLabel = OPERATION_STATUS_LABELS[op.status] ?? op.status;
    lines.push({ label: statusLabel, kind: 'operation_status' });

    if (op.acceptance_state && op.acceptance_state !== 'not_required') {
      const accLabel = op.acceptance_state_label || this.getAcceptanceStateLabel(op.acceptance_state);
      lines.push({
        label: accLabel,
        kind: 'acceptance',
        acceptanceState: op.acceptance_state,
      });
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
        const savedDraft = this.mergeDraftAfterSuccessfulSave(this.service.mapDtoToDraftVm(result), draft);
        savedDraft.lastSavedSnapshot = snapshotDraft(savedDraft);
        this.editingDraft.set(savedDraft);
        this.createModalSubmitError.set('');
      }
      void this.loadList();
    } catch (err: any) {
      const message = this.service.error()
        || err?.message
        || err?.error?.message
        || 'Не удалось сохранить черновик';
      this.createModalSubmitError.set(message);
    }
  }

  async onDraftSubmit(draft: OperationDraftVm): Promise<void> {
    if (this.submitState() === 'submitting' || this.submitState() === 'resolving') return;
    this.lastSubmittedDraft = draft;
    this.submitState.set('submitting');
    this.createModalSubmitError.set('');
    this.submitMessage.set('');

    try {
      const result = await this.service.submitWithResult(draft);
      this.applySubmitResult(result);
      await this.refreshListAfterSubmit();
      // TZ Stage 4 WP-1: draft cleared after successful submit
      this.draftStorage.clear();
      this.diag.track('draft_cleared', { draft });
    } catch (err: any) {
      // Diagnostics TZ Stage 3 WP-4: response_processing_failed (after HTTP success but processing failed)
      if (err?.code !== 'operation_outcome_unknown' && !err?.status) {
        this.diag.track('response_processing_failed', {
          draft,
          errorCode: err?.code,
        });
      }
      await this.handleSubmitError(err, draft.idempotencyKey, draft);
    }
  }

  async onResolveDraftSubmit(draft: OperationDraftVm): Promise<void> {
    await this.resolveUnknownOutcome(draft.idempotencyKey, draft);
  }

  async onRetryListRefresh(): Promise<void> {
    await this.refreshListAfterSubmit();
  }

  private async handleSubmitError(err: any, idempotencyKey?: string, draft?: OperationDraftVm): Promise<void> {
    const code = err?.code ?? err?.error?.code;
    if (code === 'operation_outcome_unknown' && idempotencyKey) {
      this.submitState.set('outcome_unknown');
      this.submitMessage.set('Результат операции неизвестен. Проверяем операцию по ключу.');
      await this.resolveUnknownOutcome(idempotencyKey, draft);
      return;
    }

    this.submitState.set('submit_failed');
    this.createModalSubmitError.set(this.submitErrorMessage(code, err));
  }

  private async resolveUnknownOutcome(idempotencyKey?: string, draft?: OperationDraftVm): Promise<void> {
    if (!idempotencyKey || this.submitState() === 'resolving') {
      this.submitState.set('outcome_unknown');
      this.submitMessage.set('Не удалось проверить результат. Попробуйте позже.');
      return;
    }

    this.submitState.set('resolving');
    const resolution = await this.service.resolveByIdempotencyKey(idempotencyKey);
    if (resolution.resolution === 'existing_operation' && resolution.operation) {
      const operation = resolution.operation;
      if (draft) {
        draft.id = operation.id;
        draft.status = operation.status;
        draft.version = operation.version;
      }
      this.applySubmitResult({
        operationId: operation.id,
        displayNumber: operation.display_number ?? operation.number ?? operation.id,
        status: operation.status,
        submitted: operation.status === 'submitted',
        serverRequestId: resolution.serverRequestId,
        idempotencyKey,
      });
      await this.refreshListAfterSubmit();
      return;
    }

    if (resolution.resolution === 'no_operation_found') {
      this.submitState.set('retry_allowed');
      this.submitMessage.set('Операция не найдена на сервере. Повторить с тем же ключом?');
      return;
    }

    this.submitState.set('outcome_unknown');
    this.submitMessage.set('Не удалось проверить результат. Попробуйте позже.');
  }

  private applySubmitResult(result: OperationSubmitResult): void {
    this.lastSubmitResult.set(result);
    this.submitState.set('submitted');
    this.submitMessage.set(`Операция №${result.displayNumber} проведена`);
    this.createModalSubmitError.set('');
    this.editingDraft.update(current => current ? { ...current, id: result.operationId, status: result.status } : current);
  }

  private async refreshListAfterSubmit(): Promise<void> {
    this.submitState.set('refreshing_list');
    try {
      await this.loadList();
      this.submitState.set('completed');
      this.showCreateModal.set(false);
      this.editingDraft.set(null);
      this.showConfirmModal.set(false);
      this.confirmingOperation.set(null);
      this.lastSubmittedDraft = null;
    } catch {
      this.submitState.set('refresh_failed');
      this.submitMessage.set('Операция проведена, но список не обновился — обновите страницу');
    }
  }

  private submitErrorMessage(code: string | undefined, err: any): string {
    const messages: Record<string, string> = {
      idempotency_payload_conflict: 'Конфликт: этот ключ уже использован с другими данными.',
      operation_submit_failed: 'Не удалось подтвердить операцию.',
      syncserver_unavailable: 'Сервер недоступен. Проверьте соединение.',
      forbidden: 'Доступ запрещён.',
      not_found: 'Ресурс не найден.',
      unexpected_error: 'Произошла непредвиденная ошибка.',
      operation_version_conflict: 'Операция была изменена в другой вкладке.',
    };
    return messages[code ?? '']
      ?? this.service.error()
      ?? err?.message
      ?? err?.error?.message
      ?? 'Не удалось подтвердить операцию';
  }

  private resetSubmitUx(): void {
    this.submitState.set('editing');
    this.lastSubmitResult.set(null);
    this.submitMessage.set('');
    this.lastSubmittedDraft = null;
  }

  private mergeDraftAfterSuccessfulSave(serverDraft: OperationDraftVm, currentDraft: OperationDraftVm): OperationDraftVm {
    const serverByItemId = new Map(
      serverDraft.lines
        .filter(line => !!line.itemId)
        .map(line => [String(line.itemId), line]),
    );

    return {
      ...currentDraft,
      id: serverDraft.id ?? currentDraft.id,
      status: serverDraft.status ?? currentDraft.status,
      createdByUserId: serverDraft.createdByUserId ?? currentDraft.createdByUserId ?? null,
      acceptanceState: serverDraft.acceptanceState ?? currentDraft.acceptanceState ?? null,
      effectiveAt: serverDraft.effectiveAt ?? currentDraft.effectiveAt ?? null,
      lines: currentDraft.lines.map((line, index) => {
        const serverLine = serverDraft.lines[index]
          ?? (line.itemId ? serverByItemId.get(String(line.itemId)) : null)
          ?? null;

        if (!serverLine) {
          return { ...line, lineNumber: line.lineNumber ?? index + 1 };
        }

        return {
          ...line,
          itemId: line.itemId ?? serverLine.itemId,
          itemName: line.itemName || serverLine.itemName,
          categoryName: line.categoryName || serverLine.categoryName,
          sku: line.sku ?? serverLine.sku,
          unitId: line.unitId ?? serverLine.unitId,
          unitName: line.unitName && line.unitName !== 'шт' ? line.unitName : serverLine.unitName,
          quantity: line.quantity ?? serverLine.quantity,
          availableQuantity: line.availableQuantity ?? serverLine.availableQuantity,
          sourceSiteQuantity: line.sourceSiteQuantity ?? serverLine.sourceSiteQuantity,
          destinationSiteQuantity: line.destinationSiteQuantity ?? serverLine.destinationSiteQuantity,
          isTemporary: line.isTemporary || serverLine.isTemporary,
          fromBalances: line.fromBalances || serverLine.fromBalances,
          inlineItem: line.inlineItem ?? serverLine.inlineItem ?? null,
          lineNumber: serverLine.lineNumber ?? line.lineNumber ?? index + 1,
        };
      }),
    };
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

  async onDraftOperationCancel(draft: OperationDraftVm): Promise<void> {
    if (!draft.id) return;
    if (!confirm('Отменить операцию? Она будет переведена в статус «Отменена».')) return;
    try {
      await this.service.cancelOperation(draft.id);
      this.showCreateModal.set(false);
      this.editingDraft.set(null);
      void this.loadList();
    } catch {
      // error already in service.error
    }
  }

  onDraftAccept(draft: OperationDraftVm): void {
    if (!draft.id) return;
    void this.router.navigate(['/operations', draft.id, 'acceptance']);
  }

  async onDraftRestore(draft: OperationDraftVm): Promise<void> {
    if (!draft.id) return;
    if (!confirm('Восстановить отменённую операцию как черновик?')) return;
    try {
      const dto = await this.service.restoreOperation(draft.id);
      if (dto) {
        const restoredDraft = this.service.mapDtoToDraftVm(dto);
        restoredDraft.lastSavedSnapshot = snapshotDraft(restoredDraft);
        this.editingDraft.set(restoredDraft);
        this.createModalSubmitError.set('');
      }
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
    } catch (err: any) {
      const message = this.service.error()
        || err?.message
        || err?.error?.message
        || 'Не удалось подтвердить операцию';
      this.createModalSubmitError.set(message);
      this.showConfirmModal.set(false);
    }
  }

  /**
   * Manual resolve from the confirm modal's "Проверить результат" button.
   * Reuses the private resolveUnknownOutcome() with the active draft's key.
   */
  async onResolveConfirmSubmit(): Promise<void> {
    const draft = this.editingDraft() ?? (this.confirmingOperation() as unknown as OperationDraftVm | null);
    const idempotencyKey = draft?.idempotencyKey;
    await this.resolveUnknownOutcome(idempotencyKey, draft ?? undefined);
  }

  onConfirmCancel(): void {
    this.showConfirmModal.set(false);
    this.confirmingOperation.set(null);
  }

  // ─── TZ Stage 4: draft protection ──────────────────────────────

  /**
   * Public hook used by the CanDeactivate guard.
   * Returns true only when the create modal is open AND the active draft
   * has unsaved changes (per the snapshot-based dirty check).
   */
  editingDraftHasChanges(): boolean {
    if (!this.showCreateModal()) return false;
    const draft = this.editingDraft();
    if (!draft) return false;
    // No snapshot yet → dirty if there's anything to lose (any lines).
    if (!draft.lastSavedSnapshot) return (draft.lines?.length ?? 0) > 0;
    return snapshotDraft(draft) !== draft.lastSavedSnapshot;
  }

  /**
   * Browser unload hook. Per contract §6: fires for tab close / refresh
   * / external navigation, but NOT for in-app routing (that's the guard).
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.editingDraftHasChanges()) {
      event.preventDefault();
      // Required for some browsers (e.g. Chrome) to actually show the prompt.
      event.returnValue = '';
    }
  }
}
