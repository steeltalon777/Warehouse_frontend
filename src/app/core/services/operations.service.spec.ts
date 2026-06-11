import { TestBed } from '@angular/core/testing';
import { OperationsService } from './operations.service';
import { BffApiService } from '../api/bff-api.service';
import { AuthContextService } from './auth-context.service';
import { of, throwError } from 'rxjs';
import { OperationDto, OperationStatus, OperationType } from '../models/operations.models';

describe('OperationsService', () => {
  let service: OperationsService;
  let bffMock: {
    getList: ReturnType<typeof vi.fn>;
    getData: ReturnType<typeof vi.fn>;
    postData: ReturnType<typeof vi.fn>;
    patchData: ReturnType<typeof vi.fn>;
  };
  let authMock: { authContext: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    bffMock = {
      getList: vi.fn(),
      getData: vi.fn(),
      postData: vi.fn(),
      patchData: vi.fn(),
    };

    authMock = {
      authContext: vi.fn(() => ({ userId: 'user-1', role: 'storekeeper', defaultSiteId: null })),
      load: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        OperationsService,
        { provide: BffApiService, useValue: bffMock },
        { provide: AuthContextService, useValue: authMock },
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
});

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
