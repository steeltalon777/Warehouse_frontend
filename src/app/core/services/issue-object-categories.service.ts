import { Injectable, signal } from '@angular/core';
import { BffApiService } from '../api/bff-api.service';
import {
  IssueObjectCategory,
  IssueObjectCategoryCreatePayload,
  IssueObjectCategoryUpdatePayload,
} from '../models/issue-objects.models';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IssueObjectCategoriesService {
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<IssueObjectCategory[]>([]);
  readonly totalCount = signal<number>(0);
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);

  readonly selectedCategory = signal<IssueObjectCategory | null>(null);

  constructor(private bff: BffApiService) {}

  async loadList(filters: {
    search?: string;
    parent_id?: string;
    is_active?: boolean;
    include_deleted?: boolean;
    page?: number;
    page_size?: number;
  } = {}): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const params: Record<string, string | number | boolean> = {
        page: filters.page ?? this.page(),
        page_size: filters.page_size ?? this.pageSize(),
      };
      if (filters.search) params['search'] = filters.search;
      if (filters.parent_id) params['parent_id'] = filters.parent_id;
      if (filters.is_active !== undefined) params['is_active'] = filters.is_active;
      if (filters.include_deleted !== undefined) params['include_deleted'] = filters.include_deleted;

      const result = await firstValueFrom(
        this.bff.getList<IssueObjectCategory>('/issue-object-categories', params)
      );
      this.items.set(result.items ?? []);
      this.totalCount.set(result.total_count ?? 0);
      this.page.set(result.page ?? 1);
      this.pageSize.set(result.page_size ?? 20);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки категорий объектов выдачи');
      this.items.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async getCategory(id: string): Promise<IssueObjectCategory | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.getData<IssueObjectCategory>(`/issue-object-categories/${id}`)
      );
      this.selectedCategory.set(result);
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки категории объекта выдачи');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async createCategory(payload: IssueObjectCategoryCreatePayload): Promise<IssueObjectCategory | null> {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.postData<IssueObjectCategory>('/issue-object-categories', payload)
      );
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка создания категории объекта выдачи');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async updateCategory(
    id: string,
    payload: IssueObjectCategoryUpdatePayload
  ): Promise<IssueObjectCategory | null> {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.patchData<IssueObjectCategory>(`/issue-object-categories/${id}`, payload)
      );
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка обновления категории объекта выдачи');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.bff.deleteData<void>(`/issue-object-categories/${id}`)
      );
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка удаления категории объекта выдачи');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }
}
