import { Component, input, output, inject, OnInit, OnDestroy, effect, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { IssueObjectCategoriesService } from '../../../../core/services/issue-object-categories.service';
import {
  IssueObject,
  IssueObjectType,
  IssueObjectCreatePayload,
  IssueObjectUpdatePayload,
  IssueObjectCategory,
  ISSUE_OBJECT_TYPE_LABELS,
} from '../../../../core/models/issue-objects.models';

interface ObjectFormShape {
  displayName: FormControl<string>;
  comment: FormControl<string>;
  categoryId: FormControl<string>;
  objectType: FormControl<string>;
  code: FormControl<string>;
  isActive: FormControl<boolean>;
}

@Component({
  selector: 'app-object-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="form-page">
      <div class="form-header">
        <h2 class="form-title">{{ mode() === 'edit' ? 'Редактирование объекта' : 'Создание объекта выдачи' }}</h2>
      </div>

      <div class="wh-card form-card" [formGroup]="form">
        <div class="form-row">
          <label class="form-label">Наименование *</label>
          <input
            type="text"
            class="wh-form-input input"
            formControlName="displayName"
            placeholder="Введите наименование объекта"
          />
          @if (duplicateWarning()) {
            <div class="warning-msg">Объект с похожим наименованием уже существует: «{{ duplicateWarning() }}»</div>
          }
        </div>

        <div class="form-row">
          <label class="form-label">Комментарий</label>
          <textarea
            class="wh-form-input input comment-area"
            rows="2"
            formControlName="comment"
            placeholder="Дополнительная информация (необязательно)"
          ></textarea>
        </div>

        <div class="form-row form-row--split">
          <div class="form-col">
            <label class="form-label">Категория *</label>
            <select class="wh-form-input input" formControlName="categoryId">
              <option value="" disabled>Выберите категорию</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
          </div>
          <div class="form-col">
            <label class="form-label">Тип (совместимость)</label>
            <select class="wh-form-input input" formControlName="objectType">
              <option value="">— не указан</option>
              @for (entry of typeOptions; track entry.key) {
                <option [value]="entry.key">{{ entry.label }}</option>
              }
            </select>
          </div>
        </div>

        <div class="form-row form-row--split">
          <div class="form-col">
            <label class="form-label">Код</label>
            <input
              type="text"
              class="wh-form-input input"
              formControlName="code"
              placeholder="Внешний код (необязательно)"
            />
          </div>
          @if (mode() === 'edit') {
            <div class="form-col">
              <label class="form-label">Активен</label>
              <label class="checkbox-row">
                <input type="checkbox" formControlName="isActive" />
                <span>{{ form.controls.isActive.value ? 'Да' : 'Нет' }}</span>
              </label>
            </div>
          }
        </div>

        <div class="form-actions">
          <button type="button" class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCancel()">Отмена</button>
          <button
            type="button"
            class="wh-btn wh-btn--primary btn btn-primary"
            [disabled]="!canSave()"
            (click)="onSave()">
            {{ service.isSaving() ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>

        @if (service.error(); as err) {
          <div class="error-msg">{{ err }}</div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow-y: auto; }
    .form-page { padding: 16px 20px; max-width: 720px; }

    .form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .form-title { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }

    .wh-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; }

    .form-row { margin-bottom: 16px; }
    .form-row--split { display: flex; gap: 12px; }
    .form-col { flex: 1; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px; }
    .input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; box-sizing: border-box; }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .comment-area { height: auto; padding: 8px 10px; resize: vertical; }
    .checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #1F2937; cursor: pointer; height: 36px; }
    .checkbox-row input { margin: 0; }

    .form-actions { display: flex; gap: 8px; margin-top: 20px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }

    .warning-msg { margin-top: 4px; padding: 6px 10px; background: #FEF9C3; border: 1px solid #FDE68A; border-radius: 6px; font-size: 12px; color: #854D0E; }
    .error-msg { margin-top: 12px; padding: 8px 12px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; font-size: 12px; color: #DC2626; }
  `]
})
export class ObjectFormComponent implements OnInit, OnDestroy {
  readonly mode = input<'create' | 'edit'>('create');
  readonly object = input<IssueObject | null>(null);
  readonly categories = input<IssueObjectCategory[]>([]);

  readonly save = output<IssueObjectCreatePayload | IssueObjectUpdatePayload>();
  readonly cancel = output<void>();

  readonly service = inject(IssueObjectsService);
  private readonly categoriesService = inject(IssueObjectCategoriesService);

  // Reactive Forms — FormGroup with explicit FormControl instances. Reactive
  // Forms are wired into the DOM via [formGroup]/formControlName and react
  // to ALL input events (keyboard, paste, autofill, password manager, drag &
  // drop, programmatic fill). The previous ngModel + signals approach
  // missed programmatic value changes and left the Save button disabled.
  readonly form: FormGroup<ObjectFormShape> = new FormGroup<ObjectFormShape>({
    displayName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    comment: new FormControl<string>('', { nonNullable: true }),
    categoryId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    objectType: new FormControl<string>('', { nonNullable: true }),
    code: new FormControl<string>('', { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  readonly duplicateWarning = signal<string | null>(null);

  readonly typeOptions = (Object.entries(ISSUE_OBJECT_TYPE_LABELS) as [IssueObjectType, string][])
    .map(([key, label]) => ({ key, label }));

  // Convert FormGroup.statusChanges + valueChanges into a single signal so
  // the disabled binding reads through a signal (no method calls in the
  // template, and re-evaluates on every input event).
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

  readonly canSave = computed(() => {
    // Re-read both signals so the computed re-evaluates on any change.
    this.formStatus();
    this.formValue();
    if (this.service.isSaving()) return false;
    return this.form.valid;
  });

  private duplicateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const obj = this.object();
      const m = this.mode();
      // Patch the form without firing valueChanges to avoid feedback loops
      // with the duplicate-check debounce.
      this.form.patchValue({
        displayName: m === 'edit' && obj ? (obj.display_name ?? '') : '',
        comment: m === 'edit' && obj ? (obj.comment ?? '') : '',
        categoryId: m === 'edit' && obj ? (obj.category_id ?? '') : '',
        objectType: m === 'edit' && obj ? (obj.object_type ?? '') : '',
        code: m === 'edit' && obj ? (obj.code ?? '') : '',
        isActive: m === 'edit' && obj ? !!obj.is_active : true,
      }, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    if (this.categories().length === 0) {
      void this.categoriesService.loadList({ page_size: 200, include_deleted: false });
    }
  }

  ngOnDestroy(): void {
    if (this.duplicateTimer) clearTimeout(this.duplicateTimer);
  }

  onSave(): void {
    if (!this.form.valid) return;
    const v = this.form.getRawValue();
    const displayName = v.displayName.trim();
    const categoryId = v.categoryId;
    if (!displayName || !categoryId) return;

    if (this.mode() === 'edit') {
      const payload: IssueObjectUpdatePayload = {
        display_name: displayName,
        comment: v.comment || null,
        category_id: categoryId,
        object_type: (v.objectType || undefined) as IssueObjectType | undefined,
        code: v.code.trim() || undefined,
        is_active: v.isActive,
      };
      this.save.emit(payload);
    } else {
      const payload: IssueObjectCreatePayload = {
        display_name: displayName,
        comment: v.comment || null,
        category_id: categoryId,
        object_type: (v.objectType || undefined) as IssueObjectType | undefined,
        code: v.code.trim() || undefined,
      };
      this.save.emit(payload);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
