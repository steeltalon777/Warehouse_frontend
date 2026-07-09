import { inject, Injectable, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BffApiService } from '../api/bff-api.service';
import {
  TemporaryItem, TempItemDetail, TempItemOperation,
  TempItemMergePayload, TempItemApprovePayload,
  TempItemsListFilters, TempItemsSort,
  TemporaryItemVm, toTempItemVm,
} from '../models/temp-items.models';

@Injectable({ providedIn: 'root' })
export class TempItemsService {
  private readonly bffApi = inject(BffApiService);

  readonly items = signal<TemporaryItemVm[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly role = signal<string>('storekeeper');

  readonly totalActive = computed(() => this.items().length);
  readonly needsReviewCount = computed(() => this.items().filter(i => i.uiStatus === 'needs_review').length);
  readonly inPendingAcceptanceCount = computed(() => this.items().filter(i => i.uiStatus === 'in_pending_acceptance').length);
  readonly canDeleteCount = computed(() => this.items().filter(i => i.uiStatus === 'can_delete').length);

  async loadList(
    filters?: TempItemsListFilters,
    sort?: TempItemsSort,
    page: number = 1,
    pageSize: number = 25,
  ): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const params: Record<string, string | number | boolean> = {
        page,
        page_size: pageSize,
      };

      if (filters?.search) params['search'] = filters.search;
      if (filters?.created_after) params['created_after'] = filters.created_after;
      if (filters?.created_before) params['created_before'] = filters.created_before;
      if (filters?.created_by_user_id) params['created_by_user_id'] = filters.created_by_user_id;

      params['status'] = 'active';

      if (sort?.sort_by) {
        params['sort_by'] = sort.sort_by;
        params['sort_order'] = sort.sort_order ?? 'desc';
      }

      const response = await firstValueFrom(
        this.bffApi.getList<TemporaryItem>('/review-items', params)
      );

      const hasPendingAcceptance = false;
      const role = this.role();

      const vms = (response.items || []).map(item => {
        const opsCount = 0;
        return toTempItemVm(item, opsCount, false, role);
      });

      let filteredVms = vms;
      if (filters?.ui_status) {
        filteredVms = vms.filter(vm => vm.uiStatus === filters.ui_status);
      }
      if (filters?.has_balance !== undefined) {
        filteredVms = filteredVms.filter(vm =>
          filters.has_balance ? vm.totalBalance > 0 : vm.totalBalance === 0
        );
      }
      if (filters?.has_pending_acceptance !== undefined) {
        filteredVms = filteredVms.filter(vm =>
          filters.has_pending_acceptance ? vm.hasPendingAcceptance : !vm.hasPendingAcceptance
        );
      }

      filteredVms.sort((a, b) => {
        const aScore = a.uiStatus === 'needs_review' ? 0 : 1;
        const bScore = b.uiStatus === 'needs_review' ? 0 : 1;
        if (aScore !== bScore) return aScore - bScore;
        return b.createdAt.localeCompare(a.createdAt);
      });

      this.items.set(filteredVms);
      this.totalCount.set(response.total_count ?? filteredVms.length);
      this.page.set(response.page ?? page);
      this.pageSize.set(response.page_size ?? pageSize);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки временных ТМЦ');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDetail(id: string): Promise<TempItemDetail | null> {
    try {
      return await firstValueFrom(
        this.bffApi.getData<TempItemDetail>(`/review-items/${id}`)
      );
    } catch {
      return null;
    }
  }

  async loadOperations(id: string): Promise<TempItemOperation[]> {
    try {
      const response = await firstValueFrom(
        this.bffApi.getList<TempItemOperation>(`/review-items/${id}/operations`)
      );
      return response?.items || [];
    } catch {
      return [];
    }
  }

  async approveAsItem(id: string, payload: TempItemApprovePayload): Promise<boolean> {
    try {
      await firstValueFrom(
        this.bffApi.postData(`/review-items/${id}/confirm`, payload)
      );
      return true;
    } catch {
      return false;
    }
  }

  async confirmItem(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.bffApi.postData(`/review-items/${id}/confirm`, {})
      );
      return true;
    } catch {
      return false;
    }
  }

  async mergeToPermanent(id: string, targetItemId: string, comment?: string): Promise<boolean> {
    try {
      const payload: TempItemMergePayload = { target_item_id: targetItemId };
      if (comment) payload.comment = comment;
      await firstValueFrom(
        this.bffApi.postData(`/review-items/${id}/merge`, payload)
      );
      return true;
    } catch {
      return false;
    }
  }

  async deleteItem(id: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.bffApi.deleteData(`/review-items/${id}`)
      );
      return true;
    } catch {
      return false;
    }
  }

  async loadRole(): Promise<void> {
    try {
      const ctx = await firstValueFrom(
        this.bffApi.getData<{ role: string }>('/auth/me')
      );
      this.role.set(ctx?.role || 'storekeeper');
    } catch {
      this.role.set('storekeeper');
    }
  }

  setPage(page: number): void {
    this.page.set(page);
    this.loadList(undefined, undefined, page, this.pageSize());
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.loadList(undefined, undefined, 1, size);
  }

  async refresh(): Promise<void> {
    return this.loadList();
  }
}
