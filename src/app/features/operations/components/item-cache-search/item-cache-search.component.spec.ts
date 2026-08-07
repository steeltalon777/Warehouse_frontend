import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
  let isSearchingItems: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // source_site_qty present in the payload on purpose: the component must
    // ignore it in the UI (TZ §6.1 block B).
    searchItemsOnce = vi.fn(() => of([makeSearchItem({ source_site_qty: '5' })]));
    isSearchingItems = vi.fn(() => false);

    await TestBed.configureTestingModule({
      imports: [ItemCacheSearchComponent],
      providers: [
        {
          provide: CatalogSearchService,
          useValue: { searchItemsOnce, isSearchingItems },
        },
      ],
    }).compileComponents();
  });

  it('does not render the .option-stock span even when source_site_qty is present in the payload', async () => {
    const fixture = TestBed.createComponent(ItemCacheSearchComponent);
    fixture.componentRef.setInput('sourceSiteId', 'site-1');
    fixture.detectChanges();

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
    const fixture = TestBed.createComponent(ItemCacheSearchComponent);
    fixture.componentRef.setInput('sourceSiteId', 'site-1');
    fixture.detectChanges();

    fixture.componentInstance.onSearchChange('кабель');
    await waitForDebounce();

    expect(searchItemsOnce).toHaveBeenCalledTimes(1);
    expect(searchItemsOnce).toHaveBeenCalledWith('кабель', 20, 'site-1', false);
  });

  it('keeps source_site_qty in the data payload while the UI ignores it', async () => {
    const fixture = TestBed.createComponent(ItemCacheSearchComponent);
    fixture.componentRef.setInput('sourceSiteId', 'site-1');
    fixture.detectChanges();

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
