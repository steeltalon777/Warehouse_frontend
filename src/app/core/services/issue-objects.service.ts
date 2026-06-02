import { Injectable, signal, computed } from '@angular/core';
import { BffApiService, PaginatedBffResponse } from '../api/bff-api.service';
import {
  IssueObject,
  IssueObjectCreatePayload,
  IssueObjectUpdatePayload,
  IssueObjectMergePayload,
} from '../models/issue-objects.models';
import { IssuedAssetRow } from '../models/assets.models';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IssueObjectsService {
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<IssueObject[]>([]);
  readonly totalCount = signal<number>(0);
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);

  readonly selectedObject = signal<IssueObject | null>(null);
  readonly objectAssets = signal<IssuedAssetRow[]>([]);
  readonly objectAssetsLoading = signal<boolean>(false);

  constructor(private bff: BffApiService) {}

  async loadList(filters: {
    search?: string;
    object_type?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  }): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const params: Record<string, string | number | boolean> = {
        page: filters.page ?? this.page(),
        page_size: filters.page_size ?? this.pageSize(),
      };
      if (filters.search) params['search'] = filters.search;
      if (filters.object_type) params['object_type'] = filters.object_type;
      if (filters.is_active !== undefined) params['is_active'] = filters.is_active;

      const result = await firstValueFrom(
        this.bff.getList<IssueObject>('/issue-objects', params)
      );
      this.items.set(result.items ?? []);
      this.totalCount.set(result.total_count ?? 0);
      this.page.set(result.page ?? 1);
      this.pageSize.set(result.page_size ?? 20);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки объектов выдачи');
      this.items.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async getObject(id: string): Promise<IssueObject | null> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.getData<IssueObject>(`/issue-objects/${id}`)
      );
      this.selectedObject.set(result);
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки объекта выдачи');
      return null;
    }
  }

  async createObject(payload: IssueObjectCreatePayload): Promise<IssueObject | null> {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.postData<IssueObject>('/issue-objects', payload)
      );
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка создания объекта выдачи');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async updateObject(id: string, payload: IssueObjectUpdatePayload): Promise<IssueObject | null> {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.patchData<IssueObject>(`/issue-objects/${id}`, payload)
      );
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка обновления объекта выдачи');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteObject(id: string): Promise<void> {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.bff.deleteData<void>(`/issue-objects/${id}`)
      );
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка удаления объекта выдачи');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async mergeObjects(payload: IssueObjectMergePayload): Promise<IssueObject | null> {
    this.isSaving.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.postData<IssueObject>('/issue-objects/merge', payload)
      );
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка слияния объектов выдачи');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }

  async loadObjectAssets(objectId: string): Promise<void> {
    this.objectAssetsLoading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.getData<IssuedAssetRow[]>(`/issue-objects/${objectId}/assets`)
      );
      this.objectAssets.set(result ?? []);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки имущества объекта');
      this.objectAssets.set([]);
    } finally {
      this.objectAssetsLoading.set(false);
    }
  }
}
