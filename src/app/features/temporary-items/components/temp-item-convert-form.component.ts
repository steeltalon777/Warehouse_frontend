import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { TemporaryItemVm, TempItemApprovePayload } from '../../../core/models/temp-items.models';

@Component({
  selector: 'app-temp-item-convert-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Преобразовать в постоянную ТМЦ</h2>
          <button class="modal-close" (click)="cancel.emit()">&times;</button>
        </div>

        <div class="modal-body">
          @if (isSubmitting()) {
            <div class="loading">Преобразование...</div>
          } @else if (error()) {
            <div class="error-banner">{{ error() }}</div>
          } @else {
            <div class="form-group">
              <label class="form-label">Название *</label>
              <input class="form-input" type="text" [(ngModel)]="formName" required />
            </div>

            <div class="form-group">
              <label class="form-label">SKU</label>
              <input class="form-input" type="text" [(ngModel)]="formSku" placeholder="Необязательно" />
            </div>

            <div class="form-group">
              <label class="form-label">Категория *</label>
              <input class="form-input" type="text" [(ngModel)]="formCategory" placeholder="ID категории..." />
              <span class="form-hint">Введите ID категории. После преобразования вы сможете изменить категорию в справочнике номенклатуры.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Единица изм. *</label>
              <input class="form-input" type="text" [(ngModel)]="formUnit" placeholder="ID единицы..." />
              <span class="form-hint">Введите ID единицы измерения. После преобразования вы сможете изменить единицу в справочнике номенклатуры.</span>
            </div>

            <div class="form-group">
              <label class="form-label">Ключевые слова</label>
              <input class="form-input" type="text" [(ngModel)]="formHashtags" placeholder="#tag1 #tag2" />
            </div>

            <div class="form-group">
              <label class="form-label">Описание</label>
              <textarea class="form-input form-textarea" [(ngModel)]="formDescription" placeholder="Необязательно"></textarea>
            </div>

            <div class="preview-box">
              <p>Временный остаток: <strong>{{ item().totalBalance }} {{ item().unitSymbol }}</strong></p>
              <p>Будет создана постоянная ТМЦ</p>
              <p>Остаток будет перенесён на новую постоянную ТМЦ</p>
              <p class="preview-note">После преобразования вы сможете изменить категорию и единицу измерения в справочнике номенклатуры.</p>
            </div>

            <div class="modal-actions">
              <button class="btn btn-primary" [disabled]="!isFormValid()" (click)="onSubmit()">Создать постоянную и перенести остатки</button>
              <button class="btn btn-secondary" (click)="cancel.emit()">Отмена</button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1100; }
    .modal-container { background: #FFFFFF; border-radius: 12px; width: 520px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #E2E8F0; flex-shrink: 0; }
    .modal-title { margin: 0; font-size: 16px; font-weight: 600; color: #0F172A; }
    .modal-close { background: none; border: none; font-size: 24px; color: #94A3B8; cursor: pointer; padding: 0; line-height: 1; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .loading, .error-banner { text-align: center; padding: 40px; font-size: 14px; }
    .error-banner { color: #DC2626; }
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    .form-input { width: 100%; padding: 8px 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .form-textarea { min-height: 60px; resize: vertical; }
    .form-hint { display: block; font-size: 11px; color: #94A3B8; margin-top: 2px; }
    .preview-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; color: #166534; }
    .preview-box p { margin: 4px 0; }
    .preview-note { font-size: 11px; color: #6B7280; margin-top: 8px !important; }
    .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: all 0.15s; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
  `]
})
export class TempItemConvertFormComponent {
  private readonly service = inject(TempItemsService);

  readonly item = input.required<TemporaryItemVm>();
  readonly submit = output<TemporaryItemVm>();
  readonly cancel = output<void>();

  readonly formName = signal('');
  readonly formSku = signal('');
  readonly formCategory = signal('');
  readonly formUnit = signal('');
  readonly formHashtags = signal('');
  readonly formDescription = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  isFormValid(): boolean {
    return this.formName().trim().length > 0
      && this.formCategory().trim().length > 0
      && this.formUnit().trim().length > 0;
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid()) return;
    this.isSubmitting.set(true);
    this.error.set(null);

    const payload: TempItemApprovePayload = {
      name: this.formName().trim(),
      category_id: this.formCategory().trim(),
      unit_id: this.formUnit().trim(),
    };
    if (this.formSku()) payload.sku = this.formSku().trim();
    if (this.formDescription()) payload.description = this.formDescription().trim();
    if (this.formHashtags()) payload.hashtags = this.formHashtags().trim();

    const success = await this.service.approveAsItem(this.item().id, payload);
    if (success) {
      this.submit.emit(this.item());
    } else {
      this.error.set('Ошибка при преобразовании. Попробуйте ещё раз.');
      this.isSubmitting.set(false);
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancel.emit();
    }
  }
}
