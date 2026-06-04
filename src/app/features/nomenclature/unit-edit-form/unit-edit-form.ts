import { Component, input, output, signal, computed, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Unit } from '../../../core/models/nomenclature.models';

@Component({
  selector: 'app-unit-edit-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="form-container">
      <div class="form-grid">
        <div class="form-group full">
          <label class="form-label">Название <span class="required">*</span></label>
          <input
            type="text"
            class="wh-form-input form-input"
            [(ngModel)]="draft.name"
            placeholder="Введите название единицы измерения"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Символ <span class="required">*</span></label>
          <input
            type="text"
            class="wh-form-input form-input"
            [(ngModel)]="draft.symbol"
            placeholder="шт, кг, м"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Сортировка</label>
          <input
            type="number"
            class="wh-form-input form-input"
            [(ngModel)]="draft.sortOrder"
            placeholder="0"
          />
        </div>
      </div>

      <div class="switch-row">
        <div class="switch-info">
          <span class="switch-label">Активность</span>
          <span class="switch-desc">Неактивные единицы скрыты из выбора.</span>
        </div>
        <label class="switch">
          <input type="checkbox" [(ngModel)]="draft.isActive" />
          <span class="switch-track">
            <span class="switch-knob"></span>
          </span>
        </label>
      </div>

      <div class="form-actions">
        <button class="wh-btn wh-btn--danger btn btn-danger" (click)="onDeactivate()" type="button">
          Деактивировать
        </button>
        <button class="wh-btn wh-btn--danger btn btn-danger" (click)="onDelete()" type="button">
          Удалить
        </button>
        <div class="spacer"></div>
        <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onReset()" type="button">
          Сбросить
        </button>
        <button
          class="wh-btn wh-btn--primary btn btn-primary"
          (click)="onSubmit()"
          type="button"
          [disabled]="!isValid"
        >
          Добавить в изменения
        </button>
      </div>

      @if (formError()) {
        <div class="form-error">{{ formError() }}</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .form-container { padding: 8px 0; }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-group.full { grid-column: 1 / -1; }
    .form-label {
      font-size: 12px;
      font-weight: 600;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .required { color: #DC2626; }
    .form-input, .form-select {
      height: 40px;
      padding: 0 12px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-size: 13px;
      color: #111827;
      background: #FFFFFF;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
      font-family: inherit;
      box-sizing: border-box;
    }
    .form-input:focus, .form-select:focus {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .form-input::placeholder { color: #9CA3AF; }
    .form-select { cursor: pointer; appearance: auto; }

    .switch-row {
      margin-top: 20px;
      padding: 14px 16px;
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .switch-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .switch-label {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
    }
    .switch-desc {
      font-size: 12px;
      color: #6B7280;
    }
    .switch {
      position: relative;
      display: inline-flex;
      align-items: center;
      cursor: pointer;
      gap: 8px;
    }
    .switch input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .switch-track {
      width: 44px;
      height: 24px;
      background: #D1D5DB;
      border-radius: 12px;
      position: relative;
      transition: background 0.2s;
    }
    .switch input:checked + .switch-track { background: #2563EB; }
    .switch-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: #FFFFFF;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .switch input:checked + .switch-track .switch-knob {
      transform: translateX(20px);
    }

    .form-actions {
      margin-top: 24px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .spacer { flex: 1; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 40px;
      padding: 0 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      border: 1px solid transparent;
      font-family: inherit;
    }
    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .btn-primary {
      background: #2563EB;
      color: #FFFFFF;
      border-color: #2563EB;
    }
    .btn-primary:hover:not(:disabled) { background: #1D4ED8; }
    .btn-secondary {
      background: #F3F4F6;
      border-color: #D1D5DB;
      color: #374151;
    }
    .btn-secondary:hover:not(:disabled) { background: #E5E7EB; }
    .btn-danger {
      background: #FEF2F2;
      border-color: #FCA5A5;
      color: #B91C1C;
    }
    .btn-danger:hover:not(:disabled) { background: #FEE2E2; }

    .form-error {
      margin-top: 12px;
      padding: 10px 14px;
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FECACA;
      border-radius: 8px;
      font-size: 13px;
    }
  `]
})
export class UnitEditFormComponent {
  readonly unit = input<Unit | null>(null);
  readonly units = input<Unit[]>([]);

  readonly saveDraft = output<{ id: string; payload: Record<string, unknown> }>();
  readonly resetDraft = output<void>();
  readonly deactivate = output<string>();
  readonly delete = output<string>();

  readonly formError = signal<string | null>(null);

  readonly isCreateMode = computed(() => this.unit() === null);

  draft = {
    name: '',
    symbol: '',
    sortOrder: 0,
    isActive: true,
  };

  get isValid(): boolean {
    return this.draft.name.trim().length > 0 && this.draft.symbol.trim().length > 0;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['unit']) {
      const u = this.unit();
      if (u) {
        this.draft = {
          name: u.name,
          symbol: u.symbol,
          sortOrder: u.sort_order,
          isActive: u.is_active,
        };
      } else {
        this.draft = { name: '', symbol: '', sortOrder: 0, isActive: true };
      }
      this.formError.set(null);
    }
  }

  onSubmit(): void {
    if (!this.isValid) {
      this.formError.set('Название и символ обязательны');
      return;
    }
    const d = this.draft;
    this.saveDraft.emit({
      id: this.unit()?.id ?? '__new__',
      payload: {
        name: d.name.trim(),
        symbol: d.symbol.trim(),
        sort_order: d.sortOrder,
        is_active: d.isActive,
      },
    });
    this.formError.set(null);
  }

  onReset(): void {
    const u = this.unit();
    if (u) {
      this.draft = {
        name: u.name,
        symbol: u.symbol,
        sortOrder: u.sort_order,
        isActive: u.is_active,
      };
    } else {
      this.draft = { name: '', symbol: '', sortOrder: 0, isActive: true };
    }
    this.formError.set(null);
    this.resetDraft.emit();
  }

  onDeactivate(): void {
    const u = this.unit();
    if (u) this.deactivate.emit(u.id);
  }

  onDelete(): void {
    const u = this.unit();
    if (!u) return;
    this.delete.emit(u.id);
  }
}
