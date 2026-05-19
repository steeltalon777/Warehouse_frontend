import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';

@Component({
  selector: 'app-temp-item-merge-temp-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Слить с другой временной ТМЦ</h2>
          <button class="modal-close" (click)="cancel.emit()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="not-available-box">
            <div class="na-icon">⏳</div>
            <h3>Функция временно недоступна</h3>
            <p>Слияние временных ТМЦ между собой будет доступно в следующем обновлении.</p>
            <p>Требуется новый endpoint SyncServer для объединения временных остатков.</p>
            <p class="na-hint">Рекомендуется сначала попробовать слияние с постоянной ТМЦ.</p>
          </div>

          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="cancel.emit()">Закрыть</button>
          </div>
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
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; text-align: center; }
    .not-available-box { padding: 20px; }
    .na-icon { font-size: 48px; margin-bottom: 12px; }
    .not-available-box h3 { font-size: 16px; color: #1E293B; margin: 0 0 8px; }
    .not-available-box p { font-size: 13px; color: #64748B; margin: 4px 0; }
    .na-hint { font-size: 12px; color: #94A3B8; margin-top: 12px !important; }
    .modal-actions { display: flex; justify-content: center; margin-top: 16px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover { background: #F8FAFC; }
  `]
})
export class TempItemMergeTempFormComponent {
  readonly item = input.required<TemporaryItemVm>();
  readonly submit = output<TemporaryItemVm>();
  readonly cancel = output<void>();
}
