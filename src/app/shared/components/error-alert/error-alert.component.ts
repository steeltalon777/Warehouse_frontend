import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (message()) {
      <div class="alert alert-error" [attr.data-testid]="testId()">
        <span class="alert-icon" aria-hidden="true">⚠️</span>
        <span class="alert-text">{{ message() }}</span>
        @if (dismissible()) {
          <button
            type="button"
            class="alert-close"
            aria-label="Закрыть"
            (click)="dismiss.emit()"
          >×</button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
    }
    .alert-error {
      background: #FEF2F2;
      color: #991B1B;
      border: 1px solid #FECACA;
    }
    .alert-icon {
      flex-shrink: 0;
      font-size: 16px;
      line-height: 1.3;
    }
    .alert-text {
      flex: 1 1 auto;
      min-width: 0;
    }
    .alert-close {
      flex-shrink: 0;
      appearance: none;
      background: transparent;
      border: none;
      color: inherit;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      padding: 0 2px;
      margin: -4px -4px -4px 0;
      opacity: 0.7;
    }
    .alert-close:hover { opacity: 1; }
  `]
})
export class ErrorAlertComponent {
  message = input.required<string>();
  dismissible = input<boolean>(true);
  testId = input<string | undefined>();
  dismiss = output<void>();
}
