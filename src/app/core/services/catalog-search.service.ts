import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Observable, Subject, of, throwError, timer } from 'rxjs';
import { switchMap, filter, debounceTime, distinctUntilChanged, takeUntil, catchError, map, tap } from 'rxjs/operators';
import { BffApiService } from '../api/bff-api.service';
import { ConsistencyMode, ResolvedItemDto, ItemResolveStatus } from '../models/operations.models';

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
  hashtags?: string[];
  source_site_id?: string;
  source_site_qty?: string;
  balance_qty?: string;
}

export interface CatalogSearchCategory {
  id: string;
  name: string;
  parent_id: string;
  path: string;
  is_active: boolean;
  source: 'cache' | 'remote';
}

export interface CatalogSearchUnit {
  id: string;
  name: string;
  symbol: string;
  is_active: boolean;
}

export interface CatalogSearchResults<T> {
  results: T[];
}

export interface CatalogUnitsResponse {
  units: CatalogSearchUnit[];
  server_time?: string;
  next_updated_after?: string;
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
  readonly unitSearchQuery = signal<string>('');

  readonly isSearchingItems = signal<boolean>(false);
  readonly isSearchingCategories = signal<boolean>(false);
  readonly isSearchingUnits = signal<boolean>(false);

  readonly itemSearchError = signal<string | null>(null);
  readonly categorySearchError = signal<string | null>(null);
  readonly unitSearchError = signal<string | null>(null);

  readonly itemResults = signal<CatalogSearchItem[]>([]);
  readonly categoryResults = signal<CatalogSearchCategory[]>([]);
  readonly unitResults = signal<CatalogSearchUnit[]>([]);

  // Unit cache for client-side filtering and reuse across components
  private readonly unitCache = signal<CatalogSearchUnit[]>([]);

  // Loading state computed
  readonly isLoading = computed(() => this.isSearchingItems() || this.isSearchingCategories() || this.isSearchingUnits());

  constructor(private bff: BffApiService) {
    this.initItemSearch();
    this.initCategorySearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Item Search with Consistency (TZ D1/D2) ────────────────────

  private _lastSourceSiteId?: string;
  private _lastIncludeBalance?: boolean;
  private _lastConsistency?: ConsistencyMode;

  searchItems(query: string, limit: number = this.defaultLimit, sourceSiteId?: string, includeBalance?: boolean, consistency?: ConsistencyMode): void {
    this.itemSearchQuery.set(query);

    if (!query || query.trim().length < 2) {
      this.itemResults.set([]);
      this.isSearchingItems.set(false);
      return;
    }

    this._lastSourceSiteId = sourceSiteId;
    this._lastIncludeBalance = includeBalance;
    this._lastConsistency = consistency;
    this.searchQuery$.next(query);
  }

  /**
   * TZ D2: refresh current search with authoritative mode.
   * Cancels the current debounced stream and re-runs the current query
   * directly with consistency=authoritative.
   */
  refreshItemsAuthoritative(): void {
    const currentQuery = this.itemSearchQuery();
    if (!currentQuery || currentQuery.trim().length < 2) return;

    this._lastConsistency = 'authoritative';
    this.isSearchingItems.set(true);
    this.itemSearchError.set(null);

    this.performItemSearch(
      currentQuery,
      this.defaultLimit,
      this._lastSourceSiteId,
      this._lastIncludeBalance,
      'authoritative',
    ).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Authoritative item search error:', err);
        this.itemSearchError.set(err.message || 'Ошибка авторитетного поиска');
        this.itemResults.set([]);
        this.isSearchingItems.set(false);
        return of({ results: [] } as CatalogSearchResults<CatalogSearchItem>);
      })
    ).subscribe(response => {
      this.itemResults.set(response.results || []);
      this.isSearchingItems.set(false);
      this._lastConsistency = undefined;
    });
  }

  private initCategorySearch(): void {
    // reserved — category search implementation coming in a future PR.
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
      switchMap(query => this.performItemSearch(
        query,
        this.defaultLimit,
        this._lastSourceSiteId,
        this._lastIncludeBalance,
        this._lastConsistency,
      )),
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

  private performItemSearch(
    query: string,
    limit: number = this.defaultLimit,
    sourceSiteId?: string,
    includeBalance?: boolean,
    consistency?: ConsistencyMode,
  ): Observable<CatalogSearchResults<CatalogSearchItem>> {
    const params: Record<string, string | number | boolean> = { q: query, limit };
    if (sourceSiteId) params['source_site_id'] = sourceSiteId;
    if (includeBalance) params['include_balance'] = true;
    if (consistency) params['consistency'] = consistency;
    return this.bff.getData<CatalogSearchResults<CatalogSearchItem>>(
      `${this.basePath}/items`,
      params
    );
  }

  clearItemSearch(): void {
    this.itemSearchQuery.set('');
    this.itemResults.set([]);
    this.itemSearchError.set(null);
  }

  // ─── Batch Item Resolver (TZ D2/D3) ───────────────────────────

  /**
   * Batch-resolve item IDs via the BFF resolver endpoint.
   * Used by operation-create-modal before Save/Submit.
   */
  resolveItems(itemIds: (string | number)[]): Observable<ResolvedItemDto[]> {
    if (!itemIds.length) return of([]);
    return this.bff.postData<{ results: ResolvedItemDto[] }>('/catalog/read/items/resolve', {
      item_ids: itemIds.map(id => String(id)),
    }).pipe(
      map(resp => resp.results || []),
      catchError(err => {
        console.error('Item resolve error:', err);
        return throwError(() => err);
      }),
    );
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

  // ─── Unit Search ────────────────────────────────────────────────

  loadUnits(limit: number = 1000): Observable<CatalogSearchUnit[]> {
    this.isSearchingUnits.set(true);
    this.unitSearchError.set(null);
    return this.bff.getData<CatalogUnitsResponse>('/catalog/units', { limit }).pipe(
      map(response => {
        const rawUnits = response?.units || [];
        const mapped = rawUnits.map(u => ({
          id: String(u.id),
          name: u.name,
          symbol: u.symbol,
          is_active: u.is_active ?? true,
        } as CatalogSearchUnit));
        this.unitCache.set(mapped);
        this.isSearchingUnits.set(false);
        return mapped;
      }),
      catchError(err => {
        console.error('Unit load error:', err);
        this.unitSearchError.set(err.message || 'Ошибка загрузки единиц измерения');
        this.isSearchingUnits.set(false);
        return of([]);
      })
    );
  }

  searchUnits(query: string, limit: number = this.defaultLimit): void {
    this.unitSearchQuery.set(query);

    if (!query || query.trim().length < 1) {
      this.unitResults.set([]);
      this.isSearchingUnits.set(false);
      return;
    }

    const q = query.trim().toLowerCase();
    const filterUnits = (units: CatalogSearchUnit[]) => {
      return units
        .filter(u => u.is_active)
        .filter(u => u.name.toLowerCase().includes(q) || u.symbol.toLowerCase().includes(q))
        .slice(0, limit);
    };

    if (this.unitCache().length > 0) {
      this.isSearchingUnits.set(true);
      this.unitSearchError.set(null);
      this.unitResults.set(filterUnits(this.unitCache()));
      this.isSearchingUnits.set(false);
      return;
    }

    this.isSearchingUnits.set(true);
    this.unitSearchError.set(null);
    this.loadUnits(1000).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        console.error('Unit search error:', err);
        this.unitSearchError.set(err.message || 'Ошибка поиска единиц измерения');
        this.unitResults.set([]);
        this.isSearchingUnits.set(false);
        return of([]);
      })
    ).subscribe(units => {
      this.unitResults.set(filterUnits(units));
      this.isSearchingUnits.set(false);
    });
  }

  clearUnitSearch(): void {
    this.unitSearchQuery.set('');
    this.unitResults.set([]);
    this.unitSearchError.set(null);
  }

  // ─── Direct Search Methods (for one-off calls) ─────────────────

  searchItemsOnce(query: string, limit: number = this.defaultLimit, sourceSiteId?: string, includeBalance?: boolean, consistency?: ConsistencyMode): Observable<CatalogSearchItem[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }
    const params: Record<string, string | number | boolean> = { q: query, limit };
    if (sourceSiteId) params['source_site_id'] = sourceSiteId;
    if (includeBalance) params['include_balance'] = true;
    if (consistency) params['consistency'] = consistency;
    return this.bff.getData<CatalogSearchResults<CatalogSearchItem>>(
      `${this.basePath}/items`,
      params
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

  searchUnitsOnce(query: string, limit: number = this.defaultLimit): Observable<CatalogSearchUnit[]> {
    if (!query || query.trim().length < 1) {
      return of([]);
    }
    const q = query.trim().toLowerCase();
    const filterUnits = (units: CatalogSearchUnit[]) => {
      return units
        .filter(u => u.is_active)
        .filter(u => u.name.toLowerCase().includes(q) || u.symbol.toLowerCase().includes(q))
        .slice(0, limit);
    };

    if (this.unitCache().length > 0) {
      return of(filterUnits(this.unitCache()));
    }

    return this.loadUnits(1000).pipe(
      map(units => filterUnits(units))
    );
  }
}
