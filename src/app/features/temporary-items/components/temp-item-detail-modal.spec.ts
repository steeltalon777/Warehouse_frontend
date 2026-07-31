import { TestBed } from '@angular/core/testing';
import { TempItemDetailModalComponent } from './temp-item-detail-modal.component';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';

describe('TempItemDetailModalComponent', () => {
  let serviceMock: { loadDetail: ReturnType<typeof vi.fn>; loadOperations: ReturnType<typeof vi.fn> };

  const mockItem: TemporaryItemVm = {
    id: 'ti-1', name: 'Test', createdAt: '19.05.2026 10:00', totalBalance: 10, unitSymbol: 'шт',
    uiStatus: 'needs_review' as const, uiStatusLabel: 'Требует разбора', createdByUserId: 'u-1',
    status: 'active' as const, canConvert: true, canMergeToPermanent: true, canMergeToTemp: true,
    canDelete: false, hasPendingAcceptance: false, operationsCount: 2,
  };

  beforeEach(async () => {
    serviceMock = {
      loadDetail: vi.fn().mockResolvedValue({ balances_per_site: [{ site_id: 's-1', site_name: 'Main', balance: 10 }] }),
      loadOperations: vi.fn().mockResolvedValue([{ id: 'op-1', operation_type: 'RECEIVE', quantity: 5, created_at: '2026-05-19' }]),
    };

    await TestBed.configureTestingModule({
      imports: [TempItemDetailModalComponent],
      providers: [{ provide: TempItemsService, useValue: serviceMock }],
    }).compileComponents();
  });

  it('loads detail and operations on init', async () => {
    const fixture = TestBed.createComponent(TempItemDetailModalComponent);
    // item is an `input.required(...)`; setInput must precede the first CD.
    fixture.componentRef.setInput('item', mockItem);
    fixture.detectChanges();
    // ngOnInit awaits loadDetail + loadOperations; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(serviceMock.loadDetail).toHaveBeenCalledWith('ti-1');
    expect(serviceMock.loadOperations).toHaveBeenCalledWith('ti-1');
    expect(fixture.nativeElement.textContent).toContain('Test');
    expect(fixture.nativeElement.textContent).toContain('Main');
  });
});
