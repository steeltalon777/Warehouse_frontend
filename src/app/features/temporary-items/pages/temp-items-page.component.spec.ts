import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { TempItemsPageComponent } from './temp-items-page.component';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { BffApiService } from '../../../core/api/bff-api.service';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';
import { IdentityCandidateDto } from '../../../core/models/identity-candidate.models';

describe('TempItemsPageComponent (ADR-0033 §7.2)', () => {
  let serviceMock: Record<string, any>;

  const item: TemporaryItemVm = {
    id: 'ti-1', name: 'Болт М8 (временный)', createdAt: '19.05.2026 10:00', totalBalance: 10, unitSymbol: 'шт',
    uiStatus: 'needs_review' as const, uiStatusLabel: 'Требует разбора', createdByUserId: 'u-1',
    status: 'active' as const, canConvert: true, canMergeToPermanent: true, canMergeToTemp: true,
    canDelete: false, hasPendingAcceptance: false, hasActiveRegisters: false, operationsCount: 2,
  };

  const candidate: IdentityCandidateDto = {
    id: 500, name: 'Болт М8', sku: 'BOLT-M8',
    unit: { id: 5, name: 'штука', symbol: 'шт' },
    category: { id: 4, name: 'Крепёж' },
    is_active: true, requires_review: false, match: 'exact',
  };

  beforeEach(async () => {
    serviceMock = {
      items: signal([]),
      isLoading: signal(false),
      error: signal<string | null>(null),
      page: signal(1),
      pageSize: signal(20),
      totalCount: signal(0),
      role: signal('chief_storekeeper'),
      totalActive: signal(0),
      needsReviewCount: signal(0),
      inPendingAcceptanceCount: signal(0),
      canDeleteCount: signal(0),
      loadList: vi.fn().mockResolvedValue(undefined),
      loadRole: vi.fn().mockResolvedValue(undefined),
      loadDetail: vi.fn().mockResolvedValue(null),
      loadOperations: vi.fn().mockResolvedValue([]),
      mergeToPermanent: vi.fn().mockResolvedValue({ ok: true }),
      setPage: vi.fn(),
      setPageSize: vi.fn(),
      confirmItem: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [TempItemsPageComponent],
      providers: [
        { provide: TempItemsService, useValue: serviceMock },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: BffApiService,
          useValue: { getList: vi.fn().mockReturnValue(of({ items: [], total_count: 0, page: 1, page_size: 20 })) },
        },
      ],
    }).compileComponents();
  });

  function createPage() {
    const fixture = TestBed.createComponent(TempItemsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('opens the merge dialog with the chosen identity candidate', () => {
    const fixture = createPage();

    fixture.componentInstance.onRowClick(item);
    fixture.detectChanges();
    expect(fixture.componentInstance.showModal()).toBe(true);

    fixture.componentInstance.onMergeWithCandidate({ item, candidate });
    fixture.detectChanges();

    expect(fixture.componentInstance.showModal()).toBe(false);
    expect(fixture.componentInstance.showMergePermanentForm()).toBe(true);
    expect(fixture.componentInstance.mergeItem()?.id).toBe('ti-1');
    expect(fixture.componentInstance.mergeCandidate()?.id).toBe(500);
  });

  it('refreshes the review list and clears candidate state after a successful merge', async () => {
    const fixture = createPage();

    fixture.componentInstance.onMergeWithCandidate({ item, candidate });
    await fixture.componentInstance.onMergePermanentSubmit(item);

    expect(fixture.componentInstance.showMergePermanentForm()).toBe(false);
    expect(fixture.componentInstance.mergeItem()).toBeNull();
    expect(fixture.componentInstance.mergeCandidate()).toBeNull();
    expect(serviceMock['loadList']).toHaveBeenCalled();
  });

  it('clears the prefilled candidate on cancel', () => {
    const fixture = createPage();

    fixture.componentInstance.onMergeWithCandidate({ item, candidate });
    fixture.componentInstance.onMergePermanentCancel();

    expect(fixture.componentInstance.showMergePermanentForm()).toBe(false);
    expect(fixture.componentInstance.mergeCandidate()).toBeNull();
  });

  it('drops a stale candidate when the plain merge action is used', () => {
    const fixture = createPage();

    fixture.componentInstance.onMergeWithCandidate({ item, candidate });
    fixture.componentInstance.onRowMerge(item);

    expect(fixture.componentInstance.mergeCandidate()).toBeNull();
    expect(fixture.componentInstance.showMergePermanentForm()).toBe(true);
  });
});
