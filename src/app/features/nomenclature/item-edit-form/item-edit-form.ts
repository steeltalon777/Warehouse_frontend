import { Component, ElementRef, inject, input, output, signal, computed, SimpleChanges, viewChild, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item, Unit, Category } from '../../../core/models/nomenclature.models';
import { AuthContextService } from '../../../core/services/auth-context.service';
import { BffApiService } from '../../../core/api/bff-api.service';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, catchError } from 'rxjs/operators';

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
          <label class="form-label">SKU</label>
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
          <div class="combobox" (focusin)="openUnitDropdown()" (focusout)="closeUnitDropdownSoon()">
            <div class="combobox-input-wrap">
              <input
                type="text"
                class="wh-form-input form-input combobox-input"
                [value]="unitQuery()"
                (input)="onUnitQueryChange(($any($event.target)).value)"
                (focus)="openUnitDropdown()"
                placeholder="Введите единицу измерения"
                autocomplete="off"
                data-testid="unit-combobox-input"
              />
              @if (draft.unitId || unitQuery()) {
                <button class="combobox-clear" type="button" (mousedown)="clearUnit($event)" aria-label="Очистить единицу измерения" data-testid="unit-combobox-clear">×</button>
              }
            </div>
            @if (isUnitDropdownOpen()) {
              <div class="combobox-dropdown" data-testid="unit-combobox-dropdown">
                @if (filteredUnits().length) {
                  @for (u of filteredUnits(); track u.id) {
                    <button class="combobox-option" type="button" (mousedown)="selectUnit(u, $event)" [attr.data-testid]="'unit-option-' + u.id">
                      {{ formatUnitLabel(u) }}
                    </button>
                  }
                } @else {
                  <div class="combobox-empty">Ничего не найдено</div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Категория -->
        <div class="form-group full">
          <label class="form-label">Категория</label>
          <div class="combobox" (focusin)="openCategoryDropdown()" (focusout)="closeCategoryDropdownSoon()">
            <div class="combobox-input-wrap">
              <input
                type="text"
                class="wh-form-input form-input combobox-input"
                [value]="categoryQuery()"
                (input)="onCategoryQueryChange(($any($event.target)).value)"
                (focus)="openCategoryDropdown()"
                placeholder="Без категории"
                autocomplete="off"
                data-testid="category-combobox-input"
              />
              @if (draft.categoryId || categoryQuery()) {
                <button class="combobox-clear" type="button" (mousedown)="clearCategory($event)" aria-label="Очистить категорию" data-testid="category-combobox-clear">×</button>
              }
            </div>
            @if (isCategoryDropdownOpen()) {
              <div class="combobox-dropdown" data-testid="category-combobox-dropdown">
                <button class="combobox-option combobox-option--placeholder" type="button" (mousedown)="clearCategory($event)" data-testid="category-option-none">
                  Без категории
                </button>
                @if (filteredCategories().length) {
                  @for (c of filteredCategories(); track c.id) {
                    <button class="combobox-option combobox-option--stacked" type="button" (mousedown)="selectCategory(c, $event)" [attr.data-testid]="'category-option-' + c.id">
                      <span>{{ c.name }}</span>
                      @if (c.pathLabel) {
                        <span class="combobox-meta">{{ c.pathLabel }}</span>
                      }
                    </button>
                  }
                } @else {
                  <div class="combobox-empty">Ничего не найдено</div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Ключевые слова -->
        <div class="form-group full">
          <label class="form-label">Ключевые слова</label>
          <div class="tags-input" (click)="focusHashtagInput()">
            @for (tag of draft.hashtags; track tag) {
              <span class="tag-chip">
                <span>{{ tag }}</span>
                <button type="button" class="tag-chip-remove" (click)="removeHashtag(tag)" [attr.aria-label]="'Удалить тег ' + tag">×</button>
              </span>
            }
            <input
              #hashtagInputRef
              type="text"
              class="tag-input"
              [(ngModel)]="hashtagInput"
              (keydown.enter)="onHashtagEnter($event)"
              placeholder="Введите тег и нажмите Enter"
            />
          </div>
          <div class="form-hint">До 20 тегов, 1-50 символов: буквы, цифры, дефис и пробел.</div>
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
        @if (canMerge()) {
          <button class="wh-btn wh-btn--warning btn btn-warning" (click)="onMerge()" type="button" title="Слияние с другой ТМЦ">
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
    .form-hint {
      font-size: 12px;
      color: #6B7280;
    }
    .combobox {
      position: relative;
    }
    .combobox-input-wrap {
      position: relative;
    }
    .combobox-input {
      padding-right: 36px;
      width: 100%;
    }
    .combobox-clear {
      position: absolute;
      top: 50%;
      right: 10px;
      transform: translateY(-50%);
      border: 0;
      background: transparent;
      color: #6B7280;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      width: 20px;
      height: 20px;
    }
    .combobox-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 20;
      background: #FFFFFF;
      border: 1px solid #D1D5DB;
      border-radius: 10px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
      max-height: 240px;
      overflow-y: auto;
      padding: 4px;
    }
    .combobox-option {
      width: 100%;
      border: 0;
      background: transparent;
      text-align: left;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      color: #111827;
      font-size: 13px;
      display: block;
    }
    .combobox-option:hover {
      background: #EFF6FF;
    }
    .combobox-option--placeholder {
      color: #2563EB;
      font-weight: 500;
    }
    .combobox-option--stacked {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .combobox-meta {
      color: #6B7280;
      font-size: 12px;
    }
    .combobox-empty {
      padding: 10px 12px;
      color: #6B7280;
      font-size: 13px;
    }
    .tags-input {
      min-height: 40px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      padding: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      background: #FFFFFF;
    }
    .tags-input:focus-within {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .tag-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 999px;
      background: #EFF6FF;
      color: #1D4ED8;
      font-size: 12px;
    }
    .tag-chip-remove {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
    }
    .tag-input {
      flex: 1 1 180px;
      min-width: 140px;
      border: 0;
      outline: none;
      font: inherit;
      color: #111827;
      background: transparent;
      padding: 4px 6px;
    }
    .tag-input::placeholder {
      color: #9CA3AF;
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
export class ItemEditFormComponent implements OnDestroy {
  private readonly authContextService = inject(AuthContextService);
  private readonly bffApi = inject(BffApiService);
  private readonly categorySearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly item = input.required<Item>();
  readonly units = input<Unit[]>([]);
  readonly categories = input<Category[]>([]);
  readonly hashtagInputRef = viewChild<ElementRef<HTMLInputElement>>('hashtagInputRef');

  readonly saveDraft = output<{ id: string; payload: Record<string, unknown> }>();
  readonly resetDraft = output<void>();
  readonly deactivate = output<string>();
  readonly delete = output<string>();
  readonly mergeRequest = output<string>();

  readonly formError = signal<string | null>(null);
  readonly isUnitDropdownOpen = signal(false);
  readonly isCategoryDropdownOpen = signal(false);

  readonly canMerge = computed(() => {
    const auth = this.authContextService.authContext();
    const role = auth?.role ?? 'observer';
    const isManager = role === 'root' || role === 'chief_storekeeper';
    const it = this.item();
    return isManager && !!it && it.is_active;
  });

  // Plain object for ngModel (signals don't work with ngModel property binding)
  draft = {
    name: '',
    sku: '',
    unitId: '',
    categoryId: '',
    hashtags: [] as string[],
    description: '',
    isActive: true,
  };

  readonly unitQuery = signal('');
  readonly categoryQuery = signal('');
  hashtagInput = '';
  readonly filteredUnits = computed(() => this.computeFilteredUnits());
  readonly filteredCategories = computed(() => this.computeFilteredCategories());
  readonly remoteCategoryResults = signal<{ id: string; name: string; pathLabel: string; searchText: string }[]>([]);

  // Flat categories are used as a safe local fallback for searchable category selection.
  readonly flatCategories = computed(() => {
    const result: { id: string; name: string; pathLabel: string; searchText: string }[] = [];
    const walk = (cats: Category[], ancestors: string[]) => {
      for (const c of cats) {
        const path = [...ancestors, c.name];
        result.push({
          id: c.id,
          name: c.name,
          pathLabel: ancestors.join(' / '),
          searchText: path.join(' ').toLowerCase(),
        });
        if (c.children) walk(c.children, path);
      }
    };
    walk(this.categories(), []);
    return result;
  });

  private computeFilteredUnits(): Unit[] {
    const query = this.getEffectiveUnitSearchQuery();
    if (!query) {
      return this.units().slice(0, 50);
    }
    return this.units()
      .filter(unit => `${unit.name} ${unit.symbol}`.toLowerCase().includes(query))
      .slice(0, 50);
  }

  private computeFilteredCategories() {
    const query = this.getEffectiveCategorySearchQuery();
    if (!query) {
      return this.flatCategories().slice(0, 50);
    }
    if (query.length >= 2 && this.remoteCategoryResults().length > 0) {
      const remoteIds = new Set(this.remoteCategoryResults().map(r => r.id));
      const localMatches = this.flatCategories()
        .filter(category => !remoteIds.has(category.id) && category.searchText.includes(query));
      return [...this.remoteCategoryResults(), ...localMatches].slice(0, 50);
    }
    return this.flatCategories()
      .filter(category => category.searchText.includes(query))
      .slice(0, 50);
  }

  constructor() {
    this.categorySearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of({ items: [] as Array<Record<string, unknown>> });
        }
        return this.bffApi.getData<{ items?: Array<Record<string, unknown>> }>('/catalog/search/categories', { q: query, limit: 20 }).pipe(
          catchError(() => of({ items: [] as Array<Record<string, unknown>> }))
        );
      }),
    ).subscribe(result => {
      const items = result?.items ?? [];
      this.remoteCategoryResults.set(items.map(item => {
        const name = String(item['name'] ?? '');
        const pathLabel = String(item['path_label'] ?? item['path'] ?? '');
        return {
          id: String(item['id'] ?? ''),
          name,
          pathLabel,
          searchText: `${pathLabel} ${name}`.toLowerCase(),
        };
      }));
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isValid(): boolean {
    const d = this.draft;
    return !!(d.name.trim().length > 0 && d.unitId);
  }

  private isLocalRef(id: string, entityType: 'category' | 'unit'): boolean {
    return id.startsWith(`${entityType}-tmp-`);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['item']) {
      const it = this.item();
      if (!it) return;
      this.draft = {
        name: it.name,
        sku: it.sku,
        unitId: it.unit_id,
        categoryId: it.category_id ?? '',
        hashtags: [...it.hashtags],
        description: '',
        isActive: it.is_active,
      };
      this.syncQueriesFromDraft();
      this.hashtagInput = '';
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
    const normalizedSku = d.sku.trim();
    const payload: Record<string, unknown> = {
      name: d.name.trim(),
      sku: normalizedSku || null,
      hashtags: [...d.hashtags],
      is_active: d.isActive,
    };

    if (this.isLocalRef(d.unitId, 'unit')) {
      payload['unit_local_id'] = d.unitId;
    } else {
      payload['unit_id'] = d.unitId;
    }

    if (!d.categoryId) {
      payload['category_id'] = null;
    } else if (this.isLocalRef(d.categoryId, 'category')) {
      payload['category_local_id'] = d.categoryId;
    } else {
      payload['category_id'] = d.categoryId;
    }

    this.saveDraft.emit({
      id: it?.id ?? '__new__',
      payload,
    });
    this.formError.set(null);
  }

  onReset(): void {
    const it = this.item();
    if (!it) {
      this.draft = { name: '', sku: '', unitId: '', categoryId: '', hashtags: [], description: '', isActive: true };
      this.unitQuery.set('');
      this.categoryQuery.set('');
      this.hashtagInput = '';
      this.formError.set(null);
      this.resetDraft.emit();
      return;
    }
    this.draft = {
      name: it.name,
      sku: it.sku,
      unitId: it.unit_id,
      categoryId: it.category_id ?? '',
      hashtags: [...it.hashtags],
      description: '',
      isActive: it.is_active,
    };
    this.syncQueriesFromDraft();
    this.hashtagInput = '';
    this.formError.set(null);
    this.resetDraft.emit();
  }

  openUnitDropdown(): void {
    this.isUnitDropdownOpen.set(true);
  }

  openCategoryDropdown(): void {
    this.isCategoryDropdownOpen.set(true);
  }

  closeUnitDropdownSoon(): void {
    setTimeout(() => this.isUnitDropdownOpen.set(false), 120);
  }

  closeCategoryDropdownSoon(): void {
    setTimeout(() => this.isCategoryDropdownOpen.set(false), 120);
  }

  onUnitQueryChange(value: string): void {
    this.unitQuery.set(value);
    const selectedLabel = this.getUnitLabel(this.draft.unitId);
    if (selectedLabel !== value) {
      this.draft.unitId = '';
    }
    this.isUnitDropdownOpen.set(true);
  }

  onCategoryQueryChange(value: string): void {
    this.categoryQuery.set(value);
    const selectedLabel = this.getCategoryLabel(this.draft.categoryId);
    if (selectedLabel !== value) {
      this.draft.categoryId = '';
    }
    const query = this.getEffectiveCategorySearchQuery();
    if (query.length >= 2) {
      this.categorySearch$.next(query);
    } else {
      this.remoteCategoryResults.set([]);
    }
    this.isCategoryDropdownOpen.set(true);
  }

  selectUnit(unit: Unit, event?: Event): void {
    event?.preventDefault();
    this.draft.unitId = unit.id;
    this.unitQuery.set(this.formatUnitLabel(unit));
    this.isUnitDropdownOpen.set(false);
    this.formError.set(null);
  }

  selectCategory(category: { id: string; name: string; pathLabel: string }, event?: Event): void {
    event?.preventDefault();
    this.draft.categoryId = category.id;
    this.categoryQuery.set(this.getCategoryDisplayLabel(category.name, category.pathLabel));
    this.isCategoryDropdownOpen.set(false);
    this.remoteCategoryResults.set([]);
  }

  clearUnit(event?: Event): void {
    event?.preventDefault();
    this.draft.unitId = '';
    this.unitQuery.set('');
    this.isUnitDropdownOpen.set(false);
  }

  clearCategory(event?: Event): void {
    event?.preventDefault();
    this.draft.categoryId = '';
    this.categoryQuery.set('');
    this.isCategoryDropdownOpen.set(false);
    this.remoteCategoryResults.set([]);
  }

  formatUnitLabel(unit: Unit): string {
    return unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name;
  }

  onHashtagEnter(event: Event): void {
    event.preventDefault();
    this.addHashtagFromInput();
  }

  removeHashtag(tag: string): void {
    this.draft.hashtags = this.draft.hashtags.filter(existing => existing !== tag);
    this.formError.set(null);
  }

  focusHashtagInput(): void {
    this.hashtagInputRef()?.nativeElement.focus();
  }

  private syncQueriesFromDraft(): void {
    this.unitQuery.set(this.getUnitLabel(this.draft.unitId));
    this.categoryQuery.set(this.getCategoryLabel(this.draft.categoryId));
  }

  private getEffectiveUnitSearchQuery(): string {
    const rawQuery = this.unitQuery().trim().toLowerCase();
    const selectedLabel = this.getUnitLabel(this.draft.unitId).trim().toLowerCase();
    return this.stripSelectedPrefix(rawQuery, selectedLabel);
  }

  private getEffectiveCategorySearchQuery(): string {
    const rawQuery = this.categoryQuery().trim().toLowerCase();
    const selectedLabel = this.getCategoryLabel(this.draft.categoryId).trim().toLowerCase();
    return this.stripSelectedPrefix(rawQuery, selectedLabel);
  }

  private stripSelectedPrefix(rawQuery: string, selectedLabel: string): string {
    if (!rawQuery) {
      return '';
    }
    if (!selectedLabel) {
      return rawQuery;
    }
    if (rawQuery === selectedLabel) {
      return '';
    }
    if (rawQuery.startsWith(selectedLabel)) {
      return rawQuery.slice(selectedLabel.length).trim();
    }
    return rawQuery;
  }

  private getUnitLabel(unitId: string): string {
    const unit = this.units().find(candidate => candidate.id === unitId);
    return unit ? this.formatUnitLabel(unit) : '';
  }

  private getCategoryLabel(categoryId: string): string {
    if (!categoryId) {
      return '';
    }
    const category = this.flatCategories().find(candidate => candidate.id === categoryId);
    return category ? this.getCategoryDisplayLabel(category.name, category.pathLabel) : '';
  }

  private getCategoryDisplayLabel(name: string, pathLabel: string): string {
    return pathLabel ? `${pathLabel} / ${name}` : name;
  }

  private addHashtagFromInput(): void {
    const raw = this.hashtagInput.trim();
    if (!raw) {
      this.hashtagInput = '';
      return;
    }

    // Split by comma or semicolon for multi-tag entry (e.g. "асус, лаптоп")
    const parts = raw.includes(',') || raw.includes(';')
      ? raw.split(/[,;]+/).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
      : [raw.replace(/\s+/g, ' ')];

    let added = 0;
    const invalidTags: string[] = [];

    for (const tag of parts) {
      if (this.draft.hashtags.length >= 20) {
        this.formError.set('Можно добавить не более 20 тегов.');
        break;
      }
      if (!this.isValidHashtag(tag)) {
        invalidTags.push(tag);
        continue;
      }
      const normalizedKey = this.normalizeHashtagKey(tag);
      if (this.draft.hashtags.some(existing => this.normalizeHashtagKey(existing) === normalizedKey)) {
        continue; // duplicate, silently skip
      }
      this.draft.hashtags = [...this.draft.hashtags, tag];
      added++;
    }

    this.hashtagInput = '';

    if (invalidTags.length > 0) {
      this.formError.set(
        `Неверный формат: «${invalidTags.join('», «')}». Тег: 1-50 символов, буквы/цифры/дефис/пробел.`
      );
    } else {
      this.formError.set(null);
    }
  }

  private isValidHashtag(tag: string): boolean {
    return tag.length >= 1 && tag.length <= 50 && /^[\p{L}\p{N} -]+$/u.test(tag);
  }

  private normalizeHashtagKey(tag: string): string {
    return tag.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  onDeactivate(): void {
    const it = this.item();
    if (!it) return;
    this.deactivate.emit(it.id);
  }

  onDelete(): void {
    const it = this.item();
    if (!it) return;
    this.delete.emit(it.id);
  }

  onMerge(): void {
    const it = this.item();
    if (!it) return;
    this.mergeRequest.emit(it.id);
  }
}
