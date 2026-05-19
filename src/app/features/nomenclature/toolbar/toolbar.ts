import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-nomenclature-toolbar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="toolbar">
      <div class="toolbar-left">
        <h1 class="toolbar-title">Номенклатура</h1>
      </div>
      <div class="toolbar-center">
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 11.5L15 15M13 7C13 10.3137 10.3137 13 7 13C3.68629 13 1 10.3137 1 7C1 3.68629 3.68629 1 7 1C10.3137 1 13 3.68629 13 7Z" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="Поиск по названию, артикулу или тегу..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchChange.emit($event)"
          />
          @if (searchQuery()) {
            <button class="search-clear" (click)="searchChange.emit('')">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M13 1L1 13M1 1L13 13" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          }
        </div>
      </div>
      <div class="toolbar-right">
        <button class="btn btn-secondary" disabled title="Создать (будет в следующей фазе)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Создать</span>
        </button>
        <button class="btn btn-ghost" disabled title="SSR Fallback">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 3H13M1 7H13M1 11H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      min-height: 56px;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .toolbar-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    .toolbar-badge {
      font-size: 11px;
      font-weight: 500;
      color: #6366f1;
      background: #eef2ff;
      padding: 2px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .toolbar-center {
      flex: 1;
      display: flex;
      justify-content: center;
    }
    .search-box {
      position: relative;
      width: 100%;
      max-width: 480px;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
    }
    .search-input {
      width: 100%;
      height: 36px;
      padding: 0 36px 0 36px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 13px;
      color: #374151;
      background: #f9fafb;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }
    .search-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
      background: #ffffff;
    }
    .search-input::placeholder { color: #9ca3af; }
    .search-clear {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }
    .search-clear:hover { background: #f3f4f6; }
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 34px;
      padding: 0 14px;
      border: 1px solid transparent;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: #ffffff;
      border-color: #e5e7eb;
      color: #374151;
    }
    .btn-secondary:hover:not(:disabled) { background: #f9fafb; border-color: #d1d5db; }
    .btn-ghost {
      background: none;
      color: #6b7280;
      padding: 0 8px;
    }
    .btn-ghost:hover:not(:disabled) { background: #f3f4f6; color: #374151; }
  `]
})
export class NomenclatureToolbarComponent {
  readonly searchQuery = input<string>('');
  readonly searchChange = output<string>();
}
