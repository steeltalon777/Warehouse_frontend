import { Component, OnInit, OnDestroy, inject, signal, computed, effect, ElementRef, viewChild } from '@angular/core';
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
import { IssuedAssetRow } from '../../../../core/models/assets.models';
import { OperationDraftVm } from '../../../../core/models/operations.models';
import { OperationsService } from '../../../../core/services/operations.service';
import { RepositorySelectionService } from '../../services/repository-selection.service';
import { AssignedAssetsTableComponent } from '../assigned-assets-table/assigned-assets-table.component';
import { OperationCreateModalComponent } from '../../../operations/components/operation-create-modal/operation-create-modal.component';

function genLocalId(): string {
  return `local-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

@Component({
  selector: 'app-object-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AssignedAssetsTableComponent, OperationCreateModalComponent],
  template: `
    <div class="object-panel">
      @if (showCreateForm()) {
        <div class="panel-header">
          <div class="header-info">
            <h2 class="panel-title">Новый объект выдачи</h2>
            <p class="panel-subtitle">Заполните данные и сохраните</p>
          </div>
        </div>
        <div class="panel-body">
          <div class="wh-card form-card" [formGroup]="createForm">
            <div class="form-row">
              <label class="form-label">Наименование *</label>
              <input
                type="text"
                class="wh-form-input input"
                formControlName="displayName"
                placeholder="Введите наименование объекта"
              />
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
                  @for (cat of categoryOptions(); track cat.id) {
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
            <div class="form-row">
              <label class="form-label">Код</label>
              <input
                type="text"
                class="wh-form-input input"
                formControlName="code"
                placeholder="Внешний код (необязательно)"
              />
            </div>
            <div class="form-actions">
              <button type="button" class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCancelCreate()">Отмена</button>
              <button
                type="button"
                class="wh-btn wh-btn--primary btn btn-primary"
                [disabled]="!canCreate()"
                (click)="onCreateSave()">
                {{ service.isSaving() ? 'Сохранение...' : 'Сохранить' }}
              </button>
            </div>
            @if (service.error(); as err) {
              <div class="error-msg">{{ err }}</div>
            }
          </div>
        </div>
      } @else if (loading()) {
        <div class="wh-state wh-state--loading loading-state">
          <div class="spinner"></div>
          <span>Загрузка...</span>
        </div>
      } @else if (service.error(); as err) {
        <div class="wh-state wh-state--error error-state">{{ err }}</div>
      } @else if (object(); as obj) {
        <div class="object-detail" data-testid="issue-object-detail">
          <div class="panel-header">
            <div class="header-info">
              <h2 class="panel-title">{{ obj.display_name }}</h2>
              <p class="panel-subtitle">Объект выдачи</p>
            </div>
            <div class="header-actions">
              <button type="button" class="wh-btn wh-btn--secondary btn btn-secondary" (click)="toggleEdit()">
                {{ editMode() ? 'Отменить редактирование' : 'Редактировать' }}
              </button>
              <button
                type="button"
                class="wh-btn wh-btn--secondary btn btn-toggle"
                [disabled]="service.isSaving()"
                (click)="onToggleActive()">
                {{ obj.is_active ? 'Деактивировать' : 'Активировать' }}
              </button>
              <button
                type="button"
                class="wh-btn wh-btn--danger btn btn-danger"
                [disabled]="service.isSaving() || hasAssignedAssets()"
                [title]="hasAssignedAssets() ? 'Невозможно удалить: есть назначенное имущество' : 'Удалить объект'"
                (click)="onDelete()">
                Удалить
              </button>
            </div>
          </div>

          <div class="panel-body">
            <div class="wh-card form-card" data-testid="issue-object-params-card" [formGroup]="editForm">
              <h3 class="card-title">{{ editMode() ? 'Редактирование объекта' : 'Параметры объекта' }}</h3>
              <div class="form-row">
                <label class="form-label">Наименование *</label>
                <input
                  type="text"
                  class="wh-form-input input"
                  formControlName="displayName"
                  [disabled]="!editMode()"
                  placeholder="Введите наименование объекта"
                />
              </div>
              <div class="form-row">
                <label class="form-label">Комментарий</label>
                <textarea
                  class="wh-form-input input comment-area"
                  rows="2"
                  formControlName="comment"
                  [disabled]="!editMode()"
                  placeholder="Дополнительная информация об объекте"
                ></textarea>
              </div>
              <div class="form-row form-row--split">
                <div class="form-col">
                  <label class="form-label">Категория *</label>
                  <select
                    class="wh-form-input input"
                    formControlName="categoryId"
                    [disabled]="!editMode()">
                    <option value="" disabled>Выберите категорию</option>
                    @for (cat of categoryOptions(); track cat.id) {
                      <option [value]="cat.id">{{ cat.name }}</option>
                    }
                  </select>
                </div>
                <div class="form-col">
                  <label class="form-label">Тип (совместимость)</label>
                  <select
                    class="wh-form-input input"
                    formControlName="objectType"
                    [disabled]="!editMode()">
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
                    [disabled]="!editMode()"
                    placeholder="Внешний код (необязательно)"
                  />
                </div>
                <div class="form-col">
                  <label class="form-label">Активен</label>
                  <label class="checkbox-row">
                    <input
                      type="checkbox"
                      formControlName="isActive"
                      [disabled]="!editMode()"
                    />
                    <span>{{ editForm.controls.isActive.value ? 'Да' : 'Нет' }}</span>
                  </label>
                </div>
              </div>
              <div class="form-row form-row--meta">
                <div class="form-col">
                  <label class="form-label">Ключ</label>
                  <div class="readonly-value">{{ obj.normalized_key || '—' }}</div>
                </div>
                <div class="form-col">
                  <label class="form-label">Создан</label>
                  <div class="readonly-value">{{ obj.created_at | date:'dd.MM.yyyy HH:mm' }}</div>
                </div>
                <div class="form-col">
                  <label class="form-label">Обновлён</label>
                  <div class="readonly-value">{{ obj.updated_at | date:'dd.MM.yyyy HH:mm' }}</div>
                </div>
              </div>

              @if (editMode()) {
                <div class="form-actions">
                  <button type="button" class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCancelEdit()">Отмена</button>
                  <button
                    type="button"
                    class="wh-btn wh-btn--primary btn btn-primary"
                    [disabled]="!canEdit()"
                    (click)="onEditSave()">
                    {{ service.isSaving() ? 'Сохранение...' : 'Сохранить' }}
                  </button>
                </div>
              }
              @if (service.error(); as err) {
                <div class="error-msg">{{ err }}</div>
              }
            </div>

            <div class="wh-card assets-card" data-testid="issued-assets-panel">
              <div class="assets-card-header" data-testid="issued-assets-header">
                <h3 class="card-title">Назначенное имущество</h3>
                <button
                  #expandButton
                  type="button"
                  class="wh-btn wh-btn--secondary btn btn-secondary assets-expand-button"
                  data-testid="issued-assets-expand-button"
                  aria-haspopup="dialog"
                  [attr.aria-expanded]="assignedAssetsExpanded()"
                  (click)="openAssignedAssetsExpanded()">
                  ⛶ Развернуть
                </button>
              </div>

              @if (!assignedAssetsExpanded()) {
                <app-assigned-assets-table
                  [objectId]="obj.id"
                  variant="embedded"
                  (return)="onReturn($event)"
                  (writeOff)="onWriteOff($event)"
                />
              }
            </div>
          </div>

          @if (assignedAssetsExpanded()) {
            <div class="expanded-dialog-backdrop" (click)="closeAssignedAssetsExpanded()">
              <div
                #expandedDialog
                class="expanded-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="issued-assets-expanded-title"
                tabindex="-1"
                data-testid="issued-assets-expanded-dialog"
                (click)="$event.stopPropagation()"
                (keydown.escape)="closeAssignedAssetsExpanded()">
                <div class="expanded-dialog-header">
                  <div class="expanded-dialog-heading">
                    <h3 id="issued-assets-expanded-title" class="expanded-dialog-title" data-testid="issued-assets-expanded-title">
                      Назначенное имущество — {{ obj.display_name }}
                    </h3>
                    <p class="expanded-dialog-subtitle">Выбранный объект: {{ obj.display_name }}</p>
                  </div>
                  <button
                    type="button"
                    class="wh-btn wh-btn--secondary btn btn-secondary"
                    aria-label="Закрыть"
                    data-testid="issued-assets-expanded-close-button"
                    (click)="closeAssignedAssetsExpanded()">
                    Закрыть
                  </button>
                </div>

                <div class="expanded-dialog-body">
                  <app-assigned-assets-table
                    [objectId]="obj.id"
                    variant="expanded"
                    (return)="onReturnFromExpanded($event)"
                    (writeOff)="onWriteOffFromExpanded($event)"
                  />
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (showCreateModal() && modalDraft(); as draft) {
      <app-operation-create-modal
        [draft]="draft"
        [sites]="operationsService.sites()"
        [isSaving]="operationsService.isSaving()"
        [isSubmitting]="operationsService.isSubmitting()"
        (save)="onModalSave($event)"
        (submit)="onModalSubmit($event)"
        (cancel)="onModalCancel()"
        (delete)="onModalCancel()"
        (cancelOperation)="onModalCancel()"
        (acceptOperation)="onModalCancel()"
      />
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .object-panel { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; background: #F8FAFC; }
    .object-detail { display: flex; flex-direction: column; height: 100%; min-height: 0; }

    .panel-header { flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .header-info { min-width: 0; }
    .panel-title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0; }
    .panel-subtitle { font-size: 12px; color: #64748B; margin: 2px 0 0; }
    .header-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

    .panel-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

    .card-title { margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #374151; }
    .form-card, .assets-card { padding: 20px; }
    .form-card { flex: 0 0 auto; min-height: 380px; }
    .assets-card { flex: 1 1 auto; min-height: 220px; display: flex; flex-direction: column; }
    .assets-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .assets-card-header .card-title { margin-bottom: 0; }
    .assets-expand-button { flex-shrink: 0; }

    .form-row { margin-bottom: 14px; }
    .form-row--split { display: flex; gap: 12px; }
    .form-row--meta { display: flex; gap: 12px; }
    .form-col { flex: 1; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px; }
    .input:disabled { background: #F8FAFC; color: #475569; }
    .readonly-value { font-size: 13px; color: #1F2937; padding: 6px 0; }
    .checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #1F2937; cursor: pointer; height: 36px; }
    .checkbox-row input { margin: 0; }
    .form-actions { display: flex; gap: 8px; margin-top: 16px; }
    .error-msg { margin-top: 12px; padding: 8px 12px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; font-size: 12px; color: #DC2626; }

    .btn-toggle { color: #1E293B; }

    .loading-state, .error-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 40px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    .expanded-dialog-backdrop {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.38);
      z-index: 20;
    }
    .expanded-dialog {
      width: min(1200px, 90vw);
      height: min(760px, 85vh);
      max-width: 100%;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 14px;
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
    }
    .expanded-dialog-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 24px 16px;
      border-bottom: 1px solid #E2E8F0;
      flex: 0 0 auto;
    }
    .expanded-dialog-heading { min-width: 0; }
    .expanded-dialog-title { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }
    .expanded-dialog-subtitle { margin: 6px 0 0; font-size: 13px; color: #64748B; }
    .expanded-dialog-body { flex: 1 1 auto; min-height: 0; padding: 16px 24px 24px; display: flex; flex-direction: column; }
    @media (max-height: 900px) {
      .form-card { min-height: 320px; }
      .expanded-dialog-backdrop { padding: 16px; }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ObjectPanelComponent implements OnInit, OnDestroy {
  readonly service = inject(IssueObjectsService);
  readonly categoriesService = inject(IssueObjectCategoriesService);
  readonly operationsService = inject(OperationsService);
  readonly selection = inject(RepositorySelectionService);

  readonly loading = signal<boolean>(false);
  readonly editMode = signal<boolean>(false);

  readonly object = signal<IssueObject | null>(null);

  readonly showCreateForm = signal<boolean>(false);
  readonly showCreateModal = signal<boolean>(false);
  readonly modalDraft = signal<OperationDraftVm | null>(null);
  readonly assignedAssetsExpanded = signal<boolean>(false);

  readonly expandButtonRef = viewChild<ElementRef<HTMLButtonElement>>('expandButton');
  readonly expandedDialogRef = viewChild<ElementRef<HTMLDivElement>>('expandedDialog');

  // ── Reactive Forms (fixes Save-stays-disabled after paste / autofill) ──
  // ngModel + signals misses programmatic value changes (paste, password
  // manager autofill, drag&drop, programmatic fill). Reactive Forms are
  // wired into the DOM via [formGroup]/formControlName and react to ALL
  // input events. Each form has its own status stream exposed as a
  // signal so the disabled binding re-evaluates on every change.
  readonly createForm: FormGroup<{
    displayName: FormControl<string>;
    comment: FormControl<string>;
    categoryId: FormControl<string>;
    objectType: FormControl<string>;
    code: FormControl<string>;
  }> = new FormGroup({
    displayName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    comment: new FormControl<string>('', { nonNullable: true }),
    categoryId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    objectType: new FormControl<string>('', { nonNullable: true }),
    code: new FormControl<string>('', { nonNullable: true }),
  });

  readonly editForm: FormGroup<{
    displayName: FormControl<string>;
    comment: FormControl<string>;
    categoryId: FormControl<string>;
    objectType: FormControl<string>;
    code: FormControl<string>;
    isActive: FormControl<boolean>;
  }> = new FormGroup({
    displayName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    comment: new FormControl<string>('', { nonNullable: true }),
    categoryId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    objectType: new FormControl<string>('', { nonNullable: true }),
    code: new FormControl<string>('', { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  private readonly createStatus = toSignal(this.createForm.statusChanges, { initialValue: this.createForm.status });
  private readonly createValue = toSignal(this.createForm.valueChanges, { initialValue: this.createForm.getRawValue() });
  private readonly editStatus = toSignal(this.editForm.statusChanges, { initialValue: this.editForm.status });
  private readonly editValue = toSignal(this.editForm.valueChanges, { initialValue: this.editForm.getRawValue() });
  // Make sure both forms' streams are subscribed even when only one
  // [formGroup] is rendered (otherwise toSignal may not see the events).
  private readonly _createAlive = this.createForm.valueChanges.subscribe();
  private readonly _editAlive = this.editForm.valueChanges.subscribe();

  private loadedId: string | null = null;
  private categoriesLoaded = false;

  readonly typeOptions = (Object.entries(ISSUE_OBJECT_TYPE_LABELS) as [IssueObjectType, string][])
    .map(([key, label]) => ({ key, label }));

  readonly categoryOptions = computed<IssueObjectCategory[]>(() => {
    return this.flattenCategories(this.service.tree());
  });

  readonly canCreate = computed(() => {
    // Force re-evaluation on every keystroke / paste / autofill event.
    this.createStatus();
    this.createValue();
    if (this.service.isSaving()) return false;
    return this.createForm.valid;
  });

  readonly canEdit = computed(() => {
    this.editStatus();
    this.editValue();
    if (this.service.isSaving()) return false;
    return this.editForm.valid;
  });

  readonly hasAssignedAssets = computed(() => {
    return (this.service.objectAssets() ?? []).length > 0;
  });

  constructor() {
    effect(() => {
      const id = this.selection.selectedObjectId();
      const flag = this.selection.createFlag();
      if (flag === 'new-object') {
        this.assignedAssetsExpanded.set(false);
        this.showCreateForm.set(true);
        this.editMode.set(false);
        this.object.set(null);
        this.resetCreateForm();
        void this.ensureCategoriesLoaded();
        return;
      }
      this.showCreateForm.set(false);
      if (id && id !== this.loadedId) {
        this.assignedAssetsExpanded.set(false);
        this.loadedId = id;
        this.editMode.set(false);
        void this.loadObject(id);
      } else if (!id) {
        this.assignedAssetsExpanded.set(false);
        this.loadedId = null;
        this.object.set(null);
      }
    });

    effect(() => {
      if (this.assignedAssetsExpanded()) {
        setTimeout(() => this.expandedDialogRef()?.nativeElement.focus());
      }
    });
  }

  ngOnInit(): void {
    if (this.selection.createFlag() === 'new-object') {
      this.showCreateForm.set(true);
      this.resetCreateForm();
    }
    const id = this.selection.selectedObjectId();
    if (id) {
      this.loadedId = id;
      void this.loadObject(id);
    }
    void this.ensureCategoriesLoaded();
  }

  ngOnDestroy(): void {
    this.loadedId = null;
    this._createAlive.unsubscribe();
    this._editAlive.unsubscribe();
  }

  toggleEdit(): void {
    if (this.editMode()) {
      this.onCancelEdit();
    } else {
      const obj = this.object();
      if (obj) {
        this.editForm.patchValue({
          displayName: obj.display_name ?? '',
          comment: obj.comment ?? '',
          categoryId: obj.category_id ?? '',
          objectType: obj.object_type ?? '',
          code: obj.code ?? '',
          isActive: !!obj.is_active,
        }, { emitEvent: false });
      }
      this.editMode.set(true);
    }
  }

  onCancelEdit(): void {
    this.editMode.set(false);
    this.service.error.set(null);
  }

  onCancelCreate(): void {
    this.showCreateForm.set(false);
    this.selection.clearCreateFlag();
    this.service.error.set(null);
  }

  async onEditSave(): Promise<void> {
    if (!this.editForm.valid) return;
    const obj = this.object();
    if (!obj) return;
    const v = this.editForm.getRawValue();
    const payload: IssueObjectUpdatePayload = {
      display_name: v.displayName.trim(),
      comment: v.comment || null,
      category_id: v.categoryId,
      object_type: (v.objectType || undefined) as IssueObjectType | undefined,
      code: v.code.trim() || undefined,
      is_active: v.isActive,
    };
    try {
      const result = await this.service.updateObject(obj.id, payload);
      if (result) {
        this.object.set(result);
        this.editMode.set(false);
        await this.service.loadTree({ include_inactive: true, include_deleted: false });
      }
    } catch {
      // error handled in service
    }
  }

  async onCreateSave(): Promise<void> {
    if (!this.createForm.valid) return;
    const v = this.createForm.getRawValue();
    const payload: IssueObjectCreatePayload = {
      display_name: v.displayName.trim(),
      comment: v.comment || null,
      category_id: v.categoryId,
      object_type: (v.objectType || undefined) as IssueObjectType | undefined,
      code: v.code.trim() || undefined,
    };
    try {
      const result = await this.service.createObject(payload);
      if (result) {
        this.showCreateForm.set(false);
        this.selection.clearCreateFlag();
        this.selection.selectObject(result.id);
        await this.service.loadTree({ include_inactive: true, include_deleted: false });
      }
    } catch {
      // error handled in service
    }
  }

  async onToggleActive(): Promise<void> {
    const obj = this.object();
    if (!obj) return;
    const payload: IssueObjectUpdatePayload = { is_active: !obj.is_active };
    try {
      const result = await this.service.updateObject(obj.id, payload);
      if (result) {
        this.object.set(result);
        this.editForm.patchValue({ isActive: !!result.is_active }, { emitEvent: false });
        await this.service.loadTree({ include_inactive: true, include_deleted: false });
      }
    } catch {
      // error handled in service
    }
  }

  async onDelete(): Promise<void> {
    const obj = this.object();
    if (!obj) return;
    if (!confirm(`Удалить объект выдачи «${obj.display_name}»?`)) return;
    try {
      await this.service.deleteObject(obj.id);
      this.selection.clear();
      await this.service.loadTree({ include_inactive: true, include_deleted: false });
    } catch {
      // error handled in service
    }
  }

  openAssignedAssetsExpanded(): void {
    if (!this.object()) return;
    this.assignedAssetsExpanded.set(true);
  }

  closeAssignedAssetsExpanded(restoreFocus: boolean = true): void {
    this.assignedAssetsExpanded.set(false);
    if (restoreFocus) {
      setTimeout(() => this.expandButtonRef()?.nativeElement.focus());
    }
  }

  onReturn(row: IssuedAssetRow): void {
    const obj = this.object();
    if (!obj) return;
    const available = this.parseQty(row.qty);
    const itemId = row.item_id || row.resolved_item_id || row.temporary_item_id || '';
    const draft: OperationDraftVm = {
      type: 'ISSUE_RETURN',
      status: 'draft',
      issueObjectId: obj.id,
      issueObjectName: obj.display_name,
      writeOffSource: null,
      effectiveAt: currentDateTimeLocal(),
      lines: [
        {
          localId: genLocalId(),
          itemId,
          itemName: row.display_name || row.resolved_item_name || row.item_name || '',
          sku: row.sku ?? null,
          unitName: '',
          quantity: null,
          availableQuantity: available,
          isTemporary: false,
          fromBalances: false,
        },
      ],
      prefilledAssetLine: true,
      lockedFromAssetRow: true,
      assignedAssetAvailableQty: available,
    };
    this.modalDraft.set(draft);
    this.showCreateModal.set(true);
  }

  onWriteOff(row: IssuedAssetRow): void {
    const obj = this.object();
    if (!obj) return;
    const available = this.parseQty(row.qty);
    const itemId = row.item_id || row.resolved_item_id || row.temporary_item_id || '';
    const draft: OperationDraftVm = {
      type: 'WRITE_OFF',
      status: 'draft',
      issueObjectId: obj.id,
      issueObjectName: obj.display_name,
      sourceSiteId: null,
      writeOffSource: 'object',
      effectiveAt: currentDateTimeLocal(),
      lines: [
        {
          localId: genLocalId(),
          itemId,
          itemName: row.display_name || row.resolved_item_name || row.item_name || '',
          sku: row.sku ?? null,
          unitName: '',
          quantity: null,
          availableQuantity: available,
          isTemporary: false,
          fromBalances: false,
        },
      ],
      prefilledAssetLine: true,
      lockedFromAssetRow: true,
      assignedAssetAvailableQty: available,
    };
    this.modalDraft.set(draft);
    this.showCreateModal.set(true);
  }

  onReturnFromExpanded(row: IssuedAssetRow): void {
    this.closeAssignedAssetsExpanded(false);
    this.onReturn(row);
  }

  onWriteOffFromExpanded(row: IssuedAssetRow): void {
    this.closeAssignedAssetsExpanded(false);
    this.onWriteOff(row);
  }

  async onModalSave(draft: OperationDraftVm): Promise<void> {
    try {
      const result = draft.id
        ? await this.operationsService.updateOperation(draft.id, draft)
        : await this.operationsService.createOperation(draft);
      if (!result) return;
      // Re-map the server response back into the local draft so subsequent
      // submit uses the persisted id and updated snapshot. The server DTO
      // does NOT carry our UI-only flags (`writeOffSource`, `prefilledAssetLine`,
      // `lockedFromAssetRow`, `assignedAssetAvailableQty`, per-line
      // `availableQuantity`) — without them the modal would silently flip
      // out of object-source flow on the next submit. The create response
      // also omits `type` (only `operation_type` is returned), so we have
      // to seed the remap from the in-memory draft and re-attach all UI-only
      // fields explicitly. Re-attach them so the locked context survives a
      // save → submit.
      const updated = this.operationsService.mapDtoToDraftVm(result);
      this.modalDraft.set({
        ...updated,
        type: draft.type,
        writeOffSource: draft.writeOffSource ?? updated.writeOffSource ?? null,
        prefilledAssetLine: draft.prefilledAssetLine,
        lockedFromAssetRow: draft.lockedFromAssetRow,
        assignedAssetAvailableQty: draft.assignedAssetAvailableQty ?? null,
        sourceSiteId: draft.sourceSiteId ?? updated.sourceSiteId ?? null,
        destinationSiteId: draft.destinationSiteId ?? updated.destinationSiteId ?? null,
        personName: draft.personName ?? updated.personName ?? null,
        comment: draft.comment ?? updated.comment ?? null,
        effectiveAt: draft.effectiveAt ?? updated.effectiveAt ?? null,
        lines: (updated.lines ?? []).map(line => {
          // Match by `itemId` (stable across server remap; `localId` is
          // generated by the server on save and would not match the
          // client-side random localId we used when opening the modal).
          const original = draft.lines.find(l => !!l.itemId && l.itemId === line.itemId)
            ?? draft.lines.find(l => l.localId === line.localId);
          if (!original) return line;
          return {
            ...line,
            availableQuantity: original.availableQuantity ?? line.availableQuantity ?? null,
          };
        }),
      });
    } catch {
      // error is already exposed via operationsService.error
    } finally {
      const id = this.object()?.id;
      if (id) {
        await this.service.loadObjectAssets(id);
      }
    }
  }

  // TODO(W2.1 tests): unit tests for onModalSubmit modal-open semantics are
  // deferred — no object-panel.component.spec.ts exists in the repo yet and
  // creating one is out of scope for this shard. Cover when the spec file is
  // introduced: closes on submitted outcome; stays open on business reject,
  // version conflict, and outcome_unknown.
  /**
   * TZ V3.2 Stage D extension §7.4 #16: close the modal ONLY on a fully
   * successful submit. On any failure — business reject, version conflict,
   * unknown outcome, network error — the modal STAYS OPEN so the user can
   * correct the draft and retry. `OperationsService.persistState` already
   * carries the outcome (rejected / conflict / outcome_unknown) and the
   * error surface is rendered by the modal's own persist status display.
   */
  async onModalSubmit(draft: OperationDraftVm): Promise<void> {
    try {
      const result = draft.id
        ? await this.operationsService.updateOperation(draft.id, draft)
        : await this.operationsService.createOperation(draft);
      if (!result) return;
      await this.operationsService.submitOperation(result.id);
      // Success path only — close the modal and drop the draft.
      this.showCreateModal.set(false);
      this.modalDraft.set(null);
    } catch (err) {
      // Submit/save failed — modal STAYS OPEN. persistState is already
      // updated by OperationsService; the user sees the error via the
      // modal's persist status display and can retry or cancel.
      console.warn('operation submit failed, modal stays open:', err);
    } finally {
      // Refresh assigned assets regardless of outcome (same as before).
      const id = this.object()?.id;
      if (id) {
        await this.service.loadObjectAssets(id);
      }
    }
  }

  onModalCancel(): void {
    this.showCreateModal.set(false);
    this.modalDraft.set(null);
  }

  private async loadObject(id: string): Promise<void> {
    this.loading.set(true);
    const result = await this.service.getObject(id);
    if (result) {
      this.object.set(result);
      this.editForm.patchValue({
        displayName: result.display_name ?? '',
        comment: result.comment ?? '',
        categoryId: result.category_id ?? '',
        objectType: result.object_type ?? '',
        code: result.code ?? '',
        isActive: !!result.is_active,
      }, { emitEvent: false });
    }
    this.loading.set(false);
    await this.ensureCategoriesLoaded();
  }

  private async ensureCategoriesLoaded(): Promise<void> {
    if (this.categoriesLoaded) return;
    this.categoriesLoaded = true;
    try {
      await this.categoriesService.loadList({ page_size: 200, include_deleted: false });
    } catch {
      // error handled in service
    }
  }

  private resetCreateForm(): void {
    this.createForm.reset({
      displayName: '',
      comment: '',
      categoryId: '',
      objectType: '',
      code: '',
    });
  }

  private parseQty(value: string | undefined): number {
    if (!value) return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private flattenCategories(nodes: import('../../../../core/models/issue-objects.models').IssueRepositoryTreeNode[]): IssueObjectCategory[] {
    const result: IssueObjectCategory[] = [];
    const visit = (list: typeof nodes): void => {
      for (const node of list) {
        if (node.type === 'category') {
          result.push({
            id: node.id,
            name: node.name,
            parent_id: node.parent_id,
            sort_order: 0,
            is_active: node.is_active,
          });
          if (node.children) visit(node.children);
        }
      }
    };
    visit(nodes);
    return result;
  }
}

function currentDateTimeLocal(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
