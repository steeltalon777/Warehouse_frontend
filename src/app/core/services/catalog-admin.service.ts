import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BffApiService } from '../api/bff-api.service';
import { Item, Category, ItemMergeRequest, CategoryMergeRequest } from '../models/nomenclature.models';

@Injectable({ providedIn: 'root' })
export class CatalogAdminService {
  private readonly bffApi = inject(BffApiService);

  mergeItem(request: ItemMergeRequest): Observable<Item> {
    return this.bffApi.postData<Item>('/catalog/admin/items/merge', request);
  }

  mergeCategory(request: CategoryMergeRequest): Observable<Category> {
    return this.bffApi.postData<Category>('/catalog/admin/categories/merge', request);
  }
}
