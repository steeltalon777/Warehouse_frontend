import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';

@Component({
  selector: 'app-temp-item-delete-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Удалить временную ТМЦ</h2>
          <button class="modal-close" (click)="cancel.emit()">&times;</button>
        </div>

        <div class="modal-body">
          @if (isSubmitting()) {
            <div class="loading">Удаление...</div>
          } @else if (error()) {
            <div class="error-banner">{{ error() }}</div>
          } @else {
            @if (item().canDelete) {
              <div class="confirm-text">
                <p>Вы уверены, что хотите удалить «<strong>{{ item().name }}</strong>»?</p>
              </div>
            } @else {
              <div class="blocked-box">
                <span class="blocked-icon">⛔</span>
                <p>{{ item().deleteBlockedReason || 'Удаление невозможно' }}</p>
              </div>
            }

            <div class="info-box">
              <div class="info-row"><span>Остаток:</span><span class="info-value">{{ item().totalBalance }} {{ item().unitSymbol }}</span></div>
              <div class="info-row"><span>Операций:</span><span class="info-value">{{ item().operationsCount }}</span></div>
              <div class="info-row"><span>Статус:</span><span class="info-value">{{ item().uiStatusLabel }}</span></div>
            </div>

            <div class="modal-actions">
              @if (item().canDelete) {
                <button class="btn btn-danger" (click)="onSubmit()">Удалить</button>
              }
              <button class="btn btn-secondary" (click)="cancel.emit()">Отмена</button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1100; }
    .modal-container { background: #FFFFFF; border-radius: 12px; width: 480px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #E2E8F0; flex-shrink: 0; }
    .modal-title { margin: 0; font-size: 16px; font-weight: 600; color: #0F172A; }
    .modal-close { background: none; border: none; font-size: 24px; color: #94A3B8; cursor: pointer; padding: 0; line-height: 1; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .loading, .error-banner { text-align: center; padding: 40px; font-size: 14px; }
    .error-banner { color: #DC2626; }
    .confirm-text { font-size: 14px; color: #1E293B; margin-bottom: 16px; text-align: center; }
    .blocked-box { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; margin-bottom: 16px; text-align: center; font-size: 13px; color: #991B1B; }
    .blocked-icon { font-size: 32px; }
    .info-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #475569; }
    .info-value { font-weight: 600; color: #1E293B; }
    .modal-actions { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: all 0.15s; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-danger { background: #DC2626; color: #FFFFFF; border-color: #DC2626; }
    .btn-danger:hover:not(:disabled) { background: #B91C1C; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
  `]
})
export class TempItemDeleteFormComponent {
  private readonly service = inject(TempItemsService);

  readonly item = input.required<TemporaryItemVm>();
  readonly submit = output<TemporaryItemVm>();
  readonly cancel = output<void>();

  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    this.isSubmitting.set(true);
    this.error.set(null);

    const success = await this.service.deleteItem(this.item().id);
    if (success) {
      this.submit.emit(this.item());
    } else {
      this.error.set('Ошибка при удалении. Попробуйте ещё раз.');
      this.isSubmitting.set(false);
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancel.emit();
    }
  }
}
