import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OperationsFilterVm,
  OperationType,
  SiteDto,
  OPERATION_TYPE_LABELS,
} from '../../../../core/models/operations.models';

@Component({
  selector: 'app-operations-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group search">
          <input
            type="text"
            class="wh-form-input input"
            placeholder="Поиск: номер, участок, создатель, ТМЦ, SKU, #хештег..."
            [ngModel]="filters().search"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>

        <div class="filter-group">
          <select
            class="wh-form-input input"
            [ngModel]="filters().type"
            (ngModelChange)="onTypeChange($event)"
          >
            <option [ngValue]="null">Все типы</option>
            @for (t of types; track t.key) {
              <option [value]="t.key">{{ t.label }}</option>
            }
          </select>
        </div>

        <div class="filter-group">
          <select
            class="wh-form-input input"
            [ngModel]="filters().siteId"
            (ngModelChange)="onSiteChange($event)"
          >
            <option [ngValue]="null">Все участки</option>
            @for (site of sites(); track site.id) {
              <option [value]="site.id">{{ site.name }}</option>
            }
          </select>
        </div>

        <div class="filter-group date-range">
          <input
            type="date"
            class="wh-form-input input"
            [ngModel]="filters().createdAfter"
            (ngModelChange)="onDateAfterChange($event)"
          />
          <span class="date-sep">—</span>
          <input
            type="date"
            class="wh-form-input input"
            [ngModel]="filters().createdBefore"
            (ngModelChange)="onDateBeforeChange($event)"
          />
        </div>

        <div class="filter-group checkbox">
          <label class="checkbox-label">
            <input
              type="checkbox"
              [ngModel]="filters().onlyMine"
              (ngModelChange)="onOnlyMineChange($event)"
            />
            Только мои
          </label>
        </div>

        <button class="wh-btn wh-btn--secondary btn btn-reset" (click)="onReset()">Сбросить</button>
      </div>
    </div>
  `,
  styles: [`
    .filter-panel { display: flex; flex-direction: column; }
    .filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

    .filter-group { display: flex; align-items: center; gap: 6px; }
    .filter-group.search { flex: 1; min-width: 180px; }
    .filter-group.date-range { display: flex; align-items: center; gap: 4px; }
    .filter-group.checkbox { margin-right: auto; }

    .input {
      height: 32px;
      padding: 0 8px;
      font-size: 13px;
    }

    .date-sep { color: #94A3B8; font-size: 12px; }

    .checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      white-space: nowrap;
    }
    .checkbox-label input { cursor: pointer; width: 14px; height: 14px; }

    .btn-reset {
      height: 32px;
      padding: 0 10px;
      font-size: 12px;
    }
  `]
})
export class OperationsFilterPanelComponent {
  filters = input.required<OperationsFilterVm>();
  sites = input<SiteDto[]>([]);
  filtersChange = output<Partial<OperationsFilterVm>>();
  reset = output<void>();

  readonly types = (Object.entries(OPERATION_TYPE_LABELS) as [OperationType, string][])
    .map(([key, label]) => ({ key, label }));

  onSearchChange(value: string): void {
    this.filtersChange.emit({ search: value });
  }

  onTypeChange(value: string | null): void {
    this.filtersChange.emit({ type: value as OperationType | null });
  }

  onSiteChange(value: string | null): void {
    this.filtersChange.emit({ siteId: value });
  }

  onDateAfterChange(value: string | null): void {
    this.filtersChange.emit({ createdAfter: value });
  }

  onDateBeforeChange(value: string | null): void {
    this.filtersChange.emit({ createdBefore: value });
  }

  onOnlyMineChange(value: boolean): void {
    this.filtersChange.emit({ onlyMine: value });
  }

  onReset(): void {
    this.reset.emit();
  }
}
