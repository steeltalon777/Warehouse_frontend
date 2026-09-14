import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CatalogSearchService, CatalogSearchItem } from './catalog-search.service';
import { BffApiService } from '../api/bff-api.service';

function makeItem(overrides: Partial<CatalogSearchItem> = {}): CatalogSearchItem {
  return {
    id: 'id-1',
    name: 'Кабель ВВГ',
    sku: 'CAB-001',
    category_id: 'cat-1',
    category_name: 'Кабель',
    unit_id: 'unit-1',
    unit_name: 'м',
    unit_symbol: 'м',
    is_active: true,
    requires_review: false,
    source: 'remote',
    ...overrides,
  };
}

describe('CatalogSearchService — Stage 3a authoritative refresh lifecycle', () => {
  let getData: ReturnType<typeof vi.fn>;
  let service: CatalogSearchService;

  beforeEach(() => {
    getData = vi.fn(() => of({ results: [makeItem()] }));
    TestBed.configureTestingModule({
      providers: [
        CatalogSearchService,
        { provide: BffApiService, useValue: { getData, postData: vi.fn() } },
      ],
    });
    service = TestBed.inject(CatalogSearchService);
  });

  it('searchItemsOnce records the actual query/context for the refresh path', () => {
    service.searchItemsOnce('кабель', 20, 'site-7', false, 'fast').subscribe();

    expect(getData).toHaveBeenCalledWith('/catalog/search/items', {
      q: 'кабель',
      limit: 20,
      source_site_id: 'site-7',
      consistency: 'fast',
    });

    getData.mockClear();
    getData.mockReturnValue(of({ results: [makeItem({ id: 'fresh' })] }));

    // No explicit args: refresh must reuse the recorded query/site.
    service.refreshItemsAuthoritativeOnce().subscribe();

    expect(getData).toHaveBeenCalledWith('/catalog/search/items', {
      q: 'кабель',
      limit: 20,
      source_site_id: 'site-7',
      consistency: 'authoritative',
    });
  });

  it('refreshItemsAuthoritativeOnce always forces consistency=authoritative', () => {
    service.searchItemsOnce('кабель', 20, 'site-7', false).subscribe();
    getData.mockClear();

    service.refreshItemsAuthoritativeOnce('кабель', 'site-9').subscribe();

    expect(getData).toHaveBeenCalledWith('/catalog/search/items', {
      q: 'кабель',
      limit: 20,
      source_site_id: 'site-9',
      consistency: 'authoritative',
    });
  });

  it('refresh uses the explicit current query even if the recorded one is older', () => {
    service.searchItemsOnce('старый', 20, 'site-1', false).subscribe();
    getData.mockClear();

    service.refreshItemsAuthoritativeOnce('новый запрос', null).subscribe();

    expect(getData).toHaveBeenCalledWith('/catalog/search/items', {
      q: 'новый запрос',
      limit: 20,
      consistency: 'authoritative',
    });
  });

  it('does nothing (no HTTP call) when there is no query to refresh', () => {
    let result: CatalogSearchItem[] | undefined;
    service.refreshItemsAuthoritativeOnce().subscribe(items => (result = items));

    expect(result).toEqual([]);
    expect(getData).not.toHaveBeenCalled();
  });

  it('deduplicates candidates by stable ID and keeps same-name/different-ID items', () => {
    getData.mockReturnValue(of({
      results: [
        makeItem({ id: 'id-1', name: 'Одинаковое имя' }),
        makeItem({ id: 'id-2', name: 'Одинаковое имя' }),
        makeItem({ id: 'id-1', name: 'Одинаковое имя' }),
      ],
    }));

    let items: CatalogSearchItem[] = [];
    service.searchItemsOnce('имя').subscribe(r => (items = r));

    expect(items.map(i => i.id)).toEqual(['id-1', 'id-2']);
  });

  it('keeps include_balance=false on the authoritative refresh (no implicit balances)', () => {
    service.searchItemsOnce('кабель', 20, 'site-7', false).subscribe();
    getData.mockClear();

    service.refreshItemsAuthoritativeOnce().subscribe();

    const [, params] = getData.mock.calls[0];
    expect(params).not.toHaveProperty('include_balance');
  });
});
