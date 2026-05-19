import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TempItemUiStatus, TEMP_ITEM_UI_STATUS_LABELS } from '../../../core/models/temp-items.models';

export interface TempItemsFilterValues {
  search: string;
  uiStatus: TempItemUiStatus | null;
  hasBalance: boolean | null;
  hasPendingAcceptance: boolean | null;
  createdAfter: string;
  createdBefore: string;
  createdByUserId: string;
}

@Component({
  selector: 'app-temp-items-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group search">
          <input
            type="text"
            class="wh-form-input input"
            placeholder="Поиск: название, SKU, создатель..."
            [ngModel]="filters().search"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>

        <div class="filter-group">
          <select class="wh-form-input input" [ngModel]="filters().uiStatus" (ngModelChange)="onFilterChange('uiStatus', $event)">
            <option [ngValue]="null">Все статусы</option>
            @for (s of uiStatusOptions; track s.key) {
              <option [value]="s.key">{{ s.label }}</option>
            }
          </select>
        </div>

        <div class="filter-group">
          <select class="wh-form-input input" [ngModel]="filters().hasBalance" (ngModelChange)="onFilterChange('hasBalance', $event)">
            <option [ngValue]="null">Любой остаток</option>
            <option [ngValue]="true">Есть остаток</option>
            <option [ngValue]="false">Нет остатка</option>
          </select>
        </div>

        <div class="filter-group">
          <select class="wh-form-input input" [ngModel]="filters().hasPendingAcceptance" (ngModelChange)="onFilterChange('hasPendingAcceptance', $event)">
            <option [ngValue]="null">Любая приёмка</option>
            <option [ngValue]="true">Есть незавершённая</option>
            <option [ngValue]="false">Нет незавершённой</option>
          </select>
        </div>
      </div>

      <div class="filter-row second">
        <div class="filter-group date-range">
          <span class="filter-label">Создано:</span>
          <input type="date" class="wh-form-input input" [ngModel]="filters().createdAfter" (ngModelChange)="onFilterChange('createdAfter', $event)" />
          <span class="date-sep">—</span>
          <input type="date" class="wh-form-input input" [ngModel]="filters().createdBefore" (ngModelChange)="onFilterChange('createdBefore', $event)" />
        </div>

        <div class="filter-group">
          <input
            type="text"
            class="wh-form-input input"
            placeholder="Создатель ID"
            [ngModel]="filters().createdByUserId"
            (ngModelChange)="onFilterChange('createdByUserId', $event)"
          />
        </div>

        <button class="wh-btn wh-btn--secondary btn btn-reset" (click)="onReset()">Сбросить</button>
      </div>
    </div>
  `,
  styles: [`
    .filter-panel { display: flex; flex-direction: column; gap: 8px; }
    .filter-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .filter-row.second { margin-top: 4px; }
    .filter-group { display: flex; align-items: center; gap: 8px; }
    .filter-group.search { flex: 1; min-width: 200px; }
    .filter-group.date-range { display: flex; align-items: center; gap: 6px; }
    .filter-label { font-size: 13px; color: #64748B; white-space: nowrap; }
    .date-sep { color: #94A3B8; font-size: 13px; }
    .input {
      height: 32px;
      padding: 0 10px;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      background: #FFFFFF;
      color: #1F2937;
    }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .btn-reset { flex-shrink: 0; }
  `]
})
export class TempItemsFiltersComponent {
  readonly filters = input.required<TempItemsFilterValues>();
  readonly filtersChange = output<Partial<TempItemsFilterValues>>();
  readonly reset = output<void>();

  readonly uiStatusOptions = (Object.entries(TEMP_ITEM_UI_STATUS_LABELS) as [TempItemUiStatus, string][]).map(([key, label]) => ({ key, label }));

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  onSearchChange(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.filtersChange.emit({ search: value });
    }, 300);
  }

  onFilterChange<K extends keyof TempItemsFilterValues>(key: K, value: TempItemsFilterValues[K]): void {
    this.filtersChange.emit({ [key]: value } as Partial<TempItemsFilterValues>);
  }

  onReset(): void {
    this.reset.emit();
  }
}
