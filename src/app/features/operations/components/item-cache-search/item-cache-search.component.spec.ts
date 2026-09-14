import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ItemCacheSearchComponent } from './item-cache-search.component';
import {
  CatalogSearchService,
  CatalogSearchItem,
} from '../../../../core/services/catalog-search.service';

function makeSearchItem(overrides: Partial<CatalogSearchItem> = {}): CatalogSearchItem {
  return {
    id: 'item-1',
    name: 'Кабель ВВГ 3x1.5',
    sku: 'CAB-001',
    category_id: 'cat-1',
    category_name: 'Кабельная продукция',
    unit_id: 'unit-1',
    unit_name: 'м',
    unit_symbol: 'м',
    is_active: true,
    requires_review: false,
    source: 'cache',
    ...overrides,
  };
}

/**
 * Real-timer wait: the component pipes searchQuery$ through debounceTime(150)
 * with the rxjs async scheduler. zone.js is not installed in this project
 * (zoneless Angular), so fakeAsync/tick from '@angular/core/testing' is not
 * available — a real setTimeout is the reliable equivalent here.
 */
function waitForDebounce(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ItemCacheSearchComponent', () => {
  let searchItemsOnce: ReturnType<typeof vi.fn>;
  let refreshItemsAuthoritativeOnce: ReturnType<typeof vi.fn>;
  let isSearchingItems: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // source_site_qty present in the payload on purpose: the component must
    // ignore it in the UI (TZ §6.1 block B).
    searchItemsOnce = vi.fn(() => of([makeSearchItem({ source_site_qty: '5' })]));
    refreshItemsAuthoritativeOnce = vi.fn(() => of([makeSearchItem({ source_site_qty: '5' })]));
    isSearchingItems = vi.fn(() => false);

    await TestBed.configureTestingModule({
      imports: [ItemCacheSearchComponent],
      providers: [
        {
          provide: CatalogSearchService,
          useValue: { searchItemsOnce, refreshItemsAuthoritativeOnce, isSearchingItems },
        },
      ],
    }).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(ItemCacheSearchComponent);
    fixture.componentRef.setInput('sourceSiteId', 'site-1');
    fixture.detectChanges();
    return fixture;
  }

  it('does not render the .option-stock span even when source_site_qty is present in the payload', async () => {
    const fixture = create();

    fixture.componentInstance.onSearchChange('кабель');
    await waitForDebounce();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.option-stock')).toBeNull();

    // Results are still visible, just without the stock line.
    const options = fixture.nativeElement.querySelectorAll('.search-option');
    expect(options.length).toBe(1);
    const optionText = (options[0] as HTMLElement).textContent ?? '';
    expect(optionText).toContain('Кабель ВВГ 3x1.5');
    expect(optionText).not.toContain('на складе');
  });

  it('calls searchItemsOnce with includeBalance=false', async () => {
    const fixture = create();

    fixture.componentInstance.onSearchChange('кабель');
    await waitForDebounce();

    expect(searchItemsOnce).toHaveBeenCalledTimes(1);
    expect(searchItemsOnce).toHaveBeenCalledWith('кабель', 20, 'site-1', false, undefined);
  });

  it('keeps source_site_qty in the data payload while the UI ignores it', async () => {
    const fixture = create();

    fixture.componentInstance.onSearchChange('кабель');
    await waitForDebounce();
    fixture.detectChanges();

    // The field still travels through the component's data model...
    const displayed = fixture.componentInstance.displayItems();
    expect(displayed.length).toBe(1);
    expect(displayed[0].source_site_qty).toBe('5');

    // ...but the template never renders it.
    expect(fixture.nativeElement.querySelector('.option-stock')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('на складе');
  });
});

describe('ItemCacheSearchComponent — Stage 3a authoritative refresh', () => {
  let searchItemsOnce: ReturnType<typeof vi.fn>;
  let refreshItemsAuthoritativeOnce: ReturnType<typeof vi.fn>;
  let isSearchingItems: ReturnType<typeof vi.fn>;

  const itemA = makeSearchItem({ id: 'id-a', name: 'Кабель А', source: 'cache' });
  const itemB = makeSearchItem({ id: 'id-b', name: 'Кабель Б', source: 'cache' });

  beforeEach(async () => {
    searchItemsOnce = vi.fn(() => of([itemA, itemB]));
    refreshItemsAuthoritativeOnce = vi.fn(() => of([itemB]));
    isSearchingItems = vi.fn(() => false);

    await TestBed.configureTestingModule({
      imports: [ItemCacheSearchComponent],
      providers: [
        {
          provide: CatalogSearchService,
          useValue: { searchItemsOnce, refreshItemsAuthoritativeOnce, isSearchingItems },
        },
      ],
    }).compileComponents();
  });

  async function createWithQuery(query = 'кабель') {
    const fixture = TestBed.createComponent(ItemCacheSearchComponent);
    fixture.componentRef.setInput('sourceSiteId', 'site-1');
    fixture.detectChanges();
    fixture.componentInstance.onSearchChange(query);
    await waitForDebounce();
    fixture.detectChanges();
    return fixture;
  }

  it('refresh issues a real authoritative request for the actual current query/site', async () => {
    const fixture = await createWithQuery('кабель');

    const requested: Array<unknown[]> = [];
    fixture.componentInstance.refreshRequested.subscribe(() => requested.push([]));

    fixture.componentInstance.onRefreshCheck();

    expect(refreshItemsAuthoritativeOnce).toHaveBeenCalledTimes(1);
    expect(refreshItemsAuthoritativeOnce).toHaveBeenCalledWith('кабель', 'site-1');
  });

  it('fully replaces the candidate set — a candidate missing from the authoritative response disappears', async () => {
    const fixture = await createWithQuery('кабель');
    expect(fixture.componentInstance.displayItems().map(i => i.id)).toEqual(['id-a', 'id-b']);

    fixture.componentInstance.onRefreshCheck();
    fixture.detectChanges();

    // itemA is gone: no old+new merge.
    expect(fixture.componentInstance.displayItems().map(i => i.id)).toEqual(['id-b']);
    expect(fixture.componentInstance.localResults().map(i => i.id)).toEqual(['id-b']);
  });

  it('keeps same-name candidates with different IDs as two distinct entries', async () => {
    searchItemsOnce = vi.fn(() => of([itemA]));
    refreshItemsAuthoritativeOnce = vi.fn(() => of([
      makeSearchItem({ id: 'id-1', name: 'Одинаковое имя' }),
      makeSearchItem({ id: 'id-2', name: 'Одинаковое имя' }),
    ]));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ItemCacheSearchComponent],
      providers: [
        {
          provide: CatalogSearchService,
          useValue: { searchItemsOnce, refreshItemsAuthoritativeOnce, isSearchingItems },
        },
      ],
    }).compileComponents();

    const fixture = await createWithQuery('имя');
    fixture.componentInstance.onRefreshCheck();
    fixture.detectChanges();

    const ids = fixture.componentInstance.displayItems().map(i => i.id);
    expect(ids).toEqual(['id-1', 'id-2']);
  });

  it('invalidates the candidate snapshot when the source site changes (query text survives, lines untouched)', async () => {
    const fixture = await createWithQuery('кабель');
    expect(fixture.componentInstance.localResults().length).toBe(2);

    fixture.componentRef.setInput('sourceSiteId', 'site-2');
    fixture.detectChanges();

    expect(fixture.componentInstance.localResults()).toEqual([]);
    expect(fixture.componentInstance.searchText()).toBe('кабель');
  });

  it('invalidates the candidate snapshot when the operation scope changes', async () => {
    const fixture = TestBed.createComponent(ItemCacheSearchComponent);
    fixture.componentRef.setInput('sourceSiteId', 'site-1');
    fixture.componentRef.setInput('scopeKey', 'MOVE|site-1|');
    fixture.detectChanges();
    fixture.componentInstance.onSearchChange('кабель');
    await waitForDebounce();
    expect(fixture.componentInstance.localResults().length).toBe(2);

    fixture.componentRef.setInput('scopeKey', 'ISSUE|site-1|');
    fixture.detectChanges();

    expect(fixture.componentInstance.localResults()).toEqual([]);
    expect(fixture.componentInstance.searchText()).toBe('кабель');
  });

  it('on refresh error keeps the old snapshot but marks it unverified (controlled message)', async () => {
    refreshItemsAuthoritativeOnce = vi.fn(() =>
      throwError(() => ({ error: { message: 'Сервер недоступен' } })),
    );
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ItemCacheSearchComponent],
      providers: [
        {
          provide: CatalogSearchService,
          useValue: { searchItemsOnce, refreshItemsAuthoritativeOnce, isSearchingItems },
        },
      ],
    }).compileComponents();

    const fixture = await createWithQuery('кабель');
    let refreshEvents = 0;
    fixture.componentInstance.refreshRequested.subscribe(() => refreshEvents++);

    fixture.componentInstance.onRefreshCheck();
    fixture.detectChanges();

    expect(fixture.componentInstance.refreshError()).toBe('Сервер недоступен');
    expect(fixture.componentInstance.localResults().length).toBe(2);
    // Part B still runs after a failed part A.
    expect(refreshEvents).toBe(1);
  });

  it('with a short query only part B runs (no authoritative candidate request)', async () => {
    const fixture = TestBed.createComponent(ItemCacheSearchComponent);
    fixture.componentRef.setInput('sourceSiteId', 'site-1');
    fixture.detectChanges();
    let refreshEvents = 0;
    fixture.componentInstance.refreshRequested.subscribe(() => refreshEvents++);

    fixture.componentInstance.onRefreshCheck();

    expect(refreshItemsAuthoritativeOnce).not.toHaveBeenCalled();
    expect(refreshEvents).toBe(1);
  });

  it('runs part B after the authoritative request settles and guards reentrancy', async () => {
    const refresh$ = new Subject<CatalogSearchItem[]>();
    refreshItemsAuthoritativeOnce = vi.fn(() => refresh$.asObservable());
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ItemCacheSearchComponent],
      providers: [
        {
          provide: CatalogSearchService,
          useValue: { searchItemsOnce, refreshItemsAuthoritativeOnce, isSearchingItems },
        },
      ],
    }).compileComponents();

    const fixture = await createWithQuery('кабель');
    let refreshEvents = 0;
    fixture.componentInstance.refreshRequested.subscribe(() => refreshEvents++);

    fixture.componentInstance.onRefreshCheck();
    // Reentrancy: the second click while the request is in flight is ignored.
    fixture.componentInstance.onRefreshCheck();
    expect(refreshItemsAuthoritativeOnce).toHaveBeenCalledTimes(1);
    expect(refreshEvents).toBe(0);

    refresh$.next([itemB]);
    refresh$.complete();
    fixture.detectChanges();

    expect(refreshEvents).toBe(1);
    expect(fixture.componentInstance.localResults().map(i => i.id)).toEqual(['id-b']);
  });
});
