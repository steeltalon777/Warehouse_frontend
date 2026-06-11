import { Component, output, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { OperationInlineItemDraftVm } from '../../../../core/models/operations.models';
import { CatalogSearchService, CatalogSearchUnit, CatalogSearchCategory } from '../../../../core/services/catalog-search.service';

function generateClientKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `inline-${crypto.randomUUID()}`;
  }
  return `inline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

@Component({
  selector: 'app-inline-item-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h2>Создание ТМЦ</h2>
          <button class="btn-close" aria-label="Закрыть" (click)="cancel.emit()">×</button>
        </div>

        <div class="modal-body">
          <p class="helper-text">
            Позиция будет добавлена в черновик операции. Постоянная ТМЦ появится в справочнике после подтверждения операции.
          </p>

          <div class="form-fields">
            <!-- Название -->
            <div class="field-row">
              <label>Название <span class="required">*</span></label>
              <input
                type="text"
                class="input"
                [ngModel]="name()"
                (ngModelChange)="onNameChange($event)"
                placeholder="Введите название ТМЦ"
                maxlength="255"
              />
              @if (fieldErrors()['name']) {
                <span class="field-error">{{ fieldErrors()['name'] }}</span>
              }
            </div>

            <!-- SKU / артикул -->
            <div class="field-row">
              <label>SKU / артикул</label>
              <input
                type="text"
                class="input"
                [ngModel]="sku()"
                (ngModelChange)="onSkuChange($event)"
                placeholder="Введите артикул"
              />
            </div>

            <!-- Ед. изм. -->
            <div class="field-row">
              <label>Ед. изм. <span class="required">*</span></label>
              <div class="search-field">
                <input
                  type="text"
                  class="input"
                  [ngModel]="unitQuery()"
                  (ngModelChange)="onUnitQueryChange($event)"
                  placeholder="Поиск единицы измерения..."
                  [disabled]="!!unitId()"
                />
                @if (unitId()) {
                  <div class="selected-chip">
                    <span class="chip-label">{{ unitName() }}</span>
                    <button class="chip-clear" (click)="clearUnit()" title="Очистить">×</button>
                  </div>
                }
                @if (isUnitSearching()) {
                  <div class="search-status">Поиск...</div>
                }
                @if (unitResults().length > 0 && !unitId()) {
                  <div class="search-dropdown">
                    @for (u of unitResults(); track u.id) {
                      <button class="dropdown-item" (click)="selectUnit(u)">
                        <span class="item-title">{{ u.name }} ({{ u.symbol }})</span>
                      </button>
                    }
                  </div>
                }
              </div>
              @if (fieldErrors()['unitId']) {
                <span class="field-error">{{ fieldErrors()['unitId'] }}</span>
              }
            </div>

            <!-- Категория -->
            <div class="field-row">
              <label>Категория</label>
              <div class="search-field">
                <input
                  type="text"
                  class="input"
                  [ngModel]="categoryQuery()"
                  (ngModelChange)="onCategoryQueryChange($event)"
                  placeholder="Поиск категории..."
                  [disabled]="!!categoryId()"
                />
                @if (categoryId()) {
                  <div class="selected-chip">
                    <span class="chip-label">{{ categoryName() }}</span>
                    <button class="chip-clear" (click)="clearCategory()" title="Очистить">×</button>
                  </div>
                }
                @if (isCategorySearching()) {
                  <div class="search-status">Поиск...</div>
                }
                @if (categoryResults().length > 0 && !categoryId()) {
                  <div class="search-dropdown">
                    @for (c of categoryResults(); track c.id) {
                      <button class="dropdown-item" (click)="selectCategory(c)">
                        <span class="item-title">{{ c.name }}</span>
                        <span class="item-subtitle">{{ c.path }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Описание -->
            <div class="field-row">
              <label>Описание</label>
              <textarea
                class="input textarea"
                rows="3"
                [ngModel]="description()"
                (ngModelChange)="onDescriptionChange($event)"
                placeholder="Введите описание"
              ></textarea>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="footer-actions">
            <button class="btn btn-secondary" (click)="cancel.emit()">Отмена</button>
            <button
              class="btn btn-primary"
              [disabled]="!canSubmit()"
              (click)="onCreate()"
            >
              Создать и добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      padding: 20px;
    }
    .modal-container {
      background: #FFFFFF;
      border-radius: 12px;
      width: 100%;
      max-width: 900px;
      max-height: min(1024px, calc(100vh - 32px));
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #E2E8F0;
    }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }
    .btn-close {
      width: 32px; height: 32px;
      border: none; background: transparent;
      font-size: 22px; color: #94A3B8;
      cursor: pointer; border-radius: 6px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .btn-close:hover { background: #F1F5F9; color: #374151; }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .helper-text {
      margin: 0 0 16px 0;
      font-size: 12px;
      color: #64748B;
      line-height: 1.5;
    }
    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .field-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field-row label {
      font-size: 12px;
      font-weight: 500;
      color: #64748B;
    }
    .required { color: #DC2626; }

    .input {
      width: 100%;
      height: 36px;
      padding: 0 10px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      background: #FFFFFF;
      color: #1F2937;
      box-sizing: border-box;
    }
    .input:disabled {
      background: #F8FAFC;
      color: #64748B;
      cursor: not-allowed;
    }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .textarea { height: auto; padding: 8px 10px; resize: vertical; }

    .field-error {
      font-size: 12px;
      color: #DC2626;
      margin-top: 2px;
    }

    .search-field { position: relative; }
    .search-status {
      font-size: 11px;
      color: #94A3B8;
      margin-top: 4px;
    }
    .search-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #FFFFFF;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      max-height: 240px;
      overflow-y: auto;
      z-index: 10;
      margin-top: 4px;
    }
    .dropdown-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }
    .dropdown-item:hover { background: #F8FAFC; }
    .dropdown-item + .dropdown-item { border-top: 1px solid #E2E8F0; }
    .item-title { font-size: 13px; font-weight: 500; color: #1F2937; }
    .item-subtitle { font-size: 11px; color: #94A3B8; }

    .selected-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      padding: 4px 10px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 6px;
      font-size: 12px;
      color: #1E3A8A;
      max-width: fit-content;
    }
    .chip-label { font-weight: 500; }
    .chip-clear {
      width: 16px; height: 16px;
      border: none; background: transparent;
      cursor: pointer; color: #64748B;
      font-size: 14px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      line-height: 1;
    }
    .chip-clear:hover { color: #DC2626; }

    .modal-footer {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 12px 20px;
      border-top: 1px solid #E2E8F0;
    }
    .footer-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px; height: 36px; padding: 0 14px;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
      border: 1px solid transparent; font-family: inherit;
      white-space: nowrap;
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
  `]
})
export class InlineItemCreateModalComponent implements OnInit, OnDestroy {
  cancel = output<void>();
  create = output<OperationInlineItemDraftVm>();

  // State signals
  readonly name = signal('');
  readonly sku = signal('');
  readonly unitId = signal('');
  readonly unitName = signal('');
  readonly categoryId = signal('');
  readonly categoryName = signal('');
  readonly description = signal('');
  readonly unitQuery = signal('');
  readonly categoryQuery = signal('');
  readonly unitResults = signal<CatalogSearchUnit[]>([]);
  readonly categoryResults = signal<CatalogSearchCategory[]>([]);
  readonly isUnitSearching = signal(false);
  readonly isCategorySearching = signal(false);
  readonly fieldErrors = signal<Record<string, string>>({});

  // Computed
  readonly isValid = computed(() => {
    const n = this.name().trim();
    return n.length > 0 && n.length <= 255 && this.unitId().length > 0;
  });
  readonly canSubmit = this.isValid;

  private readonly catalogSearch = inject(CatalogSearchService);
  private readonly destroy$ = new Subject<void>();
  private readonly unitQuery$ = new Subject<string>();
  private readonly categoryQuery$ = new Subject<string>();

  ngOnInit(): void {
    // Unit search debounce
    this.unitQuery$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.performUnitSearch(query);
    });

    // Category search debounce
    this.categoryQuery$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.performCategorySearch(query);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Name ──────────────────────────────────────────────────────
  onNameChange(value: string): void {
    this.name.set(value);
    this.clearFieldError('name');
  }

  // ─── SKU ─────────────────────────────────────────────────────────
  onSkuChange(value: string): void {
    this.sku.set(value);
  }

  // ─── Unit search & selection ────────────────────────────────────
  onUnitQueryChange(value: string): void {
    this.unitQuery.set(value);
    this.unitQuery$.next(value);
  }

  private performUnitSearch(query: string): void {
    if (!query || query.trim().length < 1) {
      this.unitResults.set([]);
      return;
    }
    this.isUnitSearching.set(true);
    this.catalogSearch.searchUnitsOnce(query, 20).pipe(
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.unitResults.set(results);
      this.isUnitSearching.set(false);
    });
  }

  selectUnit(unit: CatalogSearchUnit): void {
    this.unitId.set(String(unit.id));
    this.unitName.set(`${unit.name} (${unit.symbol})`);
    this.unitQuery.set('');
    this.unitResults.set([]);
    this.clearFieldError('unitId');
  }

  clearUnit(): void {
    this.unitId.set('');
    this.unitName.set('');
    this.unitQuery.set('');
    this.unitResults.set([]);
  }

  // ─── Category search & selection ──────────────────────────────
  onCategoryQueryChange(value: string): void {
    this.categoryQuery.set(value);
    this.categoryQuery$.next(value);
  }

  private performCategorySearch(query: string): void {
    if (!query || query.trim().length < 1) {
      this.categoryResults.set([]);
      return;
    }
    this.isCategorySearching.set(true);
    this.catalogSearch.searchCategoriesOnce(query, 20).pipe(
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.categoryResults.set(results);
      this.isCategorySearching.set(false);
    });
  }

  selectCategory(category: CatalogSearchCategory): void {
    this.categoryId.set(String(category.id));
    this.categoryName.set(category.path || category.name);
    this.categoryQuery.set('');
    this.categoryResults.set([]);
  }

  clearCategory(): void {
    this.categoryId.set('');
    this.categoryName.set('');
    this.categoryQuery.set('');
    this.categoryResults.set([]);
  }

  // ─── Description ───────────────────────────────────────────────
  onDescriptionChange(value: string): void {
    this.description.set(value);
  }

  // ─── Validation & submit ────────────────────────────────────────
  private validate(): boolean {
    const errors: Record<string, string> = {};
    const n = this.name().trim();
    if (!n) {
      errors['name'] = 'Название обязательно';
    } else if (n.length > 255) {
      errors['name'] = 'Название не должно превышать 255 символов';
    }
    if (!this.unitId()) {
      errors['unitId'] = 'Выберите единицу измерения';
    }
    this.fieldErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private clearFieldError(field: string): void {
    this.fieldErrors.update(current => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  onCreate(): void {
    if (!this.validate()) {
      return;
    }
    const payload: OperationInlineItemDraftVm = {
      clientKey: generateClientKey(),
      name: this.name().trim(),
      sku: this.sku().trim() || null,
      unitId: this.unitId(),
      unitName: this.unitName(),
      categoryId: this.categoryId() || null,
      categoryName: this.categoryName() || null,
      description: this.description().trim() || null,
      hashtags: null,
    };
    this.create.emit(payload);
  }

}
