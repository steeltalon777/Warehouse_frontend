import { Component, OnInit, OnDestroy, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { IssueObjectCategoriesService } from '../../../../core/services/issue-object-categories.service';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import {
  IssueObjectCategory,
  IssueObjectCategoryCreatePayload,
  IssueRepositoryTreeNode,
} from '../../../../core/models/issue-objects.models';
import { RepositorySelectionService } from '../../services/repository-selection.service';

@Component({
  selector: 'app-new-category-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="new-category">
      <div class="panel-header">
        <div class="header-info">
          <h2 class="panel-title">Новая категория выдачи</h2>
          <p class="panel-subtitle">Заполните данные и сохраните</p>
        </div>
      </div>
      <div class="panel-body">
        <div class="wh-card form-card" [formGroup]="form">
          <div class="form-row">
            <label class="form-label">Наименование *</label>
            <input
              type="text"
              class="wh-form-input input"
              formControlName="name"
              placeholder="Введите наименование категории"
            />
          </div>
          <div class="form-row form-row--split">
            <div class="form-col">
              <label class="form-label">Родительская категория</label>
              <select class="wh-form-input input" formControlName="parentId">
                <option value="">— корневая</option>
                @for (cat of parentOptions(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
            </div>
            <div class="form-col">
              <label class="form-label">Порядок сортировки</label>
              <input
                type="number"
                class="wh-form-input input"
                formControlName="sortOrder"
              />
            </div>
          </div>
          <div class="form-row">
            <label class="checkbox-row">
              <input type="checkbox" formControlName="isActive" />
              <span>Активна</span>
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCancel()">Отмена</button>
            <button
              type="button"
              class="wh-btn wh-btn--primary btn btn-primary"
              [disabled]="!canSave()"
              (click)="onSave()">
              {{ categoriesService.isSaving() ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>
          @if (categoriesService.error(); as err) {
            <div class="error-msg">{{ err }}</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .new-category { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #F8FAFC; }

    .panel-header { flex-shrink: 0; padding: 14px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .panel-title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0; }
    .panel-subtitle { font-size: 12px; color: #64748B; margin: 2px 0 0; }

    .panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; min-height: 0; }
    .wh-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; }

    .form-row { margin-bottom: 14px; }
    .form-row--split { display: flex; gap: 12px; }
    .form-col { flex: 1; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px; }
    .input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; box-sizing: border-box; }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .checkbox-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #1F2937; cursor: pointer; }
    .checkbox-row input { margin: 0; }
    .form-actions { display: flex; gap: 8px; margin-top: 16px; }
    .error-msg { margin-top: 12px; padding: 8px 12px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; font-size: 12px; color: #DC2626; }

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
  `]
})
export class NewCategoryFormComponent implements OnInit, OnDestroy {
  readonly categoriesService = inject(IssueObjectCategoriesService);
  readonly objectsService = inject(IssueObjectsService);
  readonly selection = inject(RepositorySelectionService);

  // Reactive Forms: react to ALL input events (paste / autofill included).
  readonly form: FormGroup<{
    name: FormControl<string>;
    parentId: FormControl<string>;
    sortOrder: FormControl<number>;
    isActive: FormControl<boolean>;
  }> = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    parentId: new FormControl<string>('', { nonNullable: true }),
    sortOrder: new FormControl<number>(0, { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly canSave = computed(() => {
    this.formStatus();
    this.formValue();
    if (this.categoriesService.isSaving()) return false;
    return this.form.valid;
  });

  readonly parentOptions = computed<IssueObjectCategory[]>(() => {
    return this.flattenCategories(this.objectsService.tree());
  });

  constructor() {
    effect(() => {
      const flag = this.selection.createFlag();
      if (flag === 'new-category') {
        this.reset();
      }
    });
  }

  ngOnInit(): void {
    if (this.selection.createFlag() === 'new-category') {
      this.reset();
    }
  }

  ngOnDestroy(): void {
    // nothing to clean up — toSignal handles subscription teardown
  }

  onCancel(): void {
    this.selection.clearCreateFlag();
    this.categoriesService.error.set(null);
  }

  async onSave(): Promise<void> {
    if (!this.form.valid) return;
    const v = this.form.getRawValue();
    const payload: IssueObjectCategoryCreatePayload = {
      name: v.name.trim(),
      parent_id: v.parentId || null,
      sort_order: v.sortOrder,
      is_active: v.isActive,
    };
    try {
      const result = await this.categoriesService.createCategory(payload);
      if (result) {
        this.selection.clearCreateFlag();
        this.selection.selectCategory(result.id);
        await this.objectsService.loadTree({ include_inactive: true, include_deleted: false });
      }
    } catch {
      // error handled in service
    }
  }

  private reset(): void {
    this.form.reset({
      name: '',
      parentId: '',
      sortOrder: 0,
      isActive: true,
    });
  }

  private flattenCategories(nodes: IssueRepositoryTreeNode[]): IssueObjectCategory[] {
    const result: IssueObjectCategory[] = [];
    const visit = (list: IssueRepositoryTreeNode[]): void => {
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
