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
import { FIXTURE_ITEM_IDENTITY_DUPLICATE } from '../../submit-error/envelope.fixtures';
import { GENERIC_SUBMIT_ERROR_TOAST, lineGroupToast } from './submit-error-toasts';
import { snapshotDraft } from './operation-draft-mappers';
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

function makeLine(
  localId: string,
  itemId: string | null = '1',
  lineNumber: number = 1,
  serverLineId: number | null = null,
): OperationLineDraftVm {
  return {
    localId,
    itemId,
    itemName: 'Кабель',
    unitId: 'u1',
    unitName: 'м',
    quantity: 1,
    isTemporary: false,
    fromBalances: false,
    lineNumber,
    serverLineId,
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
  catalogSearchMock: { isSearchingItems: ReturnType<typeof vi.fn>; searchItemsOnce: ReturnType<typeof vi.fn>; refreshItemsAuthoritativeOnce: ReturnType<typeof vi.fn>; resolveItems: ReturnType<typeof vi.fn> };
}

function createMocks(): Mocks {
  return {
    serviceMock: {
      balances: signal<BalanceDto[]>([]),
      balanceLoadError: signal<string | null>(null),
      loadBalances: vi.fn(async () => {}),
      loadBalancesForItems: vi.fn(async () => []),
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
      refreshItemsAuthoritativeOnce: vi.fn(() => of([])),
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

  it('C6: onNewItemSelected appends NOT_LOADED (never 0) and triggers a targeted refresh', async () => {
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
    await flush(fixture);

    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.itemId).toBe('42');
    // Success + missing row → confirmed zero (FRESH), not a false NOT_LOADED zero.
    expect(line.balanceState).toBe('FRESH');
    expect(line.availableQuantity).toBe(0);
    // The targeted refresh (via the effect) is the source of balance data.
    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenCalledWith('21', ['42']);
  });

  it('C7: onItemSelected for an existing line → line becomes NOT_LOADED and triggers a targeted refresh', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => [{ item_id: '42', site_id: '21', qty: '5' }]);
    configureTestBed();
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', null)] }));
    await flush(fixture);

    fixture.componentInstance.onItemSelected('local-1', makeItem('42'));
    await flush(fixture);

    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenCalled();
    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.itemId).toBe('42');
    expect(line.availableQuantity).toBe(5);
    expect(line.balanceState).toBe('FRESH');
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

  it('T5: loadBalancesForItems error marks line ERROR (never 0), toast on manual refresh', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => {
      mocks.serviceMock.balanceLoadError.set('Не удалось загрузить остатки');
      throw new Error('Не удалось загрузить остатки');
    });
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    await fixture.componentInstance.onRefreshAllBalances();

    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenCalledWith('21', ['1']);
    expect(mocks.serviceMock.balanceLoadError()).toBe('Не удалось загрузить остатки');
    // B2: error must NOT become a confirmed zero.
    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.balanceState).toBe('ERROR');
    expect(line.availableQuantity).toBeNull();
    expect(fixture.componentInstance.toasts().join()).toContain('Не удалось обновить остатки');
  });
});

describe('OperationCreateModalComponent — B1/B2 balance lifecycle regressions (issue #24)', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
  });

  it('B1: applying a successful balance response does NOT retrigger the effect (no self-trigger loop)', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => [
      { item_id: '1', site_id: '21', qty: '12' },
    ]);
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture, 10);

    // Exactly one targeted request for the single line — a loop would keep firing.
    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenCalledTimes(1);
    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.availableQuantity).toBe(12);
    expect(line.balanceState).toBe('FRESH');
  });

  it('B1: quantity/category edits do not fire a new balance request', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => [
      { item_id: '1', site_id: '21', qty: '12' },
    ]);
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const callsBefore = mocks.serviceMock.loadBalancesForItems.mock.calls.length;
    fixture.componentInstance.onQuantityChange('local-1', 5);
    await flush(fixture, 10);

    expect(mocks.serviceMock.loadBalancesForItems.mock.calls.length).toBe(callsBefore);
  });

  it('B1: changing site fires exactly one new request for the new site', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => [
      { item_id: '1', site_id: '22', qty: '9' },
    ]);
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const callsBefore = mocks.serviceMock.loadBalancesForItems.mock.calls.length;
    fixture.componentRef.setInput('draft', makeDraft({ destinationSiteId: '22', lines: [makeLine('local-1', '1')] }));
    await flush(fixture, 10);

    expect(mocks.serviceMock.loadBalancesForItems.mock.calls.length).toBe(callsBefore + 1);
    expect(mocks.serviceMock.loadBalancesForItems).toHaveBeenLastCalledWith('22', ['1']);
  });

  it('B2: first HTTP failure → ERROR, never a confirmed zero', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => {
      mocks.serviceMock.balanceLoadError.set('Не удалось загрузить остатки');
      throw new Error('boom');
    });
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture, 10);

    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.balanceState).toBe('ERROR');
    expect(line.availableQuantity).toBeNull();
  });

  it('B2: failure after a previous success keeps the last confirmed value (not replaced by 0)', async () => {
    let fail = false;
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => {
      if (fail) {
        mocks.serviceMock.balanceLoadError.set('Не удалось загрузить остатки');
        throw new Error('boom');
      }
      return [{ item_id: '1', site_id: '21', qty: '7' }];
    });
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    let line = fixture.componentInstance.localDraft().lines[0];
    expect(line.availableQuantity).toBe(7);
    expect(line.balanceState).toBe('FRESH');

    fail = true;
    await fixture.componentInstance.onRefreshAllBalances();
    await flush(fixture);

    line = fixture.componentInstance.localDraft().lines[0];
    expect(line.availableQuantity).toBe(7);
    expect(line.balanceState).toBe('FRESH');
  });

  it('B2: successful targeted request with missing row → confirmed zero (FRESH 0)', async () => {
    mocks.serviceMock.loadBalancesForItems = vi.fn(async () => []);
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    await flush(fixture);

    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.balanceState).toBe('FRESH');
    expect(line.availableQuantity).toBe(0);
  });
});

describe('OperationCreateModalComponent — B3 structured save line errors (issue #24)', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
  });

  it('maps operation_lines_invalid errors onto the correct row (deleted)', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    fixture.componentRef.setInput('saveLineErrors', [{ line_number: 1, item_id: 1, reason: 'deleted' }]);
    await flush(fixture);

    const line = fixture.componentInstance.lines()[0];
    expect(line.error).toContain('удалена');
  });

  it('duplicate_item correlates to the first line number', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1', 1), makeLine('local-2', '2', 2)] }));
    fixture.componentRef.setInput('saveLineErrors', [{ line_number: 2, item_id: 1, reason: 'duplicate_item', first_line_number: 1 }]);
    await flush(fixture);

    const lines = fixture.componentInstance.lines();
    expect(lines[1].error).toContain('строке 1');
  });

  it('line remains in draft after structured save error', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', makeDraft({ lines: [makeLine('local-1', '1')] }));
    fixture.componentRef.setInput('saveLineErrors', [{ line_number: 1, item_id: 1, reason: 'inactive' }]);
    await flush(fixture);

    expect(fixture.componentInstance.localDraft().lines.length).toBe(1);
  });
});

describe('OperationCreateModalComponent — ADR-0033 item_identity_duplicate surface', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
    // jsdom has no Element.prototype.scrollIntoView; the submit-error surface
    // calls it from a setTimeout after rendering.
    Element.prototype.scrollIntoView = vi.fn();
  });

  async function createIdentityDuplicateFixture() {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput(
      'draft',
      makeDraft({ lines: [makeLine('local-1', '1', 1, 11), makeLine('local-2', '2', 2, 12)] }),
    );
    fixture.componentRef.setInput('submitErrorPayload', FIXTURE_ITEM_IDENTITY_DUPLICATE);
    await flush(fixture);
    return fixture;
  }

  it('renders the duplicate error with candidates and a line-group toast, not generic (AC-12)', async () => {
    const fixture = await createIdentityDuplicateFixture();

    const errors = fixture.componentInstance.lineSubmitErrors();
    expect(errors['local-1'].identityDuplicate?.requestedName).toBe('Болт М8');
    expect(errors['local-1'].identityDuplicate?.candidates).toHaveLength(2);
    expect(errors['local-2'].identityDuplicate?.intraBatch).toBe(false);

    const blocks = fixture.nativeElement.querySelectorAll(
      '[data-testid="identity-duplicate-candidates"]',
    );
    // Both affected rows render the error surface, so the candidate list appears twice.
    expect(blocks.length).toBe(2);
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="identity-candidate-use"]').length,
    ).toBe(4);

    expect(fixture.componentInstance.toasts()).toEqual([lineGroupToast(2)]);
    expect(fixture.componentInstance.toasts()).not.toContain(GENERIC_SUBMIT_ERROR_TOAST);
  });

  it('replaces the blocked line with the chosen existing item', async () => {
    const fixture = await createIdentityDuplicateFixture();
    const candidate = FIXTURE_ITEM_IDENTITY_DUPLICATE.errors[0].candidates![0];

    fixture.componentInstance.onUseIdentityCandidate('local-1', candidate);

    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.itemId).toBe('500');
    expect(line.itemName).toBe('Болт М8');
    expect(line.sku).toBe('BOLT-M8');
    expect(line.unitId).toBe('5');
    expect(line.unitName).toBe('шт');
    expect(line.categoryId).toBe('4');
    expect(line.categoryName).toBe('Крепёж');
    expect(line.isTemporary).toBe(false);
    expect(line.inlineItem).toBeNull();
    expect(line.balanceState).toBe('NOT_LOADED');
    expect(fixture.componentInstance.toasts()).toEqual([
      'Строка заменена на существующую ТМЦ «Болт М8»',
    ]);

    await flush(fixture);

    // The other line of the group is still errored; the whole group is stale.
    const errors = fixture.componentInstance.lineSubmitErrors();
    expect(errors['local-1'].stale).toBe(true);
    expect(errors['local-2'].stale).toBe(true);
    expect(errors['local-2'].identityDuplicate?.candidates).toHaveLength(2);
  });

  it('blocks choosing a candidate that another line already uses (issue #24 guard)', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput(
      'draft',
      makeDraft({ lines: [makeLine('local-1', '1', 1, 11), makeLine('local-2', '500', 2, 12)] }),
    );
    fixture.componentRef.setInput('submitErrorPayload', FIXTURE_ITEM_IDENTITY_DUPLICATE);
    await flush(fixture);

    const candidate = FIXTURE_ITEM_IDENTITY_DUPLICATE.errors[0].candidates![0];
    fixture.componentInstance.onUseIdentityCandidate('local-1', candidate);

    expect(fixture.componentInstance.localDraft().lines[0].itemId).toBe('1');
    expect(fixture.componentInstance.submitErrorLocal()).toContain('уже добавлена в строке 2');
  });

  it('keeps the happy path: no payload → no identity block and no toasts', async () => {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput(
      'draft',
      makeDraft({ lines: [makeLine('local-1', '1', 1, 11)] }),
    );
    await flush(fixture);

    expect(fixture.componentInstance.lineSubmitErrors()).toEqual({});
    expect(
      fixture.nativeElement.querySelector('[data-testid="identity-duplicate-candidates"]'),
    ).toBeNull();
    expect(fixture.componentInstance.toasts()).toEqual([]);
  });
});

describe('OperationCreateModalComponent — Stage 1 view mode & RECEIVE-only inline create', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
  });

  function makeInlineLine(localId: string): OperationLineDraftVm {
    return {
      ...makeLine(localId, null),
      inlineItem: {
        clientKey: 'k1',
        name: 'Агент позиция',
        sku: null,
        unitId: 'u1',
        unitName: 'шт',
        categoryId: null,
        categoryName: null,
        description: null,
        hashtags: null,
      },
    };
  }

  async function createFixture(draft: OperationDraftVm | null) {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', draft);
    await flush(fixture);
    return fixture;
  }

  it('submitted operation renders as «Просмотр операции» with no save/submit/remove', async () => {
    const fixture = await createFixture(
      makeDraft({ id: 'op-1', status: 'submitted', lines: [makeLine('local-1')] }),
    );

    const title = fixture.nativeElement.querySelector('[data-design-id="modal-title"]');
    expect(title.textContent.trim()).toBe('Просмотр операции');

    expect(fixture.nativeElement.querySelector('[data-design-id="submit-btn"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-design-id="save-draft-btn"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.remove-btn')).toBeNull();

    const qty = fixture.nativeElement.querySelector('.qty-input') as HTMLInputElement;
    expect(qty).toBeTruthy();
    expect(qty.disabled).toBe(true);
  });

  it('cancelled operation renders as «Операция отменена» read-only', async () => {
    const fixture = await createFixture(
      makeDraft({ id: 'op-2', status: 'cancelled', lines: [makeLine('local-1')] }),
    );

    const title = fixture.nativeElement.querySelector('[data-design-id="modal-title"]');
    expect(title.textContent.trim()).toBe('Операция отменена');
    expect(fixture.nativeElement.querySelector('.remove-btn')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-design-id="submit-btn"]')).toBeNull();
  });

  it('keeps edit/create titles for draft operations', async () => {
    const editFixture = await createFixture(
      makeDraft({ id: 'op-3', status: 'draft', lines: [makeLine('local-1')] }),
    );
    expect(
      editFixture.nativeElement
        .querySelector('[data-design-id="modal-title"]')
        .textContent.trim(),
    ).toBe('Редактирование операции');

    const newFixture = await createFixture(null);
    expect(
      newFixture.nativeElement
        .querySelector('[data-design-id="modal-title"]')
        .textContent.trim(),
    ).toBe('Новая операция');
  });

  it('shows «Создать ТМЦ» only for RECEIVE', async () => {
    const receiveFixture = await createFixture(
      makeDraft({ type: 'RECEIVE', destinationSiteId: '21' }),
    );
    expect(
      receiveFixture.nativeElement.querySelector('[data-design-id="item-create-btn"]'),
    ).toBeTruthy();

    for (const type of ['MOVE', 'EXPENSE', 'ISSUE', 'WRITE_OFF'] as const) {
      const fixture = await createFixture(
        makeDraft({ type, sourceSiteId: '21', destinationSiteId: '22' }),
      );
      expect(
        fixture.nativeElement.querySelector('[data-design-id="item-create-btn"]'),
        `type ${type} must not offer inline ТМЦ creation`,
      ).toBeNull();
    }
  });

  it('replaces temporary-item pills with a compact counter and no chips', async () => {
    const fixture = await createFixture(
      makeDraft({
        type: 'RECEIVE',
        destinationSiteId: '21',
        lines: [makeInlineLine('local-1')],
      }),
    );

    expect(fixture.nativeElement.querySelector('.inline-item-chip')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Временные позиции в операции');

    const counter = fixture.nativeElement.querySelector('[data-testid="inline-items-count"]');
    expect(counter).toBeTruthy();
    expect(counter.textContent.trim()).toBe('Новых позиций: 1');
  });
});

describe('OperationCreateModalComponent — Stage 2 inline temporary-item editing', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
  });

  function makeInlineItem(name: string) {
    return {
      clientKey: 'inline-key-1',
      name,
      sku: null,
      unitId: 'u1',
      unitName: 'шт',
      categoryId: 'c1',
      categoryName: 'Крепёж',
      description: null,
      hashtags: null,
    };
  }

  function makeInlineLine(localId: string, name: string): OperationLineDraftVm {
    return {
      ...makeLine(localId, null),
      itemName: name,
      inlineItem: makeInlineItem(name),
    };
  }

  async function createFixture(draft: OperationDraftVm) {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', draft);
    await flush(fixture);
    return fixture;
  }

  it('renames the inline item in place: inlineItem.name is the source of truth', async () => {
    const fixture = await createFixture(
      makeDraft({ type: 'RECEIVE', destinationSiteId: '21', lines: [makeInlineLine('local-1', 'Старое имя')] }),
    );

    fixture.componentInstance.onInlineNameCommit('local-1', 'Новое имя');
    await flush(fixture);

    const line = fixture.componentInstance.localDraft().lines[0];
    expect(line.inlineItem?.name).toBe('Новое имя');
    expect(line.itemName).toBe('Новое имя');

    const input = fixture.nativeElement.querySelector('.inline-name-input') as HTMLInputElement;
    expect(input.value).toBe('Новое имя');
  });

  it('marks the draft dirty after an inline rename (close guard sees it)', async () => {
    const fixture = await createFixture(
      makeDraft({ type: 'RECEIVE', destinationSiteId: '21', lines: [makeInlineLine('local-1', 'Старое имя')] }),
    );
    fixture.componentInstance.localDraft.update(d => ({
      ...d,
      lastSavedSnapshot: snapshotDraft(d),
    }));
    await flush(fixture);
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);

    fixture.componentInstance.onInlineNameCommit('local-1', 'Новое имя');
    await flush(fixture);

    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });

  it('full card edit updates the existing line in place and never changes clientKey', async () => {
    const fixture = await createFixture(
      makeDraft({ type: 'RECEIVE', destinationSiteId: '21', lines: [makeInlineLine('local-1', 'Старое имя')] }),
    );

    fixture.componentInstance.openInlineCardEdit('local-1');
    await flush(fixture);
    expect(fixture.componentInstance.editingInlineLineId()).toBe('local-1');
    expect(fixture.componentInstance.editingInlineItem()?.name).toBe('Старое имя');

    fixture.componentInstance.onInlineItemUpdated({
      clientKey: 'attempted-new-key',
      name: 'Карточка',
      sku: null,
      unitId: 'u2',
      unitName: 'кг',
      categoryId: 'c2',
      categoryName: 'Категория 2',
      description: 'описание',
      hashtags: null,
    });
    await flush(fixture);

    const lines = fixture.componentInstance.localDraft().lines;
    expect(lines.length).toBe(1);
    expect(lines[0].inlineItem?.name).toBe('Карточка');
    expect(lines[0].inlineItem?.clientKey).toBe('inline-key-1');
    expect(lines[0].inlineItem?.unitId).toBe('u2');
    expect(lines[0].inlineItem?.categoryId).toBe('c2');
    expect(lines[0].inlineItem?.description).toBe('описание');
    expect(lines[0].itemName).toBe('Карточка');
    expect(lines[0].unitId).toBe('u2');
    expect(fixture.componentInstance.isInlineModalOpen()).toBe(false);
  });

  it('does not offer inline or full-card editing in read-only view', async () => {
    const fixture = await createFixture(
      makeDraft({
        id: 'op-1',
        status: 'submitted',
        type: 'RECEIVE',
        destinationSiteId: '21',
        lines: [makeInlineLine('local-1', 'Старое имя')],
      }),
    );

    expect(fixture.nativeElement.querySelector('.inline-name-input')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="inline-card-edit"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Старое имя');
  });
});

describe('OperationCreateModalComponent — Stage 3a authoritative refresh', () => {
  beforeEach(() => {
    mocks = createMocks();
    configureTestBed();
  });

  function makeInlineItem(name: string) {
    return {
      clientKey: 'inline-key-1',
      name,
      sku: null,
      unitId: 'u1',
      unitName: 'шт',
      categoryId: null,
      categoryName: null,
      description: null,
      hashtags: null,
    };
  }

  function makeInlineLine(localId: string, name: string): OperationLineDraftVm {
    return {
      ...makeLine(localId, null),
      itemName: name,
      inlineItem: makeInlineItem(name),
    };
  }

  async function createFixture(draft: OperationDraftVm) {
    const fixture = TestBed.createComponent(OperationCreateModalComponent);
    fixture.componentRef.setInput('sites', []);
    fixture.componentRef.setInput('draft', draft);
    await flush(fixture);
    return fixture;
  }

  it('onRefreshCheckItems re-validates permanent items only and never touches balances', async () => {
    const fixture = await createFixture(
      makeDraft({
        type: 'RECEIVE',
        destinationSiteId: '21',
        lines: [makeLine('local-1', '1'), makeInlineLine('local-2', 'Новая позиция')],
      }),
    );
    mocks.serviceMock.loadBalancesForItems.mockClear();
    mocks.serviceMock.validateLinesBeforePersist.mockClear();

    await fixture.componentInstance.onRefreshCheckItems();
    await flush(fixture);

    expect(mocks.serviceMock.validateLinesBeforePersist).toHaveBeenCalledTimes(1);
    expect(mocks.serviceMock.loadBalancesForItems).not.toHaveBeenCalled();
    // Lines are annotated, never removed.
    expect(fixture.componentInstance.localDraft().lines.length).toBe(2);
    const inline = fixture.componentInstance.localDraft().lines.find(l => l.localId === 'local-2');
    expect(inline?.inlineItem?.name).toBe('Новая позиция');
  });

  it('searchScopeKey changes on type and site change while operation lines survive', async () => {
    const fixture = await createFixture(
      makeDraft({
        type: 'MOVE',
        sourceSiteId: '10',
        destinationSiteId: '20',
        lines: [makeLine('local-1', '1')],
      }),
    );
    const initialScope = fixture.componentInstance.searchScopeKey();
    expect(initialScope).toBe('MOVE|10|20');

    fixture.componentRef.setInput('draft', makeDraft({
      type: 'MOVE',
      sourceSiteId: '11',
      destinationSiteId: '20',
      lines: [makeLine('local-1', '1')],
    }));
    await flush(fixture);

    expect(fixture.componentInstance.searchScopeKey()).toBe('MOVE|11|20');
    expect(fixture.componentInstance.localDraft().lines.length).toBe(1);
  });
});
