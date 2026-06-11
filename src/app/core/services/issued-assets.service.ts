import { Injectable, signal, computed } from '@angular/core';
import { BffApiService, PaginatedBffResponse } from '../api/bff-api.service';
import { IssuedAssetRow } from '../models/assets.models';
import { firstValueFrom } from 'rxjs';

export interface IssuedAssetsFilter {
  issue_object_id?: string;
  category_id?: string;
  item_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

@Injectable({
  providedIn: 'root'
})
export class IssuedAssetsService {
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<IssuedAssetRow[]>([]);
  readonly totalCount = signal<number>(0);
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);

  constructor(private bff: BffApiService) {}

  async loadList(filters: IssuedAssetsFilter = {}): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const params: Record<string, string | number | boolean> = {
        page: filters.page ?? this.page(),
        page_size: filters.page_size ?? this.pageSize(),
      };
      if (filters.search) params['search'] = filters.search;
      if (filters.issue_object_id) params['issue_object_id'] = filters.issue_object_id;
      if (filters.category_id) params['category_id'] = filters.category_id;
      if (filters.item_id) params['item_id'] = filters.item_id;

      const result = await firstValueFrom(
        this.bff.getList<IssuedAssetRow>('/issued-assets', params)
      );
      this.items.set(result.items ?? []);
      this.totalCount.set(result.total_count ?? 0);
      this.page.set(result.page ?? 1);
      this.pageSize.set(result.page_size ?? 20);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки выданного имущества');
      this.items.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  setPage(page: number): void {
    this.page.set(page);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
  }
}
