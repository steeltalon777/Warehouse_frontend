import { TestBed } from '@angular/core/testing';
import { TempItemsService } from './temp-items.service';
import { BffApiService } from '../api/bff-api.service';
import { of, throwError } from 'rxjs';

describe('TempItemsService', () => {
  let service: TempItemsService;
  let bffMock: { getList: ReturnType<typeof vi.fn>; getData: ReturnType<typeof vi.fn>; postData: ReturnType<typeof vi.fn>; deleteData: ReturnType<typeof vi.fn> };

  const mockItem = {
    id: 'ti-1',
    name: 'Test Item',
    status: 'active',
    total_balance: 10,
    created_by_user_id: 'u-1',
    created_at: '2026-05-19T10:00:00Z',
  };

  beforeEach(() => {
    bffMock = {
      getList: vi.fn(),
      getData: vi.fn(),
      postData: vi.fn(),
      deleteData: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TempItemsService,
        { provide: BffApiService, useValue: bffMock },
      ],
    });

    service = TestBed.inject(TempItemsService);
  });

  it('should load list and compute VMs', async () => {
    bffMock.getList.mockReturnValue(of({
      items: [mockItem],
      total_count: 1,
      page: 1,
      page_size: 25,
    }));

    await service.loadList();

    expect(service.items().length).toBe(1);
    expect(service.items()[0].uiStatus).toBe('needs_review');
    expect(service.totalCount()).toBe(1);
  });

  it('should handle load errors', async () => {
    bffMock.getList.mockReturnValue(throwError(() => ({ message: 'Network error' })));

    await service.loadList();

    expect(service.error()).toBe('Network error');
    expect(service.isLoading()).toBe(false);
  });

  it('should compute action flags correctly', async () => {
    bffMock.getList.mockReturnValue(of({
      items: [
        { ...mockItem, id: 'ti-1', total_balance: 10, status: 'active' },
        { ...mockItem, id: 'ti-2', total_balance: 0, status: 'active' },
        { ...mockItem, id: 'ti-3', total_balance: 10, status: 'approved_as_item' },
      ],
      total_count: 3,
      page: 1,
      page_size: 25,
    }));

    service.role.set('chief_storekeeper');
    await service.loadList();

    expect(service.items()[0].canConvert).toBe(true);
    expect(service.items()[0].canDelete).toBe(false);

    expect(service.items()[1].canDelete).toBe(true);
    expect(service.items()[1].canConvert).toBe(false);

    expect(service.items()[2].canConvert).toBe(false);
    expect(service.items()[2].canDelete).toBe(false);
  });

  it('should use server action-state fields from the list response', async () => {
    bffMock.getList.mockReturnValue(of({
      items: [
        { ...mockItem, id: 'ti-1', total_balance: '5.500', has_pending_acceptance: false, has_active_registers: false },
        { ...mockItem, id: 'ti-2', total_balance: '0.000', has_pending_acceptance: true, has_active_registers: true },
        { ...mockItem, id: 'ti-3', total_balance: '0.000', has_pending_acceptance: false, has_active_registers: true },
      ],
      total_count: 3,
      page: 1,
      page_size: 25,
    }));

    service.role.set('chief_storekeeper');
    await service.loadList();

    const [free, pending, lostOrIssued] = service.items();

    expect(free.totalBalance).toBe(5.5);
    expect(free.hasPendingAcceptance).toBe(false);
    expect(free.hasActiveRegisters).toBe(false);
    expect(free.canConvert).toBe(true);
    expect(free.canDelete).toBe(false);

    expect(pending.totalBalance).toBe(0);
    expect(pending.hasPendingAcceptance).toBe(true);
    expect(pending.canConvert).toBe(false);
    expect(pending.canDelete).toBe(false);

    expect(lostOrIssued.hasActiveRegisters).toBe(true);
    expect(lostOrIssued.canConvert).toBe(false);
    expect(lostOrIssued.canDelete).toBe(false);
    expect(lostOrIssued.deleteBlockedReason).toContain('активные регистры');
  });

  it('should default missing action-state fields to safe zeros', async () => {
    bffMock.getList.mockReturnValue(of({
      items: [{ ...mockItem, id: 'ti-legacy', total_balance: undefined }],
      total_count: 1,
      page: 1,
      page_size: 25,
    }));

    service.role.set('chief_storekeeper');
    await service.loadList();

    const vm = service.items()[0];
    expect(vm.totalBalance).toBe(0);
    expect(vm.hasPendingAcceptance).toBe(false);
    expect(vm.hasActiveRegisters).toBe(false);
  });

  it('should restrict actions for storekeeper role', async () => {
    bffMock.getList.mockReturnValue(of({
      items: [mockItem],
      total_count: 1,
      page: 1,
      page_size: 25,
    }));

    service.role.set('storekeeper');
    await service.loadList();

    expect(service.items()[0].canConvert).toBe(false);
    expect(service.items()[0].canMergeToPermanent).toBe(false);
    expect(service.items()[0].canDelete).toBe(false);
  });

  it('should load detail via getData and normalize balance rows', async () => {
    const detail = {
      ...mockItem,
      balances_per_site: [{ site_id: 5, site_name: 'Толочи', qty: 7 }],
      operations: [],
      identity_candidates: [{ id: 500, name: 'Болт М8', match: 'exact' }],
    };
    bffMock.getData.mockReturnValue(of(detail));

    const result = await service.loadDetail('ti-1');

    expect(bffMock.getData).toHaveBeenCalledWith('/review-items/ti-1');
    expect(result?.identity_candidates?.length).toBe(1);
    // SyncServer sends `qty`; the UI model needs `balance`.
    expect(result?.balances_per_site).toEqual([
      { site_id: '5', site_name: 'Толочи', balance: 7 },
    ]);
  });

  it('should approve as item via postData', async () => {
    bffMock.postData.mockReturnValue(of({}));

    const result = await service.approveAsItem('ti-1', { name: 'New Item', category_id: 'cat-1', unit_id: 'u-1' });

    expect(bffMock.postData).toHaveBeenCalledWith(
      '/review-items/ti-1/confirm',
      { name: 'New Item', category_id: 'cat-1', unit_id: 'u-1' }
    );
    expect(result).toBe(true);
  });

  it('should merge review item and return ok result', async () => {
    bffMock.postData.mockReturnValue(of({}));

    const result = await service.mergeToPermanent('ti-1', '500');

    expect(bffMock.postData).toHaveBeenCalledWith(
      '/review-items/ti-1/merge',
      { target_item_id: '500' }
    );
    expect(result).toEqual({ ok: true });
  });

  it('should preserve the structured merge error', async () => {
    bffMock.postData.mockReturnValue(
      throwError(() => ({ code: 'conflict', message: 'item review already resolved' }))
    );

    const result = await service.mergeToPermanent('ti-1', '500', 'note');

    expect(bffMock.postData).toHaveBeenCalledWith(
      '/review-items/ti-1/merge',
      { target_item_id: '500', comment: 'note' }
    );
    expect(result).toEqual({
      ok: false,
      error: { code: 'conflict', message: 'item review already resolved' },
    });
  });

  it('should fall back to a generic merge error', async () => {
    bffMock.postData.mockReturnValue(throwError(() => ({})));

    const result = await service.mergeToPermanent('ti-1', '500');

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('merge_failed');
    expect(result.error?.message).toBe('Ошибка при слиянии');
  });
});
