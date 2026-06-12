import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="wh-page-header page-header">
      <div class="header-left">
        <h1 class="header-title">{{ title() }}</h1>
        <p class="header-subtitle">{{ subtitle() }}</p>
      </div>
      <div class="header-right">
        @if (canWrite()) {
          <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="export.emit()" title="Экспорт (в разработке)">
            Экспорт
          </button>
          <button
            class="wh-btn wh-btn--primary btn btn-primary"
            [disabled]="applyDisabled()"
            (click)="applyAll.emit()"
          >
            Применить все
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
     .page-header {
       padding: 12px 20px;
       display: flex;
       align-items: center;
       justify-content: space-between;
       gap: 12px;
       min-height: 64px;
     }
    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .header-title {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      margin: 0;
      line-height: 1.2;
    }
    .header-subtitle {
      font-size: 14px;
      color: #6B7280;
      margin: 0;
      line-height: 1.4;
    }
    .header-right {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
     @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: flex-start; }
      .header-right { width: 100%; justify-content: flex-end; }
    }
  `]
})
export class PageHeaderComponent {
  readonly canWrite = input<boolean>(true);
  readonly title = input<string>('Номенклатура');
  readonly subtitle = input<string>('Категории, ТМЦ, SKU, единицы измерения и ключевые слова. Изменения копятся локально и применяются батчем.');
  readonly applyDisabled = input<boolean>(true);
  readonly export = output<void>();
  readonly applyAll = output<void>();
}
