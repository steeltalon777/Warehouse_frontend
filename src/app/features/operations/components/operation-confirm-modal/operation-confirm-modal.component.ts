import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  OperationListRowVm,
  OPERATION_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
} from '../../../../core/models/operations.models';

@Component({
  selector: 'app-operation-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wh-modal-overlay modal-overlay" data-testid="operation-confirm-modal" (click)="onOverlayClick($event)">
      <div class="wh-modal modal-container">
        <div class="wh-modal__header modal-header">
          <h2>Подтверждение операции</h2>
          <button class="wh-btn-icon btn-close" aria-label="Закрыть" (click)="cancel.emit()">×</button>
        </div>

        <div class="wh-modal__body modal-body">
          <div class="warning-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <strong>Внимание</strong>
              <p>Подтверждение операции не является приёмкой. После подтверждения операцию нельзя будет отредактировать.</p>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-row">
              <span class="label">Тип:</span>
              <span class="wh-badge badge type-badge wh-badge--type-{{ op.type.toLowerCase() }}">
                {{ op.typeLabel }}
              </span>
            </div>
            <div class="summary-row">
              <span class="label">Статус:</span>
              <span class="wh-badge badge status-badge wh-badge--status-{{ op.status }}">
                {{ op.statusLabel }}
              </span>
            </div>
            <div class="summary-row">
              <span class="label">Направление:</span>
              <span>{{ op.directionLabel }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Позиций:</span>
              <span>{{ op.linesCount }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Автор:</span>
              <span>{{ op.createdByLabel }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Создана:</span>
              <span>{{ op.createdAt | date:'dd.MM.yyyy HH:mm' }}</span>
            </div>
          </div>
        </div>

        <div class="wh-modal__footer modal-footer">
          <button class="wh-btn wh-btn--secondary btn btn-secondary" data-testid="operation-confirm-cancel-button" (click)="cancel.emit()">Отмена</button>
          <button class="wh-btn wh-btn--success btn btn-submit" data-testid="operation-confirm-submit-button" [disabled]="isSubmitting()" (click)="confirm.emit()">Подтвердить</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    .modal-container {
      background: #FFFFFF;
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #E2E8F0;
    }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }
    .btn-close {
      width: 32px; height: 32px;
      border: none; background: transparent;
      font-size: 22px; color: #94A3B8;
      cursor: pointer; border-radius: 6px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .btn-close:hover { background: #F1F5F9; color: #374151; }

    .modal-body { flex: 1; overflow: auto; padding: 16px 20px; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid #E2E8F0;
    }

    .warning-banner {
      display: flex;
      gap: 12px;
      padding: 12px 14px;
      background: #FEF9C3;
      border: 1px solid #FDE68A;
      border-radius: 8px;
      color: #854D0E;
      margin-bottom: 16px;
    }
    .warning-banner strong { display: block; font-size: 14px; margin-bottom: 2px; }
    .warning-banner p { margin: 0; font-size: 13px; }

    .summary-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .summary-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
    }
    .summary-row .label {
      width: 100px;
      flex-shrink: 0;
      color: #64748B;
      font-size: 13px;
    }
    .summary-row span:last-child { color: #1F2937; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
    }

    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px; height: 36px; padding: 0 14px;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
      border: 1px solid transparent; font-family: inherit;
    }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover { background: #F8FAFC; }
    .btn-submit { background: #059669; color: #FFFFFF; border-color: #059669; }
    .btn-submit:hover { background: #047857; }
  `]
})
export class OperationConfirmModalComponent {
  operation = input.required<OperationListRowVm | null>();
  isSubmitting = input<boolean>(false);
  confirm = output<void>();
  cancel = output<void>();

  get op(): OperationListRowVm {
    return this.operation()!;
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }
}
