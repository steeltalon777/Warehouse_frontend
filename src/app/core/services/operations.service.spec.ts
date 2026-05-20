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
    const op = makeOperation('pending', { created_by_user_id: 'user-2' });
    bffMock.getList.mockReturnValue(of({ items: [op], total_count: 1, page: 1, page_size: 20 }));

    await service.loadList({
      search: '', type: null, status: null, siteId: null,
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
