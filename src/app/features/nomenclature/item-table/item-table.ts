import { Component, input, output } from '@angular/core';
import { Item } from '../../../core/models/nomenclature.models';

@Component({
  selector: 'app-item-table',
  standalone: true,
  imports: [],
  template: `
    <div class="table-panel">
      <div class="table-header">
        <h2 class="table-title">Товарно-материальные ценности</h2>
        <span class="table-count">{{ items().length }} позиций</span>
      </div>
      <div class="table-scroll">
        <table class="item-table">
          <thead>
            <tr>
              <th class="col-name">Наименование</th>
              <th class="col-sku">Артикул</th>
              <th class="col-category">Категория</th>
              <th class="col-unit">Ед.</th>
              <th class="col-status">Статус</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item.id) {
              <tr
                class="item-row"
                [class.selected]="selectedItemId() === item.id"
                (click)="selectItem.emit(item.id)"
              >
                <td class="col-name">
                  <span class="item-name">{{ item.name }}</span>
                  @if (item.hashtags.length) {
                    <div class="item-tags">
                      @for (tag of item.hashtags.slice(0, 3); track tag) {
                        <span class="tag">#{{ tag }}</span>
                      }
                      @if (item.hashtags.length > 3) {
                        <span class="tag-more">+{{ item.hashtags.length - 3 }}</span>
                      }
                    </div>
                  }
                </td>
                <td class="col-sku">
                  <code class="sku-value">{{ item.sku }}</code>
                </td>
                <td class="col-category">
                  <span class="category-value">{{ item.category_name }}</span>
                </td>
                <td class="col-unit">{{ item.unit_symbol }}</td>
                <td class="col-status">
                  @if (item.is_active) {
                    <span class="status-badge active">Активен</span>
                  } @else {
                    <span class="status-badge inactive">Неактивен</span>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="table-empty">
                  <div class="empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M20 7L12 12L4 7M12 21L12 12M4 7L12 12L20 7M4 7V17L12 22L20 17V7L12 2L4 7Z" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p class="empty-title">Нет ТМЦ</p>
                    <p class="empty-desc">Выберите категорию или измените параметры поиска</p>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .table-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
    }
    .table-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 8px;
      flex-shrink: 0;
    }
    .table-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table-count {
      font-size: 11px;
      color: #9ca3af;
    }
    .table-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 0 12px 16px;
    }
    .item-table {
      width: 100%;
      border-collapse: collapse;
    }
    .item-table thead th {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: left;
      padding: 8px 8px;
      border-bottom: 1px solid #f3f4f6;
      position: sticky;
      top: 0;
      background: #ffffff;
    }
    .item-row {
      cursor: pointer;
      transition: background 0.1s;
      border-bottom: 1px solid #f9fafb;
    }
    .item-row:hover { background: #f9fafb; }
    .item-row.selected { background: #eef2ff; }
    .item-row td {
      padding: 10px 8px;
      font-size: 13px;
      color: #374151;
      vertical-align: top;
    }
    .col-name { min-width: 200px; }
    .col-sku { width: 120px; }
    .col-category { width: 130px; }
    .col-unit { width: 50px; text-align: center; color: #6b7280; }
    .col-status { width: 90px; }
    .item-name {
      font-weight: 500;
      color: #111827;
      display: block;
      margin-bottom: 4px;
    }
    .item-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .tag {
      font-size: 11px;
      color: #6366f1;
      background: #eef2ff;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .tag-more {
      font-size: 11px;
      color: #9ca3af;
    }
    .sku-value {
      font-size: 12px;
      color: #6b7280;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, monospace;
    }
    .category-value { color: #6b7280; }
    .status-badge {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .status-badge.active { color: #059669; background: #ecfdf5; }
    .status-badge.inactive { color: #dc2626; background: #fef2f2; }
    .table-empty td { text-align: center; padding: 48px 16px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .empty-title { font-size: 14px; font-weight: 500; color: #6b7280; margin: 0; }
    .empty-desc { font-size: 12px; color: #9ca3af; margin: 0; }
  `]
})
export class ItemTableComponent {
  readonly items = input<Item[]>([]);
  readonly selectedItemId = input<string | null>(null);
  readonly selectItem = output<string>();
}
