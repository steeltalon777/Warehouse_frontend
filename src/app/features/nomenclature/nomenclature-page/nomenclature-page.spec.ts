import { computed, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AuthContext, AuthContextService } from '../../../core/services/auth-context.service';
import { CatalogChangeBufferService } from '../../../core/services/catalog-change-buffer.service';
import { NomenclatureService } from '../../../core/services/nomenclature.service';
import { NomenclaturePageComponent } from './nomenclature-page';

describe('NomenclaturePageComponent', () => {
  let routeData: Record<string, unknown>;
  let queryParams: Record<string, unknown>;
  let authState: WritableSignal<AuthContext | null>;
  let serviceMock: any;
  let changeBufferMock: any;
  let authMock: any;

  beforeEach(async () => {
    routeData = { catalogMode: 'readonly' };
    queryParams = {};
    authState = signal<AuthContext | null>(null);

    serviceMock = {
      isLoading: signal(false),
      error: signal<string | null>(null),
      isSaving: signal(false),
      searchQuery: signal(''),
      unifiedTree: signal([]),
      unitListNodes: signal([]),
      visibleNodeCount: signal(0),
      selectedNode: signal(null),
      selectedEntity: signal(null),
      allItems: signal([]),
      units: signal([]),
      allUnits: signal([]),
      allCategories: signal([]),
      loadBootstrap: vi.fn().mockResolvedValue(undefined),
      selectItemById: vi.fn(),
      setSearch: vi.fn(),
      clearSelection: vi.fn(),
      forceShowCategory: vi.fn(),
      selectNode: vi.fn(),
      toggleExpand: vi.fn(),
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
      applyBatch: vi.fn().mockResolvedValue(undefined),
      findCategoryById: vi.fn().mockReturnValue(null),
    };

    changeBufferMock = {
      changes: signal([]),
      addChange: vi.fn(),
      clearAll: vi.fn(),
      setDisabled: vi.fn(),
    };

    authMock = {
      authContext: authState,
      canManageCatalog: computed(() => {
        const authContext = authState();

        if (typeof authContext?.canManageCatalog === 'boolean') {
          return authContext.canManageCatalog;
        }

        const role = authContext?.role;
        return role === 'root' || role === 'chief_storekeeper';
      }),
      load: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [NomenclaturePageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get data() {
                return routeData;
              },
              get queryParams() {
                return queryParams;
              },
            },
          },
        },
        { provide: NomenclatureService, useValue: serviceMock },
        { provide: CatalogChangeBufferService, useValue: changeBufferMock },
        { provide: AuthContextService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('renders readonly catalog mode and clears pending buffer on catalog routes', async () => {
    authState.set({ userId: 'root-user', role: 'root', defaultSiteId: null });

    const fixture = TestBed.createComponent(NomenclaturePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.catalogMode()).toBe('readonly');
    expect(fixture.componentInstance.canWriteCatalog()).toBe(false);
    expect(changeBufferMock.clearAll).toHaveBeenCalledTimes(1);
    expect(changeBufferMock.setDisabled).toHaveBeenLastCalledWith(true);
    expect(fixture.nativeElement.textContent).toContain('Каталог');
    expect(fixture.nativeElement.textContent).toContain('карточка с деталями');
    expect(fixture.nativeElement.textContent).not.toContain('+ Категория');
    expect(fixture.nativeElement.textContent).not.toContain('Применить все');
  });

  it('loads auth context when missing and keeps editable route writable for managers', async () => {
    routeData = { catalogMode: 'editable' };
    authMock.load.mockImplementation(async () => {
      authState.set({ userId: 'chief-user', role: 'chief_storekeeper', defaultSiteId: 'site-1' });
    });

    const fixture = TestBed.createComponent(NomenclaturePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(authMock.load).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.catalogMode()).toBe('editable');
    expect(fixture.componentInstance.canWriteCatalog()).toBe(true);
    expect(changeBufferMock.clearAll).not.toHaveBeenCalled();
    expect(changeBufferMock.setDisabled).toHaveBeenLastCalledWith(false);
    expect(fixture.nativeElement.textContent).toContain('Номенклатура');
    expect(fixture.nativeElement.textContent).toContain('+ Категория');
    expect(fixture.nativeElement.textContent).toContain('Применить все');
    expect(fixture.nativeElement.textContent).toContain('Сбросить');
  });

  it('blocks write handlers in readonly mode even for privileged users', async () => {
    authState.set({ userId: 'root-user', role: 'root', defaultSiteId: null });

    const fixture = TestBed.createComponent(NomenclaturePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onCreateCategory();
    component.onCreateItem();
    component.onCreateUnit();
    component.onSaveDraft({ id: '__new__', payload: { name: 'Should not stage' } });
    component.onDeactivate('cat-1');
    component.onDelete('cat-1');
    component.onMergeRequest('cat-1');
    component.onMergeRequested('category', { sourceId: 'cat-1', targetId: 'cat-2' });
    await component.onApplyAll();
    component.onResetAll();

    expect(serviceMock.clearSelection).not.toHaveBeenCalled();
    expect(changeBufferMock.addChange).not.toHaveBeenCalled();
    expect(serviceMock.applyBatch).not.toHaveBeenCalled();
    expect(changeBufferMock.clearAll).toHaveBeenCalledTimes(1);
    expect(component.createModeEntity()).toBeNull();
    expect(component.mergeItemModal()).toBeNull();
    expect(component.mergeCategoryModal()).toBeNull();
  });

  it('preserves change buffer when applyBatch throws an error', async () => {
    routeData = { catalogMode: 'editable' };
    authState.set({ userId: 'chief-user', role: 'chief_storekeeper', defaultSiteId: 'site-1' });

    serviceMock.applyBatch = vi.fn().mockRejectedValue(new Error('Batch apply failed'));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const fixture = TestBed.createComponent(NomenclaturePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    changeBufferMock.changes.set([
      { localId: '1', entityType: 'category', action: 'create', payload: {} },
    ]);

    await fixture.componentInstance.onApplyAll();

    expect(changeBufferMock.clearAll).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('keeps editable route readonly when explicit catalog permission is false', async () => {
    routeData = { catalogMode: 'editable' };
    authState.set({ userId: 'root-user', role: 'root', defaultSiteId: null, canManageCatalog: false });

    const fixture = TestBed.createComponent(NomenclaturePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.catalogMode()).toBe('editable');
    expect(fixture.componentInstance.canWriteCatalog()).toBe(false);
    expect(changeBufferMock.setDisabled).toHaveBeenLastCalledWith(true);
    expect(fixture.nativeElement.textContent).toContain('Номенклатура');
    expect(fixture.nativeElement.textContent).not.toContain('+ Категория');
    expect(fixture.nativeElement.textContent).not.toContain('Применить все');
  });
});
