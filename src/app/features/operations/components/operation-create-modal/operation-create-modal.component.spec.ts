import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { OperationCreateModalComponent } from './operation-create-modal.component';
import { OperationsService } from '../../../../core/services/operations.service';
import { AuthContextService } from '../../../../core/services/auth-context.service';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { DiagnosticsSessionService } from '../../../../core/services/diagnostics-session.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { DraftStorageService } from '../../../../core/services/draft-storage.service';
import { BffApiService } from '../../../../core/api/bff-api.service';
import { CatalogSearchService } from '../../../../core/services/catalog-search.service';
import type { OperationDraftVm, OperationLineDraftVm, BalanceDto } from '../../../../core/models/operations.models';
import type { Item } from '../../../../core/models/nomenclature.models';

function makeDraft(overrides: Partial<OperationDraftVm> = {}): OperationDraftVm {
  return {
    type: 'RECEIVE',
    status: 'draft',
    effectiveAt: '2026-08-07T10:00',
    destinationSiteId: '21',
    lines: [],
    ...overrides,
  };
}

function makeLine(localId: string, itemId: string | null = '1'): OperationLineDraftVm {
  return {
    localId,
    itemId,
    itemName: 'Кабель',
    unitId: 'u1',
    unitName: 'м',
    quantity: 1,
    isTemporary: false,
    fromBalances: false,
    lineNumber: 1,
  };
}

function makeItem(id = '42'): Item {
  return {
    id,
    name: 'X',
    sku: `S${id}`,
    category_id: null,
    category_name: null,
    unit_id: 'u1',
    unit_symbol: 'шт',
    is_active: true,
    hashtags: [],
  };
}

interface Mocks {
  serviceMock: {
    balances: WritableSignal<BalanceDto[]>;
    balanceLoadError: WritableSignal<string | null>;
    loadBalances: ReturnType<typeof vi.fn>;
    loadBalancesForItems: ReturnType<typeof vi.fn>;
    getBalanceForItem: ReturnType<typeof vi.fn>;
    hasUnusableLines: ReturnType<typeof vi.fn>;
    validateLinesBeforePersist: ReturnType<typeof vi.fn>;
    applyResolvedStatuses: ReturnType<typeof vi.fn>;
  };
  authContextMock: { authContext: WritableSignal<null>; load: ReturnType<typeof vi.fn> };
  issueObjectsMock: { items: WritableSignal<never[]>; loadList: ReturnType<typeof vi.fn> };
  diagnosticsMock: { newDraftId: ReturnType<typeof vi.fn>; newIdempotencyKey: ReturnType<typeof vi.fn>; track: ReturnType<typeof vi.fn> };
  diagMock: { track: ReturnType<typeof vi.fn> };
  draftStorageMock: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };
  bffMock: { setCurrentDraftId: ReturnType<typeof vi.fn> };
  catalogSearchMock: { isSearchingItems: ReturnType<typeof vi.fn>; searchItemsOnce: ReturnType<typeof vi.fn>; refreshItemsAuthoritative: ReturnType<typeof vi.fn>; resolveItems: ReturnType<typeof vi.fn> };
}

function createMocks(): Mocks {
  return {
    serviceMock: {
      balances: signal<BalanceDto[]>([]),
      balanceLoadError: signal<string | null>(null),
      loadBalances: vi.fn(async () => {}),
      loadBalancesForItems: vi.fn(async () => []),
      getBalanceForItem: vi.fn(() => 0),
      hasUnusableLines: vi.fn(() => false),
      validateLinesBeforePersist: vi.fn(async () => new Map()),
      applyResolvedStatuses: vi.fn((draft: any) => draft),
    },
    authContextMock: { authContext: signal(null), load: vi.fn(async () => {}) },
    issueObjectsMock: { items: signal([]), loadList: vi.fn(async () => {}) },
    diagnosticsMock: {
      newDraftId: vi.fn(() => 'draft-1'),
      newIdempotencyKey: vi.fn(() => 'key-1'),
      track: vi.fn(),
    },
    diagMock: { track: vi.fn() },
    draftStorageMock: { load: vi.fn(() => null), save: vi.fn(() => true), clear: vi.fn() },
    bffMock: { setCurrentDraftId: vi.fn() },
    catalogSearchMock: {
      isSearchingItems: vi.fn(() => false),
      searchItemsOnce: vi.fn(() => of([])),
      refreshItemsAuthoritative: vi.fn(),
      resolveItems: vi.fn(() => of([])),
    },
  };
}

let mocks: Mocks;

function configureTestBed(): void {
  TestBed.configureTestingModule({
    imports: [OperationCreateModalComponent],
    providers: [
      { provide: OperationsService, useValue: mocks.serviceMock },
      { provide: AuthContextService, useValue: mocks.authContextMock },
      { provide: IssueObjectsService, useValue: mocks.issueObjectsMock },
      { provide: DiagnosticsSessionService, useValue: mocks.diagnosticsMock },
      { provide: DiagnosticsService, useValue: mocks.diagMock },
      { provide: DraftStorageService, useValue: mocks.draftStorageMock },
      { provide: BffApiService, useValue: mocks.bffMock },
      { provide: CatalogSearchService, useValue: mocks.catalogSearchMock },
    ],
  });
}

/** Flush signal effects: effects on signals run in microtasks after CD. */
async function flush(fixture: ComponentFixture<OperationCreateModalComponent>, rounds = 6): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    fixture.detectChanges();
    await Promise.resolve();
  }
  fixture.detectChanges();
  await Promise.resolve();
}

describe('OperationCreateModalComponent — manual balance refresh (TZ §6.1 C1-C7)', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
  });

  it('C1: RECEIVE draft with destinationSiteId → loadBalancesForItems called with the site id', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenCalled();
    const lastCall = mocks.serviceMock.loadBalancesForItems.mock.calls.at(-1);
    expect(lastCall).toEqual(['21', ['1']]);
  });

  it('C2: switching destinationSiteId → loadBalancesForItems called with the new site', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    fixture.componentRef.setInput('draft', makeDraft({ destinationSiteId: '22', lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const lastCall = mocks.serviceMock.loadBalancesForItems.mock.calls.at(-1);
    expect(lastCall).toEqual(['22', ['1']]);
  });

  it('C3: rapid site switches — balance refresh applies once for the final siteId (race handled)', async () => {
    const balances = signal<BalanceDto[]>([]);
    const callOrder: string[] = [];
    const pending: Array<() => void> = [];
    const loadBalancesForItems = vi.fn((siteId: string, _itemIds: string[]) => {
      callOrder.push(siteId);
      return new Promise<BalanceDto[]>(resolve => { pending.push(() => resolve(balances())); });
    });
    const customServiceMock = {
      balances,
      balanceLoadError: signal<string | null>(null),
      loadBalances: vi.fn(async () => {}),
      loadBalancesForItems,
      getBalanceForItem: vi.fn(() => 0),
      hasUnusableLines: vi.fn(() => false),
      validateLinesBeforePersist: vi.fn(async () => new Map()),
      applyResolvedStatuses: vi.fn((draft: any) => draft),
    };

    TestBed.configureTestingModule({
      imports: [OperationCreateModalComponent],
      providers: [
        { provide: OperationsService, useValue: customServiceMock },
        { provide: AuthContextService, useValue: mocks.authContextMock },
        { provide: IssueObjectsService, useValue: mocks.issueObjectsMock },
        { provide: DiagnosticsSessionService, useValue: mocks.diagnosticsMock },
        { provide: DiagnosticsService, useValue: mocks.diagMock },
        { provide: DraftStorageService, useValue: mocks.draftStorageMock },
        { provide: BffApiService, useValue: mocks.bffMock },
        { provide: CatalogSearchService, useValue: mocks.catalogSearchMock },
      ],
    });

    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    const draft = makeDraft({ lines: [makeLine('local-1', '1')] });

    fixture.componentRef.setInput('draft', { ...draft, destinationSiteId: '22' });
    await flush(fixture);
    fixture.componentRef.setInput('draft', { ...draft, destinationSiteId: '23' });
    await flush(fixture);
    fixture.componentRef.setInput('draft', { ...draft, destinationSiteId: '24' });
    await flush(fixture);

    // The final ('24') request resolves first — only it may apply.
    balances.set([{ item_id: '1', site_id: '24', qty: '24' }]);
    pending[2]();
    await flush(fixture);

    // Stale ('22', '23') requests resolve later — seq-guard must discard them.
    balances.set([{ item_id: '1', site_id: '22', qty: '22' }]);
    pending[0]();
    await flush(fixture);
    balances.set([{ item_id: '1', site_id: '23', qty: '23' }]);
    pending[1]();
    await flush(fixture);

    expect(callOrder).toContain('24');
    expect(fixture.componentInstance.localDraft().lines[0].availableQuantity).toBe(24);
  });

  it('C4: onSave does NOT trigger a background loadBalancesForItems', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const callsBefore = mocks.serviceMock.loadBalancesForItems.mock.calls.length;
    const saveSpy = vi.spyOn(fixture.componentInstance.save, 'emit');
    await fixture.componentInstance.onSave();

    expect(mocks.serviceMock.loadBalancesForItems.mock.calls.length).toBe(callsBefore);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('C5: onSubmit does NOT trigger a background loadBalancesForItems', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const callsBefore = mocks.serviceMock.loadBalancesForItems.mock.calls.length;
    const submitSpy = vi.spyOn(fixture.componentInstance.submit, 'emit');
    await fixture.componentInstance.onSubmit();

    expect(mocks.serviceMock.loadBalancesForItems.mock.calls.length).toBe(callsBefore);
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('C6: onNewItemSelected → getBalanceForItem called exactly once with (itemId, siteId)', async () => {
    mocks.catalogSearchMock.resolveItems = vi.fn(() => of([{
      requested_id: '42',
      status: 'active',
      canonical_item_id: '42',
      item: { id: '42', name: 'X', sku: 'S42', unit_id: 'u1', unit_symbol: 'шт', category_id: null, category_name: null, is_active: true },
    }]));
    configureTestBed();
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft());
    await flush(fixture);

    await fixture.componentInstance.onNewItemSelected(makeItem('42'));

    expect(mocks.serviceMock.getBalanceForItem).toHaveBeenCalledTimes(1);
    expect(mocks.serviceMock.getBalanceForItem).toHaveBeenCalledWith('42', '21');
  });

  it('C7: onItemSelected for an existing line → loadBalancesForItems called', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => [{ item_id: '42', site_id: '21', qty: '5' }]);
    configureTestBed();
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', null)] }));
    await flush(fixture);

    fixture.componentInstance.onItemSelected('local-1', makeItem('42'));
    await flush(fixture);

    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenCalled();
  });
});

describe('OperationCreateModalComponent — B2/B3/B4 auto-validation and balances (T3-T5)', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
  });

  it('T3a: onSave with an unusable line does NOT emit and shows a toast', async () => {
    mocks.serviceMock.hasUnusableLines = vi.fn(() => true);
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const saveSpy = vi.spyOn(fixture.componentInstance.save, 'emit');
    await fixture.componentInstance.onSave();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(mocks.serviceMock.validateLinesBeforePersist).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.toasts().join()).toContain('Сохранение отменено');
  });

  it('T3b: onSave with a clean line emits exactly once', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const saveSpy = vi.spyOn(fixture.componentInstance.save, 'emit');
    await fixture.componentInstance.onSave();

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.toasts()).toEqual([]);
  });

  it('T3c: onSave blocked with toast when the resolver is unavailable (refreshError set)', async () => {
    mocks.serviceMock.validateLinesBeforePersist = vi.fn(async () => {
      throw { code: 'resolver_unavailable', message: 'резолвер недоступен' };
    });
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const saveSpy = vi.spyOn(fixture.componentInstance.save, 'emit');
    await fixture.componentInstance.onSave();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.refreshError()).toEqual({
      code: 'resolver_unavailable',
      message: 'резолвер недоступен',
    });
    expect(fixture.componentInstance.toasts().join()).toContain('Не удалось проверить ТМЦ');
    expect(fixture.componentInstance.toasts().join()).toContain('резолвер недоступен');
  });

  it('T3d: onSubmit with an unusable line does NOT emit, tracks validation_failed, shows toast', async () => {
    mocks.serviceMock.hasUnusableLines = vi.fn(() => true);
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const submitSpy = vi.spyOn(fixture.componentInstance.submit, 'emit');
    await fixture.componentInstance.onSubmit();

    expect(submitSpy).not.toHaveBeenCalled();
    expect(mocks.diagMock.track).toHaveBeenCalledWith(
      'validation_failed',
      expect.objectContaining({ reason: 'unusable_lines' }),
    );
    expect(fixture.componentInstance.toasts().join()).toContain('Сохранение отменено');
  });

  it('T4a: onRefreshAllBalances on object flow validates items and does NOT loadBalances', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({
      type: 'ISSUE_RETURN',
      sourceSiteId: '9',
      issueObjectId: 'obj1',
      lines: [makeLine('local-1', '1')],
    }));
    await flush(fixture);

    const callsBefore = mocks.serviceMock.loadBalancesForItems.mock.calls.length;
    await fixture.componentInstance.onRefreshAllBalances();

    expect(mocks.serviceMock.validateLinesBeforePersist).toHaveBeenCalledTimes(1);
    expect(mocks.serviceMock.loadBalancesForItems.mock.calls.length).toBe(callsBefore);
    expect(fixture.componentInstance.toasts().join()).toContain('Остатки недоступны для объектных операций');
  });

  it('T4b: onRefreshAllBalances without site validates items and shows info toast', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({
      destinationSiteId: null,
      lines: [makeLine('local-1', '1')],
    }));
    await flush(fixture);

    const callsBefore = mocks.serviceMock.loadBalancesForItems.mock.calls.length;
    await fixture.componentInstance.onRefreshAllBalances();

    expect(mocks.serviceMock.validateLinesBeforePersist).toHaveBeenCalledTimes(1);
    expect(mocks.serviceMock.loadBalancesForItems.mock.calls.length).toBe(callsBefore);
    expect(fixture.componentInstance.toasts().join()).toContain('Выберите склад, чтобы обновить остатки');
  });

  it('T5: loadBalancesForItems error sets balanceLoadError, toast on manual refresh', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => {
      mocks.serviceMock.balances.set([]);
      mocks.serviceMock.balanceLoadError.set('Не удалось загрузить остатки');
      return [];
    });
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    await fixture.componentInstance.onRefreshAllBalances();

    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenCalledWith('21', ['1']);
    expect(mocks.serviceMock.balanceLoadError()).toBe('Не удалось загрузить остатки');
    expect(fixture.componentInstance.toasts().join()).toContain('Не удалось обновить остатки');
  });
});
