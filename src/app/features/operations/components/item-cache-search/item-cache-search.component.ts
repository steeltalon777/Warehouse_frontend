import { Component, input, output, signal, computed, effect, ViewChild, ElementRef, HostListener, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, catchError } from 'rxjs/operators';
import { CatalogSearchService, CatalogSearchItem } from '../../../../core/services/catalog-search.service';
import { Item } from '../../../../core/models/nomenclature.models';

/**
 * Adapter to convert CatalogSearchItem to Item for compatibility
 */
function toItem(searchItem: CatalogSearchItem): Item {
  return {
    id: searchItem.id,
    name: searchItem.name,
    sku: searchItem.sku,
    category_id: searchItem.category_id,
    category_name: searchItem.category_name,
    unit_id: searchItem.unit_id,
    unit_symbol: searchItem.unit_symbol || searchItem.unit_name || '',
    is_active: searchItem.is_active,
    hashtags: searchItem.hashtags ?? [],
    source_site_qty: searchItem.source_site_qty,
  };
}

@Component({
  selector: 'app-item-cache-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="item-search-wrapper" #wrapper>
      <input
        #inputEl
        type="text"
        class="wh-form-input input item-input"
        [placeholder]="placeholder()"
        [ngModel]="searchText()"
        (ngModelChange)="onSearchChange($event)"
        (focus)="onFocus()"
        (keydown)="onKeydown($event)"
        autocomplete="off"
      />
      @if (searchText() && !selectedItem()) {
        <div class="search-dropdown">
          @if (isLoading() || isSearching()) {
            <div class="search-loading">Поиск...</div>
          } @else if (displayItems().length > 0) {
            @for (item of displayItems(); track item.id; let idx = $index) {
              <div
                class="search-option"
                [class.highlighted]="idx === highlightedIndex()"
                (mousedown)="$event.preventDefault()"
                (click)="selectItem(item, $event)"
              >
                <span class="option-name">{{ item.name }}</span>
                @if (item.category_name) {
                  <span class="option-category">{{ item.category_name }}</span>
                }
                @if (item.sku) {
                  <span class="option-sku">{{ item.sku }}</span>
                }
                @if (item.source_site_qty) {
                  <span class="option-stock">на складе: {{ item.source_site_qty }}</span>
                }
              </div>
            }
          } @else {
            <div class="search-empty">Ничего не найдено</div>
          }
        </div>
      }
      @if (selectedItem(); as sel) {
        <span class="selected-badge">
          {{ sel.name }}
          <button class="wh-btn-icon badge-clear" (click)="clearSelection()">×</button>
        </span>
      }
    </div>
  `,
  styles: [`
    .item-search-wrapper {
      position: relative;
    }
    .item-input {
      width: 100%;
      height: 36px;
      padding: 0 10px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      background: #FFFFFF;
      color: #1F2937;
      box-sizing: border-box;
    }
    .item-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .search-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 100;
      background: #FFFFFF;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      max-height: 240px;
      overflow-y: auto;
      margin-top: 4px;
    }
    .search-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.1s;
    }
    .search-option:hover,
    .search-option.highlighted {
      background: #F1F5F9;
    }
    .option-name { color: #1F2937; font-weight: 500; flex-shrink: 0; }
    .option-category { color: #6B7280; font-size: 11px; margin: 0 8px; flex-shrink: 0; }
    .option-sku { color: #94A3B8; font-size: 11px; flex-shrink: 0; }
    .option-stock { color: #059669; font-size: 11px; font-weight: 500; flex-shrink: 0; }
    .search-loading, .search-empty {
      padding: 12px;
      text-align: center;
      color: #94A3B8;
      font-size: 13px;
    }
    .selected-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      padding: 2px 8px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 6px;
      font-size: 12px;
      color: #1E40AF;
    }
    .badge-clear {
      border: none;
      background: transparent;
      color: #60A5FA;
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      line-height: 1;
    }
    .badge-clear:hover { color: #1E40AF; }
  `]
})
export class ItemCacheSearchComponent implements OnDestroy {
  placeholder = input<string>('Начните вводить название...');
  itemName = input<string>('');
  sourceSiteId = input<string | null>(null);

  itemSelected = output<Item>();
  cleared = output<void>();

  private readonly catalogSearch = inject(CatalogSearchService);
  private readonly searchQuery$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly searchText = signal<string>('');
  readonly selectedItem = signal<Item | null>(null);
  readonly highlightedIndex = signal<number>(-1);
  readonly isFocused = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly localResults = signal<CatalogSearchItem[]>([]);

  readonly isSearching = computed(() => this.catalogSearch.isSearchingItems());

  @ViewChild('inputEl') inputEl!: ElementRef<HTMLInputElement>;
  @ViewChild('wrapper') wrapperEl!: ElementRef<HTMLElement>;

  constructor() {
    effect(() => {
      const name = this.itemName();
      if (name && !this.selectedItem()) {
        this.searchText.set(name);
      }
    });

    // Set up debounced search
    this.searchQuery$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of([]);
        }
        this.isLoading.set(true);
        return this.catalogSearch.searchItemsOnce(query, 20, this.sourceSiteId() ?? undefined);
      }),
      catchError(err => {
        console.error('Search error:', err);
        return of([]);
      })
    ).subscribe(items => {
      this.isLoading.set(false);
      this.localResults.set(items);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Computed to display items from local search results
  readonly displayItems = computed(() => {
    const query = this.searchText().toLowerCase().trim();
    if (!query || query.length < 2) return [];
    return this.localResults()
      .slice(0, 20)
      .map(item => toItem(item));
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.wrapperEl && !this.wrapperEl.nativeElement.contains(event.target as Node)) {
      this.searchText.set('');
      this.highlightedIndex.set(-1);
    }
  }

  onSearchChange(value: string): void {
    this.searchText.set(value);
    this.highlightedIndex.set(-1);
    if (!value) {
      this.selectedItem.set(null);
      this.cleared.emit();
    } else if (value.length >= 2) {
      // Trigger search via the subject
      this.searchQuery$.next(value);
    }
  }

  onFocus(): void {
    this.isFocused.set(true);
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.displayItems();
    const idx = this.highlightedIndex();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex.set(Math.min(idx + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex.set(Math.max(idx - 1, 0));
    } else if (event.key === 'Enter' && idx >= 0 && idx < items.length) {
      event.preventDefault();
      this.selectItem(items[idx]);
    } else if (event.key === 'Escape') {
      this.searchText.set('');
      this.highlightedIndex.set(-1);
    }
  }

  selectItem(item: Item, event?: Event): void {
    event?.stopPropagation();
    this.highlightedIndex.set(-1);
    this.itemSelected.emit(item);
    this.selectedItem.set(null);
    this.searchText.set('');
    this.localResults.set([]);
  }

  clearSelection(): void {
    this.reset();
    this.inputEl.nativeElement.focus();
    this.cleared.emit();
  }

  reset(): void {
    this.selectedItem.set(null);
    this.searchText.set('');
    this.localResults.set([]);
    this.highlightedIndex.set(-1);
  }
}
