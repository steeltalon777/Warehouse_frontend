import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Observable, Subject, of, timer } from 'rxjs';
import { switchMap, filter, debounceTime, distinctUntilChanged, takeUntil, catchError, map, tap } from 'rxjs/operators';
import { BffApiService } from '../api/bff-api.service';

export interface CatalogSearchItem {
  id: string;
  name: string;
  sku: string;
  category_id: string;
  category_name: string;
  unit_id: string;
  unit_name: string;
  unit_symbol: string;
  is_active: boolean;
  requires_review: boolean;
  source: 'cache' | 'remote';
}

export interface CatalogSearchCategory {
  id: string;
  name: string;
  parent_id: string;
  path: string;
  is_active: boolean;
  source: 'cache' | 'remote';
}

export interface CatalogSearchResults<T> {
  results: T[];
}

@Injectable({
  providedIn: 'root'
})
export class CatalogSearchService implements OnDestroy {
  private readonly basePath = '/catalog/search';
  private readonly defaultLimit = 20;

  private readonly destroy$ = new Subject<void>();
  private readonly searchQuery$ = new Subject<string>();

  // State signals
  readonly itemSearchQuery = signal<string>('');
  readonly categorySearchQuery = signal<string>('');

  readonly isSearchingItems = signal<boolean>(false);
  readonly isSearchingCategories = signal<boolean>(false);

  readonly itemSearchError = signal<string | null>(null);
  readonly categorySearchError = signal<string | null>(null);

  readonly itemResults = signal<CatalogSearchItem[]>([]);
  readonly categoryResults = signal<CatalogSearchCategory[]>([]);

  // Loading state computed
  readonly isLoading = computed(() => this.isSearchingItems() || this.isSearchingCategories());

  constructor(private bff: BffApiService) {
    this.initItemSearch();
    this.initCategorySearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Item Search ────────────────────────────────────────────────

  searchItems(query: string, limit: number = this.defaultLimit): void {
    this.itemSearchQuery.set(query);

    if (!query || query.trim().length < 2) {
      this.itemResults.set([]);
      this.isSearchingItems.set(false);
      return;
    }

    this.searchQuery$.next(query);
  }

  private initItemSearch(): void {
    this.searchQuery$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      tap(() => {
        this.isSearchingItems.set(true);
        this.itemSearchError.set(null);
      }),
      switchMap(query => this.performItemSearch(query)),
      catchError(err => {
        console.error('Item search error:', err);
        this.itemSearchError.set(err.message || 'Ошибка поиска');
        this.itemResults.set([]);
        return of({ results: [] } as CatalogSearchResults<CatalogSearchItem>);
      })
    ).subscribe(response => {
      this.itemResults.set(response.results || []);
      this.isSearchingItems.set(false);
    });
  }

  private performItemSearch(query: string, limit: number = this.defaultLimit): Observable<CatalogSearchResults<CatalogSearchItem>> {
    return this.bff.getData<CatalogSearchResults<CatalogSearchItem>>(
      `${this.basePath}/items`,
      { q: query, limit }
    );
  }

  clearItemSearch(): void {
    this.itemSearchQuery.set('');
    this.itemResults.set([]);
    this.itemSearchError.set(null);
  }

  // ─── Category Search ───────────────────────────────────────────

  searchCategories(query: string, limit: number = this.defaultLimit): void {
    this.categorySearchQuery.set(query);

    if (!query || query.trim().length < 1) {
      this.categoryResults.set([]);
      this.isSearchingCategories.set(false);
      return;
    }

    this.performCategorySearch(query, limit).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Category search error:', err);
        this.categorySearchError.set(err.message || 'Ошибка поиска категорий');
        this.categoryResults.set([]);
        return of({ results: [] } as CatalogSearchResults<CatalogSearchCategory>);
      })
    ).subscribe(response => {
      this.categoryResults.set(response.results || []);
      this.isSearchingCategories.set(false);
    });
  }

  private performCategorySearch(query: string, limit: number): Observable<CatalogSearchResults<CatalogSearchCategory>> {
    this.isSearchingCategories.set(true);
    return this.bff.getData<CatalogSearchResults<CatalogSearchCategory>>(
      `${this.basePath}/categories`,
      { q: query, limit }
    );
  }

  clearCategorySearch(): void {
    this.categorySearchQuery.set('');
    this.categoryResults.set([]);
    this.categorySearchError.set(null);
  }

  // ─── Direct Search Methods (for one-off calls) ─────────────────

  searchItemsOnce(query: string, limit: number = this.defaultLimit): Observable<CatalogSearchItem[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }
    return this.bff.getData<CatalogSearchResults<CatalogSearchItem>>(
      `${this.basePath}/items`,
      { q: query, limit }
    ).pipe(
      map(response => response.results || [])
    );
  }

  searchCategoriesOnce(query: string, limit: number = this.defaultLimit): Observable<CatalogSearchCategory[]> {
    if (!query || query.trim().length < 1) {
      return of([]);
    }
    return this.bff.getData<CatalogSearchResults<CatalogSearchCategory>>(
      `${this.basePath}/categories`,
      { q: query, limit }
    ).pipe(
      map(response => response.results || [])
    );
  }
}