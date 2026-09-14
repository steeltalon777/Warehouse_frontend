import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { InlineItemCreateModalComponent } from './inline-item-create-modal.component';
import { CatalogSearchService } from '../../../../core/services/catalog-search.service';
import type { OperationInlineItemDraftVm } from '../../../../core/models/operations.models';

let searchUnitsOnce: ReturnType<typeof vi.fn>;
let searchCategoriesOnce: ReturnType<typeof vi.fn>;

function configureTestBed(): void {
  TestBed.configureTestingModule({
    imports: [InlineItemCreateModalComponent],
    providers: [
      {
        provide: CatalogSearchService,
        useValue: {
          searchUnitsOnce,
          searchCategoriesOnce,
        },
      },
    ],
  });
}

function makeInitial(overrides: Partial<OperationInlineItemDraftVm> = {}): OperationInlineItemDraftVm {
  return {
    clientKey: 'inline-existing',
    name: 'Старое имя',
    sku: 'SKU-X',
    unitId: 'u9',
    unitName: 'кг',
    categoryId: 'c9',
    categoryName: 'Метизы',
    description: 'описание',
    hashtags: ['tag1'],
    ...overrides,
  };
}

describe('InlineItemCreateModalComponent — create mode', () => {
  beforeEach(() => {
    searchUnitsOnce = vi.fn(() => of([]));
    searchCategoriesOnce = vi.fn(() => of([]));
    configureTestBed();
  });

  it('emits create with a generated clientKey and a trimmed name', () => {
    const fixture = TestBed.createComponent(InlineItemCreateModalComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const created: OperationInlineItemDraftVm[] = [];
    component.create.subscribe(payload => created.push(payload));

    component.onNameChange('  Новая ТМЦ  ');
    component.selectUnit({ id: 'u1', name: 'штука', symbol: 'шт' } as any);
    component.onSave();

    expect(created.length).toBe(1);
    expect(created[0].name).toBe('Новая ТМЦ');
    expect(created[0].unitId).toBe('u1');
    expect(created[0].clientKey).toMatch(/^inline-/);
  });

  it('generates a distinct clientKey for every created line', () => {
    const fixture = TestBed.createComponent(InlineItemCreateModalComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    const created: OperationInlineItemDraftVm[] = [];
    component.create.subscribe(payload => created.push(payload));

    component.onNameChange('Одинаковое имя');
    component.selectUnit({ id: 'u1', name: 'штука', symbol: 'шт' } as any);
    component.onSave();
    component.onSave();

    expect(created.length).toBe(2);
    expect(created[0].name).toBe(created[1].name);
    expect(created[0].clientKey).not.toBe(created[1].clientKey);
  });

  it('does not emit without a name or unit', () => {
    const fixture = TestBed.createComponent(InlineItemCreateModalComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const created: OperationInlineItemDraftVm[] = [];
    component.create.subscribe(payload => created.push(payload));

    component.onSave();

    expect(created).toEqual([]);
    expect(component.fieldErrors()['name']).toBeTruthy();
    expect(component.fieldErrors()['unitId']).toBeTruthy();
  });
});

describe('InlineItemCreateModalComponent — edit mode (Stage 2)', () => {
  beforeEach(() => {
    searchUnitsOnce = vi.fn(() => of([]));
    searchCategoriesOnce = vi.fn(() => of([]));
    configureTestBed();
  });

  function createEditFixture(initial: OperationInlineItemDraftVm = makeInitial()) {
    const fixture = TestBed.createComponent(InlineItemCreateModalComponent);
    fixture.componentRef.setInput('initialItem', initial);
    fixture.detectChanges();
    return fixture;
  }

  it('prefills name/unit/category/description and does not preload the default unit', () => {
    const fixture = createEditFixture();
    const component = fixture.componentInstance;

    expect(component.isEditMode()).toBe(true);
    expect(component.name()).toBe('Старое имя');
    expect(component.unitId()).toBe('u9');
    expect(component.unitName()).toBe('кг');
    expect(component.categoryId()).toBe('c9');
    expect(component.categoryName()).toBe('Метизы');
    expect(component.description()).toBe('описание');
    expect(searchUnitsOnce).not.toHaveBeenCalled();
  });

  it('emits update with the same clientKey and never creates a new line', () => {
    const fixture = createEditFixture();
    const component = fixture.componentInstance;

    const updated: OperationInlineItemDraftVm[] = [];
    const created: OperationInlineItemDraftVm[] = [];
    component.update.subscribe(payload => updated.push(payload));
    component.create.subscribe(payload => created.push(payload));

    component.onNameChange('Исправленное имя');
    component.onDescriptionChange('новое описание');
    component.onSave();

    expect(created).toEqual([]);
    expect(updated.length).toBe(1);
    expect(updated[0].clientKey).toBe('inline-existing');
    expect(updated[0].name).toBe('Исправленное имя');
    expect(updated[0].description).toBe('новое описание');
    expect(updated[0].sku).toBe('SKU-X');
    expect(updated[0].hashtags).toEqual(['tag1']);
  });

  it('changes unit and category on the existing payload without touching clientKey', () => {
    const fixture = createEditFixture();
    const component = fixture.componentInstance;
    const updated: OperationInlineItemDraftVm[] = [];
    component.update.subscribe(payload => updated.push(payload));

    component.clearUnit();
    component.selectUnit({ id: 'u2', name: 'килограмм', symbol: 'кг' } as any);
    component.clearCategory();
    component.selectCategory({ id: 'c2', name: 'Метизы', path: 'Материалы / Метизы' } as any);
    component.onSave();

    expect(updated.length).toBe(1);
    expect(updated[0].unitId).toBe('u2');
    expect(updated[0].unitName).toBe('килограмм (кг)');
    expect(updated[0].categoryId).toBe('c2');
    expect(updated[0].categoryName).toBe('Материалы / Метизы');
    expect(updated[0].clientKey).toBe('inline-existing');
  });

  it('blocks saving an empty name without emitting', () => {
    const fixture = createEditFixture();
    const component = fixture.componentInstance;
    const updated: OperationInlineItemDraftVm[] = [];
    component.update.subscribe(payload => updated.push(payload));

    component.onNameChange('   ');
    component.onSave();

    expect(updated).toEqual([]);
    expect(component.fieldErrors()['name']).toBeTruthy();
  });
});
