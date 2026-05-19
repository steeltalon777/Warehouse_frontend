import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="search-wrapper">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M11.5 11.5L15 15M13 7C13 10.3137 10.3137 13 7 13C3.68629 13 1 10.3137 1 7C1 3.68629 3.68629 1 7 1C10.3137 1 13 3.68629 13 7Z" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder="Название, SKU, ключевые слова"
          [ngModel]="value()"
          (ngModelChange)="valueChange.emit($event)"
        />
        @if (value()) {
          <button class="search-clear" (click)="valueChange.emit('')" title="Очистить">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M13 1L1 13M1 1L13 13" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .search-wrapper { margin-bottom: 12px; }
    .search-box {
      position: relative;
      width: 100%;
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
      height: 40px;
      padding: 0 36px 0 36px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-size: 13px;
      color: #111827;
      background: #FFFFFF;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
      font-family: inherit;
    }
    .search-input:focus {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .search-input::placeholder { color: #9CA3AF; }
    .search-clear {
      position: absolute;
      right: 10px;
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
    .search-clear:hover { background: #F3F4F6; }
  `]
})
export class SearchInputComponent {
  readonly value = input<string>('');
  readonly valueChange = output<string>();
}
