import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-action-buttons',
  standalone: true,
  template: `
    <div class="action-row">
      @if (mode() === 'catalog') {
        <button class="wh-btn wh-btn--primary btn btn-primary" (click)="createCategory.emit()">
          + Категория
        </button>
        <button class="wh-btn wh-btn--primary btn btn-primary" (click)="createItem.emit()">
          + ТМЦ
        </button>
        <button class="wh-btn wh-btn--ghost btn btn-ghost" (click)="expandAll.emit()">
          Раскрыть всё
        </button>
        <button class="wh-btn wh-btn--ghost btn btn-ghost" (click)="collapseAll.emit()">
          Свернуть всё
        </button>
      } @else {
        <button class="wh-btn wh-btn--primary btn btn-primary" (click)="createUnit.emit()">
          + Ед. изм.
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .action-row {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
  `]
})
export class ActionButtonsComponent {
  readonly mode = input<'catalog' | 'units'>('catalog');
  readonly createCategory = output<void>();
  readonly createItem = output<void>();
  readonly createUnit = output<void>();
  readonly expandAll = output<void>();
  readonly collapseAll = output<void>();
}
