import { Injectable, signal, computed } from '@angular/core';
import { BffApiService, PaginatedBffResponse } from '../api/bff-api.service';
import {
  OperationDto,
  OperationType,
  OperationStatus,
  OperationsFilterVm,
  OperationListRowVm,
  StatusLineVm,
  OperationDraftVm,
  OperationLineDraftVm,
  OperationInlineItemDraftVm,
  SiteDto,
  BalanceDto,
  ResolvedItemDto,
  ItemResolveStatus,
  PersistState,
  PersistStatus,
  PersistError,
  OPERATION_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
} from '../models/operations.models';
import { CatalogSearchService } from './catalog-search.service';
import { firstValueFrom } from 'rxjs';
import { AuthContextService } from './auth-context.service';

export interface OperationsListResult {
  rows: OperationListRowVm[];
  totalCount: number;
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class OperationsService {

  // ─── State ───────────────────────────────────────────────────
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string> | null>(null);
  readonly listResult = signal<OperationsListResult | null>(null);
  readonly sites = signal<SiteDto[]>([]);
  readonly balances = signal<BalanceDto[]>([]);

  readonly rows = computed(() => this.listResult()?.rows ?? []);
  readonly totalCount = computed(() => this.listResult()?.totalCount ?? 0);
  readonly page = computed(() => this.listResult()?.page ?? 1);
  readonly pageSize = computed(() => this.listResult()?.pageSize ?? 20);

  readonly isSaving = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  // ─── Persist state machine (TZ D4) ───────────────────────────
  readonly persistState = signal<PersistState>({ status: 'idle' });
  readonly persistStatus = computed(() => this.persistState().status);
  readonly persistError = computed(() => this.persistState().error);

  /** Immutable snapshot captured before any await in a persist operation. */
  private _persistSnapshot: OperationDraftVm | null = null;

  constructor(
    private bff: BffApiService,
    private authContextService: AuthContextService,
    private catalogSearch: CatalogSearchService,
  ) {
    this.authContextService.load();
  }

  // ─── List ────────────────────────────────────────────────────

  async loadList(filters: OperationsFilterVm): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);

    try {
      const params: Record<string, string | number | boolean> = {
        page: filters.page,
        page_size: filters.pageSize,
      };
      if (filters.search) params['search'] = filters.search;
      if (filters.itemIds?.length) params['item_ids'] = filters.itemIds.join(',');
      if (filters.type) {
        params['type'] = filters.type;
      } else {
        params['exclude_adjustments'] = true;
      }
      if (filters.status) {
        const role = this.authContextService.authContext()?.role ?? 'observer';
        if (role !== 'root' && filters.status === 'cancelled') {
          // non-root must not request cancelled status
        } else {
          params['status'] = filters.status;
        }
      }
      if (filters.acceptanceState) params['acceptance_state'] = filters.acceptanceState;
      if (filters.siteId) params['site_id'] = filters.siteId;
      if (filters.createdAfter) params['created_after'] = filters.createdAfter;
      if (filters.createdBefore) params['created_before'] = filters.createdBefore;
      if (filters.updatedAfter) params['updated_after'] = filters.updatedAfter;
      if (filters.updatedBefore) params['updated_before'] = filters.updatedBefore;
      if (filters.createdByUserId) params['created_by_user_id'] = filters.createdByUserId;
      if (filters.onlyMine) params['created_by_user_id'] = 'me';

      const result = await firstValueFrom(
        this.bff.getList<OperationDto>('/operations', params)
      );

      let rows = (result.items ?? []).map(op => this.mapToRowVm(op));

      const role = this.authContextService.authContext()?.role ?? 'observer';
      if (role !== 'root') {
        rows = rows.filter(r => r.status !== 'cancelled');
      }

      this.listResult.set({
        rows,
        totalCount: result.total_count ?? 0,
        page: result.page ?? 1,
        pageSize: result.page_size ?? filters.pageSize,
      });
    } catch (err: any) {
      this.normalizeError(err);
    } finally {
      this.isLoading.set(false);
    }
  }

  // ─── Persist helpers ─────────────────────────────────────────

  private _newClientRequestId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  /** Snapshot the draft before any async step (TZ D4: immutable snapshot). */
  captureSnapshot(draft: OperationDraftVm): OperationDraftVm {
    this._persistSnapshot = JSON.parse(JSON.stringify(draft));
    return this._persistSnapshot!;
  }

  /** Compare current draft to the pre-persist snapshot (bail if changed). */
  isSnapshotValid(draft: OperationDraftVm): boolean {
    if (!this._persistSnapshot) return true;
    return this._persistSnapshot.id === draft.id
      && this._persistSnapshot.comment === draft.comment
      && this._persistSnapshot.lines.length === draft.lines.length;
  }

  /**
   * TZ D3: batch-resolve persisted (non-temporary) item IDs in the draft.
   * Returns per-line resolve statuses. Blocks Save/Submit for unusable items.
   */
  async validateLinesBeforePersist(draft: OperationDraftVm): Promise<Map<string, ResolvedItemDto>> {
    const persistedIds: string[] = draft.lines
      .filter(l => l.itemId && !l.isTemporary && !l.inlineItem)
      .map(l => String(l.itemId));

    if (!persistedIds.length) return new Map();

    this.persistState.set({ status: 'validating_items' });

    try {
      const results = await firstValueFrom(
        this.catalogSearch.resolveItems(persistedIds)
      );
      const map = new Map<string, ResolvedItemDto>();
      for (const r of results) {
        map.set(r.request_id, r);
      }
      return map;
    } catch (err: any) {
      this.persistState.set({
        status: 'rejected',
        error: { code: err.code || 'resolve_error', message: err.message || 'Ошибка проверки ТМЦ' },
      });
      throw err;
    }
  }

  /** Check if a line's resolved status blocks persist. */
  isItemUnusable(status: ItemResolveStatus | undefined): boolean {
    if (!status) return false;
    return status === 'merged' || status === 'inactive' || status === 'deleted' || status === 'missing';
  }

  // ─── Persist state machine transitions ───────────────────────

  private setPersist(status: PersistStatus, error?: PersistError): void {
    const current = this.persistState();
    // Do not overwrite a later revision with a stale response (TZ D4).
    if (current.status === 'saved' || current.status === 'saved_after_check') return;
    this.persistState.set({ status, error });
  }

  private resetPersist(): void {
    this._persistSnapshot = null;
    this.persistState.set({ status: 'idle' });
  }

  // ─── CRUD ────────────────────────────────────────────────────

  async createOperation(draft: OperationDraftVm): Promise<OperationDto | null> {
    this.isSaving.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    this.setPersist('saving');
    try {
      // Always include client_request_id for idempotency (TZ C5/D1)
      const payload = this.buildPayload(draft, { includeEffectiveAt: true, isCreate: true });
      payload['client_request_id'] = payload['client_request_id'] || this._newClientRequestId();
      const result = await firstValueFrom(
        this.bff.postData<OperationDto>('/operations', payload)
      );
      if (result?.version != null) {
        draft.version = result.version;
      }
      this.setPersist('saved');
      return result;
    } catch (err: any) {
      if (err.code === 'operation_outcome_unknown') {
        this.setPersist('outcome_unknown', err);
      } else if (err.code === 'operation_version_conflict' || err.code === 'conflict') {
        this.setPersist('conflict', err);
      } else {
        this.setPersist('rejected', err);
      }
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async updateOperation(id: string, draft: OperationDraftVm): Promise<OperationDto | null> {
    this.isSaving.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    this.setPersist('saving');
    try {
      const payload = this.buildPayload(draft, { includeEffectiveAt: false, isCreate: false });
      // Include expected_version for versioned updates (TZ D5)
      if (draft.version != null) {
        payload['expected_version'] = draft.version;
      }
      const result = await firstValueFrom(
        this.bff.patchData<OperationDto>(`/operations/${id}`, payload)
      );
      if (result?.version != null) {
        draft.version = result.version;
      } else if (draft.version != null) {
        draft.version = draft.version + 1;
      }

      const effectiveAt = this.toIsoDateTime(draft.effectiveAt);
      if (effectiveAt) {
        const effectiveResult = await firstValueFrom(
          this.bff.patchData<OperationDto>(`/operations/${id}/effective-at`, { effective_at: effectiveAt })
        );
        if (effectiveResult?.version != null) {
          draft.version = effectiveResult.version;
        }
      }
      this.setPersist('saved');
      return result;
    } catch (err: any) {
      if (err.code === 'operation_outcome_unknown') {
        this.setPersist('outcome_unknown', err);
      } else if (err.code?.includes('version_conflict') || err.code === 'conflict') {
        this.setPersist('conflict', err);
      } else {
        this.setPersist('rejected', err);
      }
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async submitOperation(id: string, draft?: OperationDraftVm): Promise<void> {
    this.isSubmitting.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    this.setPersist('saving');
    try {
      const payload: Record<string, unknown> = { submit: true };
      if (draft?.version != null) {
        payload['expected_version'] = draft.version;
      }
      await firstValueFrom(
        this.bff.postData<unknown>(`/operations/${id}/submit`, payload)
      );
      this.setPersist('saved');
    } catch (err: any) {
      if (err.code === 'operation_outcome_unknown') {
        this.setPersist('outcome_unknown', err);
      } else if (err.code?.includes('version_conflict') || err.code === 'conflict') {
        this.setPersist('conflict', err);
      } else {
        this.setPersist('rejected', err);
      }
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * TZ D5: Save+Submit in one logical flow.
   * Returns 'saved' if save succeeded but submit was rejected, so the modal
   * can show "черновик сохранён, подтверждение не выполнено".
   */
  async saveAndSubmit(draft: OperationDraftVm): Promise<OperationDto | null> {
    if (draft.id) {
      // Update existing draft
      const updated = await this.updateOperation(draft.id, draft);
      if (!updated) return null;
      draft.id = updated.id;
      draft.version = updated.version;
      try {
        await this.submitOperation(updated.id, draft);
      } catch {
        // Submit failed — save was successful, return the saved operation
        // so the modal shows partial lifecycle.
        this.setPersist('saved');
      }
      return updated;
    } else {
      // Create then submit
      const created = await this.createOperation(draft);
      if (!created?.id) return null;
      draft.id = created.id;
      draft.version = created.version;
      try {
        await this.submitOperation(created.id, draft);
        this.setPersist('saved');
      } catch {
        this.setPersist('saved');
      }
      return created;
    }
  }

  // ─── Single operation CRUD ───────────────────────────────────

  async deleteOperation(id: string): Promise<void> {
    this.isSaving.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    try {
      await firstValueFrom(
        this.bff.deleteData(`/operations/${id}`)
      );
    } catch (err: any) {
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async cancelOperation(id: string): Promise<void> {
    this.isSubmitting.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    try {
      await firstValueFrom(
        this.bff.postData<unknown>(`/operations/${id}/cancel`, { cancel: true })
      );
    } catch (err: any) {
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async restoreOperation(id: string): Promise<OperationDto | null> {
    this.isSubmitting.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.postData<OperationDto>(`/operations/${id}/restore`, { restore: true })
      );
      return result;
    } catch (err: any) {
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async getOperation(id: string): Promise<OperationDto | null> {
    try {
      return await firstValueFrom(
        this.bff.getData<OperationDto>(`/operations/${id}`)
      );
    } catch (err: any) {
      this.normalizeError(err);
      return null;
    }
  }

  // ─── Fingerprint / Ambiguous outcome recovery (TZ D6) ────────

  /**
   * Build a fingerprint for the current draft to use in GET recovery
   * after a response loss. Normalized ordered lines and editable fields.
   * NOT written to local/session storage (TZ D6).
   */
  buildFingerprint(draft: OperationDraftVm): string {
    const normalizedLines = draft.lines
      .filter(l => l.quantity != null && l.quantity > 0)
      .map(l => ({
        itemId: l.itemId || null,
        qty: l.quantity,
        comment: l.error || null,
        isTemporary: l.isTemporary,
        inlineKey: l.inlineItem?.clientKey || null,
        inlineName: l.inlineItem?.name || null,
      }));
    // Sort by itemId then inlineKey for reproducible key
    normalizedLines.sort((a, b) => {
      const aKey = a.itemId || a.inlineKey || '';
      const bKey = b.itemId || b.inlineKey || '';
      return aKey.localeCompare(bKey);
    });
    const payload = {
      type: draft.type,
      site: draft.sourceSiteId || draft.destinationSiteId || null,
      effectiveAt: draft.effectiveAt || null,
      comment: draft.comment || null,
      lines: normalizedLines,
    };
    try {
      return btoa(JSON.stringify(payload));
    } catch {
      return JSON.stringify(payload);
    }
  }

  // ─── mapDtoToDraftVm ─────────────────────────────────────────

  mapDtoToDraftVm(dto: OperationDto): OperationDraftVm {
    const lines: OperationLineDraftVm[] = (dto.lines ?? []).map((l, idx) => {
      const hasInline = !!l.temporary_draft_payload || !!l.is_draft_temporary;
      const inlineItem: OperationInlineItemDraftVm | null = l.temporary_draft_payload
        ? {
            clientKey: l.temporary_draft_payload.client_key ?? `inline-${idx}-${Date.now()}`,
            name: l.temporary_draft_payload.name ?? l.item_name_snapshot ?? l.resolved_item_name ?? '',
            sku: l.temporary_draft_payload.sku ?? l.item_sku_snapshot ?? null,
            unitId: l.temporary_draft_payload.unit_id ?? l.unit_id ?? '',
            unitName: l.unit_symbol ?? l.unit_symbol_snapshot ?? 'шт',
            categoryId: l.temporary_draft_payload.category_id ?? null,
            description: l.temporary_draft_payload.description ?? null,
            hashtags: l.temporary_draft_payload.hashtags ?? null,
          }
        : null;

      return {
        localId: `line-${l.id ?? idx}`,
        itemId: hasInline ? null : (l.item_id ?? l.resolved_item_id ?? null),
        itemName: l.item_name ?? l.item_name_snapshot ?? l.resolved_item_name ?? '',
        categoryName: l.category_name_snapshot ?? undefined,
        sku: l.sku ?? l.item_sku_snapshot ?? null,
        unitId: l.unit_id ?? null,
        unitName: l.unit_symbol ?? l.unit_symbol_snapshot ?? 'шт',
        quantity: l.qty ? parseFloat(l.qty) : null,
        lineNumber: idx + 1,
        isTemporary: l.is_temporary ?? false,
        fromBalances: false,
        inlineItem,
      };
    });

    const type = dto.type;
    const fallbackSiteId = dto.site_id != null ? String(dto.site_id) : null;
    const mappedSourceSiteId = dto.source_site_id != null
      ? String(dto.source_site_id)
      : (type !== 'MOVE' && type !== 'RECEIVE' ? fallbackSiteId : null);
    const mappedDestinationSiteId = dto.destination_site_id != null
      ? String(dto.destination_site_id)
      : (type === 'RECEIVE' ? fallbackSiteId : null);

    return {
      id: dto.id,
      type: dto.type,
      status: dto.status,
      version: dto.version,
      createdByUserId: dto.created_by_user_id ?? null,
      sourceSiteId: mappedSourceSiteId,
      destinationSiteId: mappedDestinationSiteId,
      personName: dto.person_name ?? null,
      issueObjectId: dto.issue_object_id ?? null,
      issueObjectName: dto.issue_object_name_snapshot ?? null,
      acceptanceState: dto.acceptance_state ?? null,
      effectiveAt: this.toDateTimeLocalValue(dto.effective_at ?? dto.created_at ?? null),
      comment: dto.comment ?? (dto as any).notes ?? null,
      lines,
    };
  }

  isDraftEditable(status: OperationStatus): boolean {
    return status === 'draft';
  }

  // ─── Sites / Balances ────────────────────────────────────────

  async loadSites(): Promise<void> {
    try {
      const result: any = await firstValueFrom(
        this.bff.getData('/catalog/sites')
      );
      const rawSites: any[] = result?.sites ?? [];
      const mapped: SiteDto[] = rawSites.map(s => ({
        id: String(s.site_id ?? ''),
        name: String(s.name ?? ''),
      }));
      this.sites.set(mapped);
    } catch {
      this.sites.set([]);
    }
  }

  async loadBalances(siteId?: string): Promise<void> {
    try {
      const params: Record<string, string> = {};
      if (siteId) params['site_id'] = siteId;
      const result = await firstValueFrom(
        this.bff.getData<BalanceDto[] | { items?: BalanceDto[] }>('/balances', params)
      );
      const rows = Array.isArray(result) ? result : (result?.items ?? []);
      this.balances.set(rows);
    } catch {
      this.balances.set([]);
    }
  }

  getBalanceForItem(itemId: string, siteId?: string): number {
    const list = this.balances();
    const normalizedSiteId = siteId == null ? null : String(siteId);
    const row = list.find(
      b => String(b.item_id) === String(itemId) && (!normalizedSiteId || String(b.site_id) === normalizedSiteId)
    );
    if (!row) return 0;
    const qty = parseFloat(row.qty);
    return isNaN(qty) ? 0 : qty;
  }

  // ─── Mappers ─────────────────────────────────────────────────

  private mapToRowVm(op: OperationDto): OperationListRowVm {
    const normalizedType = op.type === 'ADJUSTMENT' ? 'CORRECTION' : op.type;
    const typeLabel = OPERATION_TYPE_LABELS[normalizedType as OperationType] ?? op.type;
    const statusLabel = OPERATION_STATUS_LABELS[op.status] ?? op.status;

    const displayNumber = op.display_number || op.number || this.computeClientDisplayNumber(op);
    const directionLabel = this.buildDirectionLabel(op);
    const createdByLabel = op.created_by_label || 'Пользователь';
    const comment = op.comment ?? op.notes ?? null;
    const statusLines = this.buildStatusLines(op);

    const isDraft = op.status === 'draft';
    const isSubmitted = op.status === 'submitted';
    const isCancelled = op.status === 'cancelled';

    const auth = this.authContextService.authContext();
    const role = auth?.role ?? 'observer';
    const userId = auth?.userId ?? '';

    let canEdit = false;
    let canSubmit = false;
    let canCancel = false;
    let canPrint = false;

    if (role === 'observer') {
      canEdit = false;
      canSubmit = false;
      canCancel = false;
      canPrint = isSubmitted;
    } else if (role === 'storekeeper') {
      canEdit = isDraft && op.created_by_user_id === userId;
      canSubmit = isDraft;
      canCancel = isDraft;
      canPrint = isSubmitted;
    } else if (role === 'chief_storekeeper') {
      canEdit = isDraft;
      canSubmit = isDraft;
      canCancel = isDraft;
      canPrint = isSubmitted;
    } else {
      canEdit = isDraft;
      canSubmit = isDraft;
      canCancel = isDraft || isSubmitted;
      canPrint = isSubmitted;
    }

    if (isCancelled) {
      canCancel = false;
    }

    let canRestore = false;
    if (role === 'root' && isCancelled) {
      canRestore = true;
    }

    return {
      id: op.id,
      number: displayNumber,
      displayNumber,
      comment,
      type: normalizedType as OperationType,
      typeLabel,
      status: op.status,
      statusLabel,
      statusLines,
      createdAt: op.created_at,
      createdByUserId: op.created_by_user_id,
      createdByLabel,
      sourceSiteId: op.source_site_id,
      sourceSiteName: op.source_site_name,
      destinationSiteId: op.destination_site_id,
      destinationSiteName: op.destination_site_name,
      personName: op.person_name,
      issueObjectId: op.issue_object_id,
      issueObjectName: op.issue_object_name_snapshot,
      directionLabel,
      siteName: op.site_name || null,
      linesCount: op.lines_count ?? (op.lines?.length ?? 0),
      positionCount: op.lines_count ?? (op.lines?.length ?? 0),
      acceptanceStateLabel: op.acceptance_state_label || '',
      canInvoice: op.status === 'draft' || op.status === 'submitted',
      canOpen: true,
      canEdit,
      canSubmit,
      canDelete: this.isDeleteAllowed(op),
      canCancel,
      canPrint,
      canAccept: this.isAcceptanceApplicable(op),
      canRestore,
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

  private isAcceptanceApplicable(op: OperationDto): boolean {
    return (op.type === 'MOVE' || op.type === 'RECEIVE')
      && op.status === 'submitted'
      && (op.acceptance_state === 'pending' || op.acceptance_state === 'in_progress');
  }

  private isDeleteAllowed(op: OperationDto): boolean {
    const auth = this.authContextService.authContext();
    const role = auth?.role ?? 'observer';
    const isDraft = op.status === 'draft';
    const isCancelled = op.status === 'cancelled';
    if (role === 'root') return isDraft || op.status === 'submitted' || isCancelled;
    if (role === 'chief_storekeeper') return isDraft || isCancelled;
    if (role === 'storekeeper') return (isDraft || isCancelled) && op.created_by_user_id === auth?.userId;
    return false;
  }

  private buildPayload(
    draft: OperationDraftVm,
    options: { includeEffectiveAt: boolean; isCreate?: boolean } = { includeEffectiveAt: true, isCreate: false }
  ): Record<string, unknown> {
    const mapOperationType = (type: OperationType): string => {
      return type === 'CORRECTION' ? 'ADJUSTMENT' : type;
    };

    const safeId = (val: unknown): string | number | null => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') {
        if (val === '' || val === 'undefined' || val === 'null') return null;
        return val;
      }
      if (typeof val === 'number') return val;
      return null;
    };

    let siteId: string | number | null = null;
    let includeSourceSite = false;
    let includeDestinationSite = false;

    const isObjectSourceFlow =
      draft.type === 'ISSUE_RETURN' ||
      (draft.type === 'WRITE_OFF' && draft.writeOffSource === 'object');
    const fallbackSiteId = isObjectSourceFlow
      ? this.authContextService.authContext()?.defaultSiteId ?? this.sites()[0]?.id ?? null
      : null;

    if (draft.type === 'RECEIVE') {
      siteId = safeId(draft.destinationSiteId);
      includeDestinationSite = true;
    } else if (draft.type === 'MOVE') {
      siteId = safeId(draft.sourceSiteId);
      includeSourceSite = true;
      includeDestinationSite = true;
    } else {
      siteId = safeId(draft.sourceSiteId ?? fallbackSiteId);
      includeSourceSite = true;
    }

    const hasInlineLines = draft.lines.some(l => l.inlineItem);

    const payload: Record<string, unknown> = {
      type: mapOperationType(draft.type),
      site_id: siteId,
      notes: draft.comment || '',
      lines: draft.lines
        .filter(l => l.quantity != null && l.quantity > 0 && (l.itemId || l.inlineItem))
        .map((l, idx) => {
          const baseLine: Record<string, unknown> = {
            line_number: idx + 1,
            qty: String(l.quantity),
          };
          if (l.inlineItem) {
            baseLine['temporary_item'] = {
              client_key: l.inlineItem.clientKey,
              name: l.inlineItem.name,
              sku: l.inlineItem.sku,
              unit_id: safeId(l.inlineItem.unitId),
              category_id: safeId(l.inlineItem.categoryId),
              description: l.inlineItem.description ?? null,
              hashtags: l.inlineItem.hashtags ?? null,
            };
          } else {
            baseLine['item_id'] = safeId(l.itemId);
          }
          return baseLine;
        }),
    };

    // Always include client_request_id for new operations (TZ C5)
    if (options.isCreate) {
      payload['client_request_id'] = this._newClientRequestId();
    }

    if (options.includeEffectiveAt) {
      const effectiveAt = this.toIsoDateTime(draft.effectiveAt);
      if (effectiveAt) payload['effective_at'] = effectiveAt;
    }

    if (includeSourceSite) {
      const srcId = safeId(draft.sourceSiteId);
      if (srcId !== null) payload['source_site_id'] = srcId;
    }

    if (includeDestinationSite) {
      const dstId = safeId(draft.destinationSiteId);
      if (dstId !== null) payload['destination_site_id'] = dstId;
    }

    if (draft.personName) payload['issued_to_name'] = draft.personName;

    if (draft.issueObjectId) {
      payload['issue_object_id'] = draft.issueObjectId;
    }
    if (draft.issueObjectName) {
      payload['issue_object_name_snapshot'] = draft.issueObjectName;
    }

    return payload;
  }

  private toDateTimeLocalValue(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const pad = (num: number) => String(num).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toIsoDateTime(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private normalizeError(err: any): void {
    const message = err?.message || 'Произошла ошибка';
    this.error.set(message);
    if (err?.fields) {
      console.error('Validation errors:', err.fields);
      this.fieldErrors.set(err.fields);
    } else {
      this.fieldErrors.set(null);
    }
  }
}
