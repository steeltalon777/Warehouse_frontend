import { Injectable, signal, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BffApiService } from '../api/bff-api.service';
import {
  LostAssetRow,
  LostAssetsFilterVm,
  LostAssetsListResult,
  LostAssetDetailVm,
  LostAssetResolvePayload,
} from '../models/assets.models';

@Injectable({ providedIn: 'root' })
export class LostAssetsService {
  private readonly bff = inject(BffApiService);

  readonly isLoading = signal(false);
  readonly isResolving = signal(false);
  readonly error = signal<string | null>(null);
  readonly listResult = signal<LostAssetsListResult | null>(null);
  readonly detail = signal<LostAssetDetailVm | null>(null);

  async listLostAssets(filters: LostAssetsFilterVm): Promise<LostAssetsListResult> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const params: Record<string, string | number | boolean> = {
        page: filters.page,
        page_size: filters.pageSize,
      };
      if (filters.search) params['search'] = filters.search;
      if (filters.siteId) params['site_id'] = filters.siteId;
      if (filters.operationId) params['operation_id'] = filters.operationId;

      const response = await firstValueFrom(
        this.bff.getList<LostAssetRow>('/lost-assets', params)
      );

      const result: LostAssetsListResult = {
        items: response.items ?? [],
        totalCount: response.total_count ?? 0,
        page: response.page ?? filters.page,
        pageSize: response.page_size ?? filters.pageSize,
      };

      this.listResult.set(result);
      return result;
    } catch (err: any) {
      const message = err?.message || 'Ошибка загрузки списка непринятых активов';
      this.error.set(message);
      throw err;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getLostAsset(operationLineId: string): Promise<LostAssetDetailVm | null> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const data = await firstValueFrom(
        this.bff.getData<LostAssetRow>(`/lost-assets/${operationLineId}`)
      );
      this.detail.set(data as LostAssetDetailVm);
      return data as LostAssetDetailVm;
    } catch (err: any) {
      const message = err?.message || 'Ошибка загрузки данных актива';
      this.error.set(message);
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async resolveLostAsset(
    operationLineId: string,
    payload: LostAssetResolvePayload
  ): Promise<void> {
    this.isResolving.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(
        this.bff.postData<void>(`/lost-assets/${operationLineId}/resolve`, payload)
      );
      // Backend does not return resolved lost assets via GET detail.
      // Mark the current detail as resolved locally instead of reloading.
      this.detail.update(prev => prev ? { ...prev, status: 'resolved' } : null);
    } catch (err: any) {
      const message = err?.message || 'Ошибка при подтверждении решения';
      this.error.set(message);
      throw err;
    } finally {
      this.isResolving.set(false);
    }
  }

  clearDetail(): void {
    this.detail.set(null);
    this.error.set(null);
  }
}
