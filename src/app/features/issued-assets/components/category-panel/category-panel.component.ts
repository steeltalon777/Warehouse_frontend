import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { IssueObjectCategoriesService } from '../../../../core/services/issue-object-categories.service';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import {
  IssueObjectCategory,
  IssueObjectCategoryCreatePayload,
  IssueObjectCategoryUpdatePayload,
  IssueRepositoryTreeNode,
} from '../../../../core/models/issue-objects.models';
import { RepositorySelectionService } from '../../services/repository-selection.service';

@Component({
  selector: 'app-category-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="category-panel">
      @if (loading()) {
        <div class="wh-state wh-state--loading loading-state">
          <div class="spinner"></div>
          <span>Загрузка...</span>
        </div>
      } @else if (categoriesService.error(); as err) {
        <div class="wh-state wh-state--error error-state">{{ err }}</div>
      } @else if (category(); as cat) {
        <div class="panel-header">
          <div class="header-info">
            <h2 class="panel-title">{{ cat.name }}</h2>
            <p class="panel-subtitle">Категория выдачи</p>
          </div>
          <div class="header-actions">
            <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="toggleEdit()">
              {{ editMode() ? 'Отменить редактирование' : 'Редактировать' }}
            </button>
            <button
              class="wh-btn wh-btn--secondary btn btn-toggle"
              [disabled]="saving()"
              (click)="onToggleActive()">
              {{ cat.is_active ? 'Деактивировать' : 'Активировать' }}
            </button>
            <button
              class="wh-btn wh-btn--danger btn btn-danger"
              [disabled]="saving() || hasActiveChildren()"
              [title]="hasActiveChildren() ? 'Невозможно удалить: есть активные дочерние элементы' : 'Удалить категорию'"
              (click)="onDelete()">
              Удалить
            </button>
          </div>
        </div>

        <div class="panel-body">
          <div class="wh-card form-card" [formGroup]="form">
            <h3 class="card-title">{{ editMode() ? 'Редактирование категории' : 'Параметры категории' }}</h3>
            <div class="form-row">
              <label class="form-label">Наименование *</label>
              <input
                type="text"
                class="wh-form-input input"
                formControlName="name"
                [disabled]="!editMode()"
                placeholder="Введите наименование"
              />
            </div>
            <div class="form-row form-row--split">
              <div class="form-col">
                <label class="form-label">Порядок сортировки</label>
                <input
                  type="number"
                  class="wh-form-input input"
                  formControlName="sortOrder"
                  [disabled]="!editMode()"
                />
              </div>
              <div class="form-col">
                <label class="form-label">Активна</label>
                <label class="checkbox-row">
                  <input
                    type="checkbox"
                    formControlName="isActive"
                    [disabled]="!editMode()"
                  />
                  <span>{{ form.controls.isActive.value ? 'Да' : 'Нет' }}</span>
                </label>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">Родительская категория</label>
              <div class="readonly-value">
                {{ parentLabel() || '— (корневая категория)' }}
              </div>
            </div>
            <div class="form-row">
              <label class="form-label">Создана</label>
              <div class="readonly-value">{{ cat.created_at ? (cat.created_at | date:'dd.MM.yyyy HH:mm') : '—' }}</div>
            </div>
            <div class="form-row">
              <label class="form-label">Обновлена</label>
              <div class="readonly-value">{{ cat.updated_at ? (cat.updated_at | date:'dd.MM.yyyy HH:mm') : '—' }}</div>
            </div>

            @if (editMode()) {
              <div class="form-actions">
                <button type="button" class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCancelEdit()">Отмена</button>
                <button
                  type="button"
                  class="wh-btn wh-btn--primary btn btn-primary"
                  [disabled]="!canSave()"
                  (click)="onSave()">
                  {{ saving() ? 'Сохранение...' : 'Сохранить' }}
                </button>
              </div>
            }
            @if (categoriesService.error(); as err) {
              <div class="error-msg">{{ err }}</div>
            }
          </div>

          <div class="wh-card summary-card">
            <h3 class="card-title">Содержимое</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="summary-label">Дочерних категорий</span>
                <span class="summary-value">{{ childCategoryCount() }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Объектов выдачи</span>
                <span class="summary-value">{{ childObjectCount() }}</span>
              </div>
            </div>
            <p class="summary-hint">
              Чтобы добавить объекты или подкатегории, выберите «+ Объект выдачи» или «+ Категория выдачи» в дереве слева.
            </p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .category-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #F8FAFC; }

    .panel-header { flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .header-info { min-width: 0; }
    .panel-title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0; }
    .panel-subtitle { font-size: 12px; color: #64748B; margin: 2px 0 0; }
    .header-actions { display: flex; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

    .panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; min-height: 0; }

    .wh-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; }
    .card-title { margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #374151; }

    .form-row { margin-bottom: 14px; }
    .form-row--split { display: flex; gap: 12px; }
    .form-col { flex: 1; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px; }
    .input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; box-sizing: border-box; }
    .input:disabled { background: #F8FAFC; color: #475569; }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .readonly-value { font-size: 13px; color: #1F2937; padding: 6px 0; }
    .checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #1F2937; cursor: pointer; height: 36px; }
    .checkbox-row input { margin: 0; }
    .form-actions { display: flex; gap: 8px; margin-top: 16px; }
    .error-msg { margin-top: 12px; padding: 8px 12px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; font-size: 12px; color: #DC2626; }

    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .summary-item { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; background: #F8FAFC; border-radius: 8px; }
    .summary-label { font-size: 11px; font-weight: 500; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.4px; }
    .summary-value { font-size: 18px; font-weight: 700; color: #0F172A; }
    .summary-hint { margin: 12px 0 0; font-size: 12px; color: #64748B; }

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
    .btn-toggle { background: #FFFFFF; border-color: #D1D5DB; color: #1E293B; }
    .btn-toggle:hover:not(:disabled) { background: #F8FAFC; }
    .btn-danger { background: #FFFFFF; border-color: #FECACA; color: #B91C1C; }
    .btn-danger:hover:not(:disabled) { background: #FEE2E2; }

    .loading-state, .error-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 40px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class CategoryPanelComponent implements OnInit, OnDestroy {
  readonly categoriesService = inject(IssueObjectCategoriesService);
  readonly objectsService = inject(IssueObjectsService);
  readonly selection = inject(RepositorySelectionService);

  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly editMode = signal<boolean>(false);

  readonly category = signal<IssueObjectCategory | null>(null);

  // Reactive Forms: react to ALL input events (paste / autofill included).
  readonly form: FormGroup<{
    name: FormControl<string>;
    sortOrder: FormControl<number>;
    isActive: FormControl<boolean>;
  }> = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    sortOrder: new FormControl<number>(0, { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  private loadedId: string | null = null;

  readonly canSave = computed(() => {
    this.formStatus();
    this.formValue();
    if (this.saving()) return false;
    return this.form.valid;
  });

  readonly childCategoryCount = computed(() => {
    const cat = this.category();
    if (!cat) return 0;
    return this.countChildrenInTree(this.objectsService.tree(), cat.id, 'category');
  });

  readonly childObjectCount = computed(() => {
    const cat = this.category();
    if (!cat) return 0;
    return this.countChildrenInTree(this.objectsService.tree(), cat.id, 'object');
  });

  readonly hasActiveChildren = computed(() => {
    const cat = this.category();
    if (!cat) return false;
    const children = this.findDirectChildren(this.objectsService.tree(), cat.id);
    return children.some(c => c.is_active);
  });

  readonly parentLabel = computed(() => {
    const cat = this.category();
    if (!cat || !cat.parent_id) return '';
    const found = this.selection.findCategoryInTree(this.objectsService.tree(), cat.parent_id);
    return found && found.type === 'category' ? found.name : '';
  });

  constructor() {
    effect(() => {
      const id = this.selection.selectedCategoryId();
      if (id && id !== this.loadedId) {
        this.loadedId = id;
        this.editMode.set(false);
        void this.loadCategory(id);
      } else if (!id) {
        this.loadedId = null;
        this.category.set(null);
      }
    });
  }

  ngOnInit(): void {
    const id = this.selection.selectedCategoryId();
    if (id) {
      this.loadedId = id;
      void this.loadCategory(id);
    }
  }

  ngOnDestroy(): void {
    this.loadedId = null;
  }

  toggleEdit(): void {
    if (this.editMode()) {
      this.onCancelEdit();
    } else {
      const cat = this.category();
      if (cat) {
        this.form.patchValue({
          name: cat.name ?? '',
          sortOrder: cat.sort_order ?? 0,
          isActive: !!cat.is_active,
        }, { emitEvent: false });
      }
      this.editMode.set(true);
    }
  }

  onCancelEdit(): void {
    this.editMode.set(false);
    this.categoriesService.error.set(null);
  }

  async onSave(): Promise<void> {
    if (!this.form.valid) return;
    const cat = this.category();
    if (!cat) return;
    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      const payload: IssueObjectCategoryUpdatePayload = {
        name: v.name.trim(),
        sort_order: v.sortOrder,
        is_active: v.isActive,
      };
      const result = await this.categoriesService.updateCategory(cat.id, payload);
      if (result) {
        this.category.set(result);
        this.editMode.set(false);
        await this.objectsService.loadTree({ include_inactive: true, include_deleted: false });
      }
    } catch {
      // error handled in service
    } finally {
      this.saving.set(false);
    }
  }

  async onToggleActive(): Promise<void> {
    const cat = this.category();
    if (!cat) return;
    this.saving.set(true);
    try {
      const payload: IssueObjectCategoryUpdatePayload = { is_active: !cat.is_active };
      const result = await this.categoriesService.updateCategory(cat.id, payload);
      if (result) {
        this.category.set(result);
        this.form.patchValue({ isActive: !!result.is_active }, { emitEvent: false });
        await this.objectsService.loadTree({ include_inactive: true, include_deleted: false });
      }
    } catch {
      // error handled in service
    } finally {
      this.saving.set(false);
    }
  }

  async onDelete(): Promise<void> {
    const cat = this.category();
    if (!cat) return;
    if (!confirm(`Удалить категорию «${cat.name}»?`)) return;
    this.saving.set(true);
    try {
      await this.categoriesService.deleteCategory(cat.id);
      this.selection.clear();
      await this.objectsService.loadTree({ include_inactive: true, include_deleted: false });
    } catch {
      // error handled in service
    } finally {
      this.saving.set(false);
    }
  }

  private async loadCategory(id: string): Promise<void> {
    this.loading.set(true);
    const result = await this.categoriesService.getCategory(id);
    if (result) {
      this.category.set(result);
      this.form.patchValue({
        name: result.name ?? '',
        sortOrder: result.sort_order ?? 0,
        isActive: !!result.is_active,
      }, { emitEvent: false });
    }
    this.loading.set(false);
  }

  private countChildrenInTree(nodes: IssueRepositoryTreeNode[], parentId: string, type: 'category' | 'object'): number {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'object' && node.category_id === parentId && type === 'object') {
        count++;
      } else if (node.type === 'category' && node.parent_id === parentId && type === 'category') {
        count++;
      }
    }
    for (const node of nodes) {
      if (node.type === 'category' && node.children) {
        count += this.countChildrenInTree(node.children, parentId, type);
      }
    }
    return count;
  }

  private findDirectChildren(nodes: IssueRepositoryTreeNode[], parentId: string): IssueRepositoryTreeNode[] {
    const result: IssueRepositoryTreeNode[] = [];
    for (const node of nodes) {
      if (node.type === 'category' && node.parent_id === parentId) {
        result.push(node);
      } else if (node.type === 'object' && node.category_id === parentId) {
        result.push(node);
      }
    }
    for (const node of nodes) {
      if (node.type === 'category' && node.children) {
        result.push(...this.findDirectChildren(node.children, parentId));
      }
    }
    return result;
  }
}
