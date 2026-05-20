import { Injectable, signal, computed } from '@angular/core';
import { BffApiService, PaginatedBffResponse } from '../api/bff-api.service';
import {
  OperationDto,
  OperationType,
  OperationStatus,
  OperationsFilterVm,
  OperationListRowVm,
  OperationDraftVm,
  OperationLineDraftVm,
  SiteDto,
  BalanceDto,
  OPERATION_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
} from '../models/operations.models';
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

  constructor(
    private bff: BffApiService,
    private authContextService: AuthContextService,
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
      if (filters.type) params['type'] = filters.type;
      if (filters.status) {
        const role = this.authContextService.authContext()?.role ?? 'observer';
        if (role !== 'root' && filters.status === 'cancelled') {
          // non-root must not request cancelled status
        } else {
          params['status'] = filters.status;
        }
      }
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

  // ─── CRUD ────────────────────────────────────────────────────

  async createOperation(draft: OperationDraftVm): Promise<OperationDto | null> {
    this.isSaving.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    try {
      const payload = this.buildPayload(draft);
      const result = await firstValueFrom(
        this.bff.postData<OperationDto>('/operations', payload)
      );
      return result;
    } catch (err: any) {
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
    try {
      const payload = this.buildPayload(draft);
      const result = await firstValueFrom(
        this.bff.patchData<OperationDto>(`/operations/${id}`, payload)
      );
      return result;
    } catch (err: any) {
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async submitOperation(id: string): Promise<void> {
    this.isSubmitting.set(true);
    this.error.set(null);
    this.fieldErrors.set(null);
    try {
      await firstValueFrom(
        this.bff.postData<unknown>(`/operations/${id}/submit`, { submit: true })
      );
    } catch (err: any) {
      this.normalizeError(err);
      throw err;
    } finally {
      this.isSubmitting.set(false);
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

  // ─── Sites / Balances ────────────────────────────────────────

  async loadSites(): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.bff.getData<{ sites?: SiteDto[] }>('/catalog/sites')
      );
      this.sites.set(result?.sites ?? []);
    } catch {
      this.sites.set([]);
    }
  }

  async loadBalances(siteId?: string): Promise<void> {
    try {
      const params: Record<string, string> = {};
      if (siteId) params['site_id'] = siteId;
      const result = await firstValueFrom(
        this.bff.getData<BalanceDto[]>('/balances', params)
      );
      this.balances.set(result ?? []);
    } catch {
      this.balances.set([]);
    }
  }

  getBalanceForItem(itemId: string, siteId?: string): number {
    const list = this.balances();
    const row = list.find(
      b => b.item_id === itemId && (!siteId || b.site_id === siteId)
    );
    if (!row) return 0;
    const qty = parseFloat(row.qty);
    return isNaN(qty) ? 0 : qty;
  }

  // ─── Mappers ─────────────────────────────────────────────────

  private mapToRowVm(op: OperationDto): OperationListRowVm {
    const typeLabel = OPERATION_TYPE_LABELS[op.type] ?? op.type;
    const statusLabel = OPERATION_STATUS_LABELS[op.status] ?? op.status;

    const directionParts: string[] = [];
    if (op.source_site_name) directionParts.push(op.source_site_name);
    if (op.destination_site_name) directionParts.push(op.destination_site_name);
    if (op.person_name && !op.destination_site_name) directionParts.push(op.person_name);

    const directionLabel = directionParts.join(' → ') || '—';

    const isDraft = op.status === 'draft';
    const isCreated = op.status === 'created';
    const isPending = op.status === 'pending';
    const isSubmitted = op.status === 'submitted';
    const isCancelled = op.status === 'cancelled';
    const isRejected = op.status === 'rejected';

    const auth = this.authContextService.authContext();
    const role = auth?.role ?? 'observer';
    const userId = auth?.userId ?? '';

    let canEdit = false;
    let canSubmit = false;
    let canCancel = false;
    let canPrint = false;
    let canAccept = false;

    if (role === 'observer') {
      canEdit = false;
      canSubmit = false;
      canCancel = false;
      canPrint = isSubmitted;
      canAccept = false;
    } else if (role === 'storekeeper') {
      canEdit = isDraft && op.created_by_user_id === userId;
      canSubmit = isDraft || isCreated;
      canCancel = isDraft || isCreated || isPending;
      canPrint = isSubmitted;
      canAccept = isPending;
    } else if (role === 'chief_storekeeper') {
      canEdit = isDraft;
      canSubmit = isDraft || isCreated;
      canCancel = isDraft || isCreated || isPending;
      canPrint = isSubmitted;
      canAccept = isPending;
    } else {
      // root / default (fallback)
      canEdit = isDraft;
      canSubmit = isDraft || isCreated;
      canCancel = isDraft || isCreated || isPending || isSubmitted;
      canPrint = isSubmitted;
      canAccept = isPending;
    }

    if (isCancelled || isRejected) {
      canCancel = false;
    }

    return {
      id: op.id,
      number: op.number || op.id.slice(0, 8).toUpperCase(),
      type: op.type,
      typeLabel,
      status: op.status,
      statusLabel,
      createdAt: op.created_at,
      createdByUserId: op.created_by_user_id,
      createdByLabel: op.created_by_label || op.created_by_user_id,
      sourceSiteId: op.source_site_id,
      sourceSiteName: op.source_site_name,
      destinationSiteId: op.destination_site_id,
      destinationSiteName: op.destination_site_name,
      personName: op.person_name,
      directionLabel,
      linesCount: op.lines_count ?? (op.lines?.length ?? 0),
      canOpen: true,
      canEdit,
      canSubmit,
      canCancel,
      canPrint,
      canAccept,
    };
  }

  private buildPayload(draft: OperationDraftVm): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      type: draft.type,
      notes: draft.comment || '',
      lines: draft.lines
        .filter(l => l.quantity != null && l.quantity > 0)
        .map(l => ({
          item_id: l.itemId,
          qty: String(l.quantity),
          unit_id: l.unitId,
          note: '',
        })),
    };

    if (draft.sourceSiteId) payload['source_site_id'] = draft.sourceSiteId;
    if (draft.destinationSiteId) payload['destination_site_id'] = draft.destinationSiteId;
    if (draft.personName) payload['person_name'] = draft.personName;

    return payload;
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
