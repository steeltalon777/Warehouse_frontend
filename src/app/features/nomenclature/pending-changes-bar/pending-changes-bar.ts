import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-pending-changes-bar',
  standalone: true,
  template: `
    <div class="pending-bar">
      <div class="pending-info">
        <span class="pending-count">Изменений: {{ count() }}</span>
      </div>
      <div class="pending-actions">
        <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="reset.emit()" [disabled]="count() === 0">
          Сбросить
        </button>
        <button class="wh-btn wh-btn--primary btn btn-primary" (click)="apply.emit()" [disabled]="count() === 0 || isSaving()">
          Применить
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pending-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 14px;
      margin-top: auto;
      flex-shrink: 0;
    }
    .pending-count {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
    }
    .pending-actions {
      display: flex;
      gap: 8px;
    }
  `]
})
export class PendingChangesBarComponent {
  readonly count = input<number>(0);
  readonly isSaving = input<boolean>(false);
  readonly reset = output<void>();
  readonly apply = output<void>();
}
