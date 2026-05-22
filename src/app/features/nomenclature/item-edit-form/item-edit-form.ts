import { Component, input, output, signal, computed, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item, Unit, Category } from '../../../core/models/nomenclature.models';

@Component({
  selector: 'app-item-edit-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="form-container">
      <div class="form-grid">
        <!-- Название -->
        <div class="form-group full">
          <label class="form-label">Название <span class="required">*</span></label>
          <input
            type="text"
            class="wh-form-input form-input"
            [(ngModel)]="draft.name"
            placeholder="Введите название"
          />
        </div>

        <!-- SKU -->
        <div class="form-group">
          <label class="form-label">SKU <span class="required">*</span></label>
          <input
            type="text"
            class="wh-form-input form-input"
            [(ngModel)]="draft.sku"
            placeholder="Артикул"
          />
        </div>

        <!-- Единица измерения -->
        <div class="form-group">
          <label class="form-label">Единица измерения <span class="required">*</span></label>
          <select class="wh-form-input form-select" [(ngModel)]="draft.unitId">
            <option value="">— Выберите —</option>
            @for (u of units(); track u.id) {
              <option [value]="u.id">{{ u.name }} ({{ u.symbol }})</option>
            }
          </select>
        </div>

        <!-- Категория -->
        <div class="form-group full">
          <label class="form-label">Категория <span class="required">*</span></label>
          <select class="wh-form-input form-select" [(ngModel)]="draft.categoryId">
            <option value="">— Выберите —</option>
            @for (c of flatCategories(); track c.id) {
              <option [value]="c.id">{{ c.indent }}{{ c.name }}</option>
            }
          </select>
        </div>

        <!-- Ключевые слова -->
        <div class="form-group full">
          <label class="form-label">Ключевые слова</label>
          <input
            type="text"
            class="wh-form-input form-input"
            [(ngModel)]="draft.hashtags"
            placeholder="через запятую: кабель, сеть, cat5e"
          />
        </div>

        <!-- Описание -->
        <div class="form-group full">
          <label class="form-label">Описание</label>
          <textarea
            class="form-textarea"
            [(ngModel)]="draft.description"
            rows="4"
            placeholder="Описание ТМЦ..."
          ></textarea>
        </div>
      </div>

      <!-- Активность switch -->
      <div class="switch-row">
        <div class="switch-info">
          <span class="switch-label">Активность</span>
          <span class="switch-desc">Активные ТМЦ доступны в операциях и поиске.</span>
        </div>
        <label class="switch">
          <input type="checkbox" [(ngModel)]="draft.isActive" />
          <span class="switch-track">
            <span class="switch-knob"></span>
          </span>
        </label>
      </div>

      <!-- Actions -->
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
    .form-input, .form-select, .form-textarea {
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
    .form-input:focus, .form-select:focus, .form-textarea:focus {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .form-input::placeholder, .form-textarea::placeholder { color: #9CA3AF; }
    .form-select { cursor: pointer; appearance: auto; }
    .form-textarea {
      height: auto;
      padding: 10px 12px;
      resize: vertical;
      min-height: 80px;
    }

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
export class ItemEditFormComponent {
  readonly item = input.required<Item>();
  readonly units = input<Unit[]>([]);
  readonly categories = input<Category[]>([]);

  readonly saveDraft = output<{ id: string; payload: Record<string, unknown> }>();
  readonly resetDraft = output<void>();
  readonly deactivate = output<string>();
  readonly delete = output<string>();

  readonly formError = signal<string | null>(null);

  // Plain object for ngModel (signals don't work with ngModel property binding)
  draft = {
    name: '',
    sku: '',
    unitId: '',
    categoryId: '',
    hashtags: '',
    description: '',
    isActive: true,
  };

  // Flat categories for select
  readonly flatCategories = computed(() => {
    const result: { id: string; name: string; indent: string }[] = [];
    const walk = (cats: Category[], level: number) => {
      for (const c of cats) {
        result.push({
          id: c.id,
          name: c.name,
          indent: '  '.repeat(level),
        });
        if (c.children) walk(c.children, level + 1);
      }
    };
    walk(this.categories(), 0);
    return result;
  });

  get isValid(): boolean {
    const d = this.draft;
    return !!(d.name.trim().length > 0 && d.sku.trim().length > 0 && d.unitId && d.categoryId);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['item']) {
      const it = this.item();
      if (!it) return;
      this.draft = {
        name: it.name,
        sku: it.sku,
        unitId: it.unit_id,
        categoryId: it.category_id,
        hashtags: it.hashtags.join(', '),
        description: '',
        isActive: it.is_active,
      };
      this.formError.set(null);
    }
  }

  onSubmit(): void {
    if (!this.isValid) {
      this.formError.set('Заполните все обязательные поля');
      return;
    }
    const d = this.draft;
    const it = this.item();
    this.saveDraft.emit({
      id: it?.id ?? '__new__',
      payload: {
        name: d.name.trim(),
        sku: d.sku.trim(),
        unit_id: d.unitId,
        category_id: d.categoryId,
        hashtags: d.hashtags.split(',').map(s => s.trim()).filter(Boolean),
        is_active: d.isActive,
      },
    });
    this.formError.set(null);
  }

  onReset(): void {
    const it = this.item();
    if (!it) { this.draft = { name: '', sku: '', unitId: '', categoryId: '', hashtags: '', description: '', isActive: true }; this.formError.set(null); this.resetDraft.emit(); return; }
    this.draft = {
      name: it.name,
      sku: it.sku,
      unitId: it.unit_id,
      categoryId: it.category_id,
      hashtags: it.hashtags.join(', '),
      description: '',
      isActive: it.is_active,
    };
    this.formError.set(null);
    this.resetDraft.emit();
  }

  onDeactivate(): void {
    const it = this.item();
    if (!it) return;
    this.deactivate.emit(it.id);
  }

  onDelete(): void {
    const it = this.item();
    if (!it) return;
    if (confirm('Удалить ТМЦ? Это действие нельзя отменить.')) {
      this.delete.emit(it.id);
    }
  }
}
