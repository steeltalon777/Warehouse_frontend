import { Component, inject, input, output, signal, computed, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category } from '../../../core/models/nomenclature.models';
import { AuthContextService } from '../../../core/services/auth-context.service';

@Component({
  selector: 'app-category-edit-form',
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
            placeholder="Введите название категории"
          />
        </div>

        <!-- Код -->
        <div class="form-group">
          <label class="form-label">Код</label>
          <input
            type="text"
            class="wh-form-input form-input"
            [(ngModel)]="draft.code"
            placeholder="Код категории"
          />
        </div>

        <!-- Родительская категория -->
        <div class="form-group">
          <label class="form-label">Родительская категория</label>
          <select class="wh-form-input form-select" [(ngModel)]="draft.parentId">
            <option [ngValue]="null">— Корневая —</option>
            @for (c of flatCategories(); track c.id) {
              <option [ngValue]="c.id">{{ c.indent }}{{ c.name }}</option>
            }
          </select>
        </div>

        <!-- Сортировка -->
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

      <!-- Активность switch -->
      <div class="switch-row">
        <div class="switch-info">
          <span class="switch-label">Активность</span>
          <span class="switch-desc">Неактивные категории скрыты из операций.</span>
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
        @if (canMerge()) {
          <button class="wh-btn wh-btn--warning btn btn-warning" (click)="onMerge()" type="button" title="Слияние с другой категорией">
            Слияние
          </button>
        }
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
    .btn-warning {
      background: #f59e0b;
      color: white;
      border: 1px solid #d97706;
    }
    .btn-warning:hover:not(:disabled) {
      background: #d97706;
    }

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
export class CategoryEditFormComponent {
  private readonly authContextService = inject(AuthContextService);

  readonly category = input.required<Category>();
  readonly categories = input<Category[]>([]);

  readonly saveDraft = output<{ id: string; payload: Record<string, unknown> }>();
  readonly resetDraft = output<void>();
  readonly deactivate = output<string>();
  readonly delete = output<string>();
  readonly mergeRequest = output<string>();

  readonly formError = signal<string | null>(null);

  readonly canMerge = computed(() => {
    const auth = this.authContextService.authContext();
    const role = auth?.role ?? 'observer';
    const isManager = role === 'root' || role === 'chief_storekeeper';
    const cat = this.category();
    return isManager && !!cat && cat.is_active;
  });

  draft = {
    name: '',
    code: '',
    parentId: null as string | null,
    sortOrder: 0,
    isActive: true,
  };

  readonly flatCategories = computed(() => {
    const cat = this.category();
    const result: { id: string; name: string; indent: string }[] = [];
    const walk = (cats: Category[], level: number) => {
      for (const c of cats) {
        if (cat && c.id === cat.id) continue; // Exclude self
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
    return this.draft.name.trim().length > 0;
  }

  private isLocalRef(id: string | null): boolean {
    return !!id && id.startsWith('category-tmp-');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['category']) {
      const cat = this.category();
      if (!cat) return;
      this.draft = {
        name: cat.name,
        code: cat.code,
        parentId: cat.parent_id,
        sortOrder: cat.sort_order,
        isActive: cat.is_active,
      };
      this.formError.set(null);
    }
  }

  onSubmit(): void {
    if (!this.isValid) {
      this.formError.set('Название обязательно');
      return;
    }
    const d = this.draft;
    const cat = this.category();
    const payload: Record<string, unknown> = {
      name: d.name.trim(),
      code: d.code.trim(),
      sort_order: d.sortOrder,
      is_active: d.isActive,
    };

    if (!d.parentId) {
      payload['parent_id'] = null;
    } else if (this.isLocalRef(d.parentId)) {
      payload['parent_local_id'] = d.parentId;
    } else {
      payload['parent_id'] = d.parentId;
    }

    this.saveDraft.emit({
      id: cat?.id ?? '__new__',
      payload,
    });
    this.formError.set(null);
  }

  onReset(): void {
    const cat = this.category();
    if (!cat) { this.draft = { name: '', code: '', parentId: null, sortOrder: 0, isActive: true }; this.formError.set(null); return; }
    this.draft = {
      name: cat.name,
      code: cat.code,
      parentId: cat.parent_id,
      sortOrder: cat.sort_order,
      isActive: cat.is_active,
    };
    this.formError.set(null);
    this.resetDraft.emit();
  }

  onDeactivate(): void {
    const cat = this.category();
    if (!cat) return;
    this.deactivate.emit(cat.id);
  }

  onDelete(): void {
    const cat = this.category();
    if (!cat) return;
    this.delete.emit(cat.id);
  }

  onMerge(): void {
    const cat = this.category();
    if (!cat) return;
    this.mergeRequest.emit(cat.id);
  }
}
