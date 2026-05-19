import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-action-buttons',
  standalone: true,
  template: `
    <div class="action-row">
      <button class="wh-btn wh-btn--primary btn btn-primary" disabled title="Создание категории — в разработке">
        + Категория
      </button>
      <button class="wh-btn wh-btn--primary btn btn-primary" disabled title="Создание ТМЦ — в разработке">
        + ТМЦ
      </button>
      <button class="wh-btn wh-btn--ghost btn btn-ghost" (click)="expandAll.emit()">
        Раскрыть всё
      </button>
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
  readonly expandAll = output<void>();
}
