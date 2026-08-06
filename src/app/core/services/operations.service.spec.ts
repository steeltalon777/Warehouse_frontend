import { TestBed } from '@angular/core/testing';
import { OperationsService } from './operations.service';
import { BffApiService } from '../api/bff-api.service';
import { AuthContextService } from './auth-context.service';
import { CatalogSearchService } from './catalog-search.service';
import { DiagnosticsSessionService } from './diagnostics-session.service';
import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { of, throwError } from 'rxjs';
import { OperationDto, OperationStatus, OperationType, OperationDraftVm, OperationLineDraftVm, ResolvedItemDto } from '../models/operations.models';

describe('OperationsService', () => {
  let service: OperationsService;
  let searchMock: { resolveItems: ReturnType<typeof vi.fn> };
  let bffMock: {
    getList: ReturnType<typeof vi.fn>;
    getData: ReturnType<typeof vi.fn>;
    postData: ReturnType<typeof vi.fn>;
    patchData: ReturnType<typeof vi.fn>;
    deleteData: ReturnType<typeof vi.fn>;
  };
  let authMock: { authContext: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    bffMock = {
      getList: vi.fn(),
      getData: vi.fn(),
      postData: vi.fn(),
      patchData: vi.fn(),
      deleteData: vi.fn(),
    };

    authMock = {
      authContext: vi.fn(() => ({ userId: 'user-1', role: 'storekeeper', defaultSiteId: null })),
      load: vi.fn(),
    };

    searchMock = { resolveItems: vi.fn() };
    const diagnosticsSessionMock = {
      lastServerRequestId: null,
      newIdempotencyKey: vi.fn(() => 'idem-fallback-uuid'),
    };
    const diagnosticsMock = { track: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        // Plain DI: let Angular's real injector construct OperationsService
        // via its 5-arg constructor (see operations.service.ts:67). Under
        // @angular/build:unit-test, ngtsc emits constructor metadata, so
        // the dependencies are resolved reflectively; a manual factory +
        // five 'as unknown as' casts is no longer needed. Running through
        // the real DI graph also catches a larger class of regressions
        // (e.g. accidental DI changes) than a manual instantiation.
        OperationsService,
        { provide: BffApiService, useValue: bffMock },
        { provide: AuthContextService, useValue: authMock },
        { provide: CatalogSearchService, useValue: searchMock },
        { provide: DiagnosticsSessionService, useValue: diagnosticsSessionMock },
        { provide: DiagnosticsService, useValue: diagnosticsMock },
      ],
    });

    service = TestBed.inject(OperationsService);
  });

  // ─── loadList query params ─────────────────────────────────────────

  it('loadList calls BffApiService with correct query params', async () => {
    bffMock.getList.mockReturnValue(of({ items: [], total_count: 0, page: 1, page_size: 20 }));

    await service.loadList({
      search: 'test',
      type: 'RECEIVE' as OperationType,
      status: 'draft' as OperationStatus,
      acceptanceState: 'pending',
      siteId: 'site-1',
      createdAfter: '2026-01-01',
      createdBefore: '2026-01-31',
      updatedAfter: '2026-02-01',
      updatedBefore: '2026-02-28',
      createdByUserId: 'user-2',
      onlyMine: false,
      page: 2,
      pageSize: 50,
    });

    expect(bffMock.getList).toHaveBeenCalledOnce();
    const [, params] = bffMock.getList.mock.calls[0];
    expect(params['page']).toBe(2);
    expect(params['page_size']).toBe(50);
    expect(params['search']).toBe('test');
    expect(params['type']).toBe('RECEIVE');
    expect(params['status']).toBe('draft');
    expect(params['acceptance_state']).toBe('pending');
    expect(params['site_id']).toBe('site-1');
    expect(params['created_after']).toBe('2026-01-01');
    expect(params['created_before']).toBe('2026-01-31');
    expect(params['updated_after']).toBe('2026-02-01');
    expect(params['updated_before']).toBe('2026-02-28');
    expect(params['created_by_user_id']).toBe('user-2');
  });

  it('loadList maps onlyMine to created_by_user_id me', async () => {
    bffMock.getList.mockReturnValue(of({ items: [], total_count: 0, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: true, page: 1, pageSize: 20,
    });

    const [, params] = bffMock.getList.mock.calls[0];
    expect(params['created_by_user_id']).toBe('me');
  });

  // ─── mapToRowVm role-aware mapping ─────────────────────────────────

  it('mapToRowVm returns correct flags for observer role', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'observer', defaultSiteId: null }));
    const op = makeOperation('draft');
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const row = service.rows()[0];
    expect(row.canEdit).toBe(false);
    expect(row.canSubmit).toBe(false);
    expect(row.canCancel).toBe(false);
    expect(row.canAccept).toBe(false);
  });

  it('mapToRowVm allows storekeeper to edit own draft', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'storekeeper', defaultSiteId: null }));
    const op = makeOperation('draft', { created_by_user_id: 'user-1' });
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const row = service.rows()[0];
    expect(row.canEdit).toBe(true);
    expect(row.canSubmit).toBe(true);
    expect(row.canCancel).toBe(true);
    expect(row.canAccept).toBe(false);
  });

  it('mapToRowVm blocks storekeeper from editing others draft', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'storekeeper', defaultSiteId: null }));
    const op = makeOperation('draft', { created_by_user_id: 'user-2' });
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const row = service.rows()[0];
    expect(row.canEdit).toBe(false);
    expect(row.canSubmit).toBe(true);
    expect(row.canCancel).toBe(true);
  });

  it('mapToRowVm allows root to edit any draft and accept pending', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'root', defaultSiteId: null }));
    const op = makeOperation('submitted', { created_by_user_id: 'user-2', acceptance_state: 'pending' });
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const row = service.rows()[0];
    expect(row.canEdit).toBe(false); // pending = not draft
    expect(row.canSubmit).toBe(false);
    expect(row.canCancel).toBe(true);
    expect(row.canAccept).toBe(true);
  });

  it('mapToRowVm allows print only on submitted', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'root', defaultSiteId: null }));
    const draft = makeOperation('draft');
    const submitted = makeOperation('submitted');
    bffMock.getList.mockReturnValue(of({ items: [draft, submitted], total_count: 2, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const rows = service.rows();
    expect(rows[0].canPrint).toBe(false);
    expect(rows[1].canPrint).toBe(true);
  });

  // ─── isSaving / isSubmitting flags ─────────────────────────────────

  it('isSaving toggles during createOperation', async () => {
    bffMock.postData.mockReturnValue(of({ id: 'op-1' }));

    const draft = {
      type: 'RECEIVE' as OperationType,
      status: 'draft' as const,
      sourceSiteId: null,
      destinationSiteId: null,
      personName: null,
      comment: null,
      lines: [],
    };

    const promise = service.createOperation(draft);
    // postData returns of(...) which resolves via firstValueFrom in next microtask
    // so isSaving should still be true before await
    expect(service.isSaving()).toBe(true);

    await promise;
    expect(service.isSaving()).toBe(false);
  });

  it('createOperation builds payload with backend field names', async () => {
    bffMock.postData.mockReturnValue(of({ id: 'op-1' }));

    await service.createOperation({
      type: 'MOVE' as OperationType,
      status: 'draft',
      sourceSiteId: '10',
      destinationSiteId: '20',
      personName: 'Иванов Иван',
      issueObjectId: '7',
      issueObjectName: 'Объект A',
      effectiveAt: '2026-01-15T10:30',
      comment: 'test note',
      lines: [
        {
          localId: 'local-1',
          itemId: '5',
          itemName: 'Кабель',
          unitName: 'шт',
          unitId: '2',
          quantity: 400,
          isTemporary: false,
          fromBalances: false,
        },
      ],
    });

    expect(bffMock.postData).toHaveBeenCalledOnce();
    const [, payload] = bffMock.postData.mock.calls[0];
    expect(payload).toMatchObject({
      type: 'MOVE',
      site_id: '10',
      source_site_id: '10',
      destination_site_id: '20',
      issued_to_name: 'Иванов Иван',
      issue_object_id: '7',
      issue_object_name_snapshot: 'Объект A',
      effective_at: new Date('2026-01-15T10:30').toISOString(),
      notes: 'test note',
    });
    expect(payload.lines).toEqual([
      {
        line_number: 1,
        item_id: '5',
        qty: '400',
      },
    ]);
  });

  it('updateOperation sends effective_at via dedicated endpoint', async () => {
    bffMock.patchData
      .mockReturnValueOnce(of({ id: 'op-1', status: 'draft' }))
      .mockReturnValueOnce(of({ id: 'op-1', status: 'draft', effective_at: '2026-01-15T07:30:00.000Z' }));

    await service.updateOperation('op-1', {
      id: 'op-1',
      type: 'RECEIVE' as OperationType,
      status: 'draft',
      destinationSiteId: '20',
      effectiveAt: '2026-01-15T10:30',
      comment: null,
      lines: [
        { localId: 'l1', itemId: '5', itemName: 'Кабель', unitName: 'шт', quantity: 1, isTemporary: false, fromBalances: false },
      ],
    });

    expect(bffMock.patchData).toHaveBeenCalledTimes(2);
    const [mainPath, mainPayload] = bffMock.patchData.mock.calls[0];
    expect(mainPath).toBe('/operations/op-1');
    expect(mainPayload.effective_at).toBeUndefined();

    const [effectivePath, effectivePayload] = bffMock.patchData.mock.calls[1];
    expect(effectivePath).toBe('/operations/op-1/effective-at');
    expect(effectivePayload.effective_at).toBe(new Date('2026-01-15T10:30').toISOString());
  });

  it('isSubmitting toggles during submitOperation', async () => {
    bffMock.postData.mockReturnValue(of({}));

    const promise = service.submitOperation('op-1');
    expect(service.isSubmitting()).toBe(true);

    await promise;
    expect(service.isSubmitting()).toBe(false);
  });

  // ─── Role-aware cancel (Stage B2) ───────────────────────────────

  it('root can cancel submitted operations', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'root', defaultSiteId: null }));
    const op = makeOperation('submitted');
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const row = service.rows()[0];
    expect(row.canCancel).toBe(true);
  });

  it('chief_storekeeper cannot cancel submitted operations', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'chief_storekeeper', defaultSiteId: null }));
    const op = makeOperation('submitted');
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const row = service.rows()[0];
    expect(row.canCancel).toBe(false);
  });

  it('storekeeper cannot cancel submitted operations', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'storekeeper', defaultSiteId: null }));
    const op = makeOperation('submitted');
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const row = service.rows()[0];
    expect(row.canCancel).toBe(false);
  });

  it('non-root does not see cancelled rows in results', async () => {
    authMock.authContext = vi.fn(() => ({ userId: 'user-1', role: 'storekeeper', defaultSiteId: null }));
    const draft = makeOperation('draft');
    const cancelled = makeOperation('cancelled', { id: 'op-cancelled', number: 'OP-CANCEL' });
    bffMock.getList.mockReturnValue(of({ items: [draft, cancelled], total_count: 2, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
      acceptanceState: null,
      createdAfter: null, createdBefore: null, updatedAfter: null, updatedBefore: null,
      createdByUserId: null, onlyMine: false, page: 1, pageSize: 20,
    });

    const rows = service.rows();
    expect(rows.length).toBe(1);
    expect(rows[0].status).not.toBe('cancelled');
  });

  // ─── isSaving / isSubmitting flags ─────────────────────────────────

  it('isSaving resets on createOperation error', async () => {
    bffMock.postData.mockReturnValue(throwError(() => ({ code: 'error', message: 'fail' })));

    const draft = {
      type: 'RECEIVE' as OperationType,
      status: 'draft' as const,
      sourceSiteId: null,
      destinationSiteId: null,
      personName: null,
      comment: null,
      lines: [],
    };

    await expect(service.createOperation(draft)).rejects.toBeDefined();
    expect(service.isSaving()).toBe(false);
  });

  // ─── Payload mapping per operation type ──────────────────────────

  it('createOperation RECEIVE sends site_id as destinationSiteId and omits source_site_id', async () => {
    bffMock.postData.mockReturnValue(of({ id: 'op-1' }));

    await service.createOperation({
      type: 'RECEIVE' as OperationType,
      status: 'draft',
      sourceSiteId: '10',
      destinationSiteId: '20',
      comment: null,
      lines: [],
    });

    const [, payload] = bffMock.postData.mock.calls[0];
    expect(payload.site_id).toBe('20');
    expect(payload.source_site_id).toBeUndefined();
    expect(payload.destination_site_id).toBe('20');
  });

  it('createOperation MOVE sends site_id as sourceSiteId plus both site fields', async () => {
    bffMock.postData.mockReturnValue(of({ id: 'op-1' }));

    await service.createOperation({
      type: 'MOVE' as OperationType,
      status: 'draft',
      sourceSiteId: '10',
      destinationSiteId: '20',
      comment: null,
      lines: [],
    });

    const [, payload] = bffMock.postData.mock.calls[0];
    expect(payload.site_id).toBe('10');
    expect(payload.source_site_id).toBe('10');
    expect(payload.destination_site_id).toBe('20');
  });

  it('createOperation EXPENSE sends site_id as sourceSiteId and omits destination_site_id', async () => {
    bffMock.postData.mockReturnValue(of({ id: 'op-1' }));

    await service.createOperation({
      type: 'EXPENSE' as OperationType,
      status: 'draft',
      sourceSiteId: '10',
      destinationSiteId: null,
      comment: null,
      lines: [],
    });

    const [, payload] = bffMock.postData.mock.calls[0];
    expect(payload.site_id).toBe('10');
    expect(payload.source_site_id).toBe('10');
    expect(payload.destination_site_id).toBeUndefined();
  });

  it('createOperation payload never sends lines without itemId', async () => {
    bffMock.postData.mockReturnValue(of({ id: 'op-1' }));

    await service.createOperation({
      type: 'MOVE' as OperationType,
      status: 'draft',
      sourceSiteId: '10',
      destinationSiteId: '20',
      comment: null,
      lines: [
        { localId: 'l1', itemId: '5', itemName: 'A', unitName: 'шт', quantity: 10, isTemporary: false, fromBalances: false },
        { localId: 'l2', itemId: null, itemName: '', unitName: 'шт', quantity: 5, isTemporary: false, fromBalances: false },
        { localId: 'l3', itemId: '6', itemName: 'B', unitName: 'шт', quantity: 0, isTemporary: false, fromBalances: false },
      ],
    });

    const [, payload] = bffMock.postData.mock.calls[0];
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0].item_id).toBe('5');
  });

  // ─── mapDtoToDraftVm ─────────────────────────────────────────────

  it('mapDtoToDraftVm maps DTO lines with stable localIds', () => {
    const dto: OperationDto = {
      id: 'op-1',
      number: 'OP-001',
      type: 'MOVE',
      status: 'draft',
      source_site_id: '10',
      destination_site_id: '20',
      created_by_user_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      effective_at: '2026-01-02T03:04:00Z',
      lines: [
        { id: 'line-1', item_id: 'item-1', item_name: 'Кабель', sku: 'SKU-1', unit_symbol: 'м', qty: '100' },
        { id: 'line-2', item_id: 'item-2', item_name: 'Разъем', sku: 'SKU-2', unit_symbol: 'шт', qty: '50' },
      ],
    };

    const draft = service.mapDtoToDraftVm(dto);
    expect(draft.id).toBe('op-1');
    expect(draft.type).toBe('MOVE');
    expect(draft.sourceSiteId).toBe('10');
    expect(draft.destinationSiteId).toBe('20');
    expect(draft.effectiveAt).toMatch(/^2026-01-02T\d{2}:04$/);
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0].itemId).toBe('item-1');
    expect(draft.lines[0].itemName).toBe('Кабель');
    expect(draft.lines[0].quantity).toBe(100);
    expect(draft.lines[0].lineNumber).toBe(1);
    expect(draft.lines[1].lineNumber).toBe(2);
  });

  it('mapDtoToDraftVm handles empty lines', () => {
    const dto: OperationDto = {
      id: 'op-1',
      number: 'OP-001',
      type: 'EXPENSE',
      status: 'draft',
      created_by_user_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const draft = service.mapDtoToDraftVm(dto);
    expect(draft.lines).toHaveLength(0);
  });

  // ─── computeClientDisplayNumber (WP cleanup F2) ─────────────────────
  // Per contract: client-side fallback when the server doesn't return
  // display_number. The format is `${site_id}/${hh}${mm}/${dd}${MM}${yy}`.
  // This was accidentally changed in WP-3; reverted in cleanup. Keep this
  // test as a guard against future regressions.

  it('computeClientDisplayNumber keeps the legacy site-prefixed format', () => {
    const dto: OperationDto = {
      id: 'op-1',
      type: 'RECEIVE',
      status: 'draft',
      created_by_user_id: 'u1',
      // 15 July 2026, 09:42 local time
      created_at: '2026-07-15T09:42:00',
      updated_at: '2026-07-15T09:42:00',
      site_id: '7',
    };

    // mapDtoToDraftVm falls back to computeClientDisplayNumber when
    // display_number / number are missing.
    const draft = service.mapDtoToDraftVm(dto);
    // Format: `${site_id}/${hh}${mm}/${dd}${MM}${yy}` → "7/0942/150726"
    expect(draft.displayNumber).toMatch(/^7\/\d{4}\/\d{6}$/);
    // Belt-and-braces: verify the exact parts are in the right order.
    expect(draft.displayNumber!.startsWith('7/')).toBe(true);
    // The date part must come last (ddMMYY), not before the time.
    expect(draft.displayNumber).toBe('7/0942/150726');
  });

  // ─── Batch resolver / immutable status annotation (TZ-V3.2 W1.1) ─────

  it('validateLinesBeforePersist resolves persisted item ids and keys by line localId', async () => {
    searchMock.resolveItems.mockReturnValue(of([
      { requested_id: 5, status: 'merged', canonical_item_id: 99, reason: 'merge_cycle', item: { name: 'Кабель силовой' } },
      { requested_id: 6, status: 'active', item: { name: 'Разъём' } },
    ]));

    const draft: OperationDraftVm = {
      type: 'RECEIVE',
      status: 'draft',
      lines: [
        makeDraftLine('line-a', '5'),
        makeDraftLine('line-b', '6'),
        makeDraftLine('line-c', '5'), // duplicate item id → must still resolve
        makeDraftLine('line-d', null), // no itemId → never sent to resolver
      ],
    };

    const map = await service.validateLinesBeforePersist(draft);

    // Duplicate item ids are deduplicated in the resolver request.
    expect(searchMock.resolveItems).toHaveBeenCalledWith(['5', '6']);
    // Results are keyed by the draft line's stable localId, not the item id.
    expect(map.get('line-a')?.status).toBe('merged');
    expect(map.get('line-a')?.canonical_item_id).toBe(99);
    expect(map.get('line-b')?.status).toBe('active');
    expect(map.get('line-c')?.status).toBe('merged');
    expect(map.has('line-d')).toBe(false);
  });

  it('validateLinesBeforePersist rethrows structured resolver errors', async () => {
    searchMock.resolveItems.mockReturnValue(throwError(() => ({ code: 'resolver_unavailable', message: 'Ресолвер недоступен' })));

    const draft: OperationDraftVm = {
      type: 'RECEIVE',
      status: 'draft',
      lines: [makeDraftLine('line-a', '5')],
    };

    await expect(service.validateLinesBeforePersist(draft)).rejects.toMatchObject({
      code: 'resolver_unavailable',
    });
    expect(service.persistStatus()).toBe('rejected');
    expect(service.persistError()?.code).toBe('resolver_unavailable');
  });

  describe('applyResolvedStatuses', () => {
    it('returns new draft snapshot (does not mutate input)', () => {
      const draft: OperationDraftVm = {
        type: 'RECEIVE',
        status: 'draft',
        lines: [makeDraftLine('l1', '5')],
      };
      const resolved = new Map<string, ResolvedItemDto>([
        ['l1', { requested_id: 5, status: 'merged', canonical_item_id: 99, item: { name: 'Кабель' } }],
      ]);

      const result = service.applyResolvedStatuses(draft, resolved);

      expect(result).not.toBe(draft);
      expect(result.lines).not.toBe(draft.lines);
      expect(result.lines[0]).not.toBe(draft.lines[0]);
      expect(draft.lines[0].resolvedStatus).toBeUndefined();
      expect(draft.lines[0].canonicalItemId).toBeUndefined();
      expect(result.lines[0].resolvedStatus).toBe('merged');
    });

    it('provisions resolvedStatus, canonicalItemId, canonicalItemName for each line', () => {
      const draft: OperationDraftVm = {
        type: 'RECEIVE',
        status: 'draft',
        lines: [makeDraftLine('l1', '5'), makeDraftLine('l2', '6')],
      };
      const resolved = new Map<string, ResolvedItemDto>([
        ['l1', { requested_id: 5, status: 'merged', canonical_item_id: 99, reason: 'merge_cycle', item: { name: 'Кабель силовой' } }],
        ['l2', { requested_id: 6, status: 'active', item: { name: 'Разъём' } }],
      ]);

      const result = service.applyResolvedStatuses(draft, resolved);

      expect(result.lines[0].resolvedStatus).toBe('merged');
      expect(result.lines[0].canonicalItemId).toBe(99);
      expect(result.lines[0].canonicalItemName).toBe('Кабель силовой');
      expect(result.lines[0].blockReason).toBe('merge_cycle');
      expect(result.lines[1].resolvedStatus).toBe('active');
      expect(result.lines[1].canonicalItemId).toBeNull();
      expect(result.lines[1].blockReason).toBeUndefined();
    });

    it('leaves resolvedStatus undefined for lines not in resolved map', () => {
      const draft: OperationDraftVm = {
        type: 'RECEIVE',
        status: 'draft',
        lines: [makeDraftLine('l1', '5'), makeDraftLine('l2', '6')],
      };
      const resolved = new Map<string, ResolvedItemDto>([
        ['l1', { requested_id: 5, status: 'active', item: null }],
      ]);

      const result = service.applyResolvedStatuses(draft, resolved);

      expect(result.lines[1].resolvedStatus).toBeUndefined();
      expect(result.lines[1].canonicalItemId).toBeUndefined();
      expect(result.lines[1].canonicalItemName).toBeUndefined();
      expect(result.lines[1].blockReason).toBeUndefined();
    });

    it('handles all five statuses (active, merged, inactive, deleted, missing)', () => {
      const statuses = ['active', 'merged', 'inactive', 'deleted', 'missing'] as const;
      const draft: OperationDraftVm = {
        type: 'RECEIVE',
        status: 'draft',
        lines: statuses.map((_, i) => makeDraftLine(`l${i}`, String(i + 1))),
      };
      const resolved = new Map<string, ResolvedItemDto>(
        statuses.map((s, i) => [`l${i}`, { requested_id: i + 1, status: s, item: null }])
      );

      const result = service.applyResolvedStatuses(draft, resolved);

      statuses.forEach((s, i) => {
        expect(result.lines[i].resolvedStatus).toBe(s);
      });
    });
  });

  describe('hasUnusableLines', () => {
    it('is false for null draft and for active-only lines', () => {
      expect(service.hasUnusableLines(null)).toBe(false);
      const draft: OperationDraftVm = {
        type: 'RECEIVE',
        status: 'draft',
        lines: [{ ...makeDraftLine('l1', '5'), resolvedStatus: 'active' }],
      };
      expect(service.hasUnusableLines(draft)).toBe(false);
    });

    it('is true when any line carries a non-active resolvedStatus', () => {
      const draft: OperationDraftVm = {
        type: 'RECEIVE',
        status: 'draft',
        lines: [
          { ...makeDraftLine('l1', '5'), resolvedStatus: 'active' },
          { ...makeDraftLine('l2', '6'), resolvedStatus: 'merged' },
        ],
      };
      expect(service.hasUnusableLines(draft)).toBe(true);
    });
  });
});

function makeDraftLine(localId: string, itemId: string | null): OperationLineDraftVm {
  return {
    localId,
    itemId,
    itemName: 'Товар',
    unitName: 'шт',
    quantity: 1,
    isTemporary: false,
    fromBalances: false,
  };
}

function makeOperation(status: OperationStatus, overrides: Partial<OperationDto> = {}): OperationDto {
  return {
    id: 'op-1',
    number: 'OP-001',
    type: 'RECEIVE',
    status,
    created_by_user_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
