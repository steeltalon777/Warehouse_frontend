import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';
import { takeUntil, catchError, map, finalize } from 'rxjs/operators';
import { BffApiService } from '../api/bff-api.service';
import { ConsistencyMode, ResolvedItemDto } from '../models/operations.models';

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

  // State signals
  readonly categorySearchQuery = signal<string>('');
  readonly unitSearchQuery = signal<string>('');

  readonly isSearchingItems = signal<boolean>(false);
  readonly isSearchingCategories = signal<boolean>(false);
  readonly isSearchingUnits = signal<boolean>(false);

  readonly categorySearchError = signal<string | null>(null);
  readonly unitSearchError = signal<string | null>(null);

  readonly categoryResults = signal<CatalogSearchCategory[]>([]);
  readonly unitResults = signal<CatalogSearchUnit[]>([]);

  // Unit cache for client-side filtering and reuse across components
  private readonly unitCache = signal<CatalogSearchUnit[]>([]);

  // Loading state computed
  readonly isLoading = computed(() => this.isSearchingItems() || this.isSearchingCategories() || this.isSearchingUnits());

  constructor(private bff: BffApiService) {
    this.initCategorySearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Item search (stateless once-calls) ─────────────────────────

  /**
   * Stage 3a: parameters of the last actual item search. The explicit
   * «Обновить и проверить» refresh re-runs the authoritative request for the
   * actual current query/context instead of the previously dead itemSearchQuery
   * signal that `searchItemsOnce` never filled.
   */
  private lastItemsSearch: {
    query: string;
    limit: number;
    sourceSiteId?: string;
    includeBalance?: boolean;
  } | null = null;

  /**
   * TZ D1/D2: one-off (stateless) item search used by the operation modal,
   * the operations list filter and explicit refreshes. Results are deduped by
   * stable item ID only — same-name items with different IDs stay distinct.
   */
  searchItemsOnce(query: string, limit: number = this.defaultLimit, sourceSiteId?: string, includeBalance?: boolean, consistency?: ConsistencyMode): Observable<CatalogSearchItem[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }
    this.lastItemsSearch = { query, limit, sourceSiteId, includeBalance };
    const params: Record<string, string | number | boolean> = { q: query, limit };
    if (sourceSiteId) params['source_site_id'] = sourceSiteId;
    if (includeBalance) params['include_balance'] = true;
    if (consistency) params['consistency'] = consistency;
    return this.bff.getData<CatalogSearchResults<CatalogSearchItem>>(
      `${this.basePath}/items`,
      params
    ).pipe(
      map(response => dedupeItemsById(response.results || []))
    );
  }

  /**
   * Stage 3a: explicit authoritative refresh for the current search state.
   *
   * Always issues `consistency=authoritative` (BFF reaches SyncServer directly
   * and never merges the local catalog cache for that mode) and returns the
   * complete authoritative candidate set for full replacement in the UI.
   * Falls back to the last `searchItemsOnce` parameters when not supplied.
   */
  refreshItemsAuthoritativeOnce(query?: string, sourceSiteId?: string | null): Observable<CatalogSearchItem[]> {
    const effectiveQuery = (query ?? this.lastItemsSearch?.query ?? '').trim();
    if (effectiveQuery.length < 2) {
      return of([]);
    }
    const effectiveSite = sourceSiteId !== undefined
      ? (sourceSiteId ?? undefined)
      : this.lastItemsSearch?.sourceSiteId;
    const limit = this.lastItemsSearch?.limit ?? this.defaultLimit;
    const includeBalance = this.lastItemsSearch?.includeBalance ?? false;
    this.isSearchingItems.set(true);
    return this.searchItemsOnce(
      effectiveQuery,
      limit,
      effectiveSite,
      includeBalance,
      'authoritative',
    ).pipe(
      finalize(() => this.isSearchingItems.set(false)),
    );
  }

  private initCategorySearch(): void {
    // reserved — category search implementation coming in a future PR.
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

/**
 * Stage 3a: candidate identity is the stable item ID. Deduplicate by ID only —
 * identical human names with different IDs are two distinct real items.
 */
export function dedupeItemsById(items: CatalogSearchItem[]): CatalogSearchItem[] {
  const seen = new Set<string>();
  const result: CatalogSearchItem[] = [];
  for (const item of items) {
    const id = String(item?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}
