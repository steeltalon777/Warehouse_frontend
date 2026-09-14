import { TestBed } from '@angular/core/testing';
import { TempItemDetailModalComponent } from './temp-item-detail-modal.component';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';
import { IdentityCandidateDto } from '../../../core/models/identity-candidate.models';

describe('TempItemDetailModalComponent', () => {
  let serviceMock: { loadDetail: ReturnType<typeof vi.fn>; loadOperations: ReturnType<typeof vi.fn> };

  const mockItem: TemporaryItemVm = {
    id: 'ti-1', name: 'Test', createdAt: '19.05.2026 10:00', totalBalance: 10, unitSymbol: 'шт',
    uiStatus: 'needs_review' as const, uiStatusLabel: 'Требует разбора', createdByUserId: 'u-1',
    status: 'active' as const, canConvert: true, canMergeToPermanent: true, canMergeToTemp: true,
    canDelete: false, hasPendingAcceptance: false, hasActiveRegisters: false, operationsCount: 2,
  };

  const CANDIDATES: IdentityCandidateDto[] = [
    {
      id: 500, name: 'Болт М8', sku: 'BOLT-M8',
      unit: { id: 5, name: 'штука', symbol: 'шт' },
      category: { id: 4, name: 'Крепёж' },
      is_active: true, requires_review: false, match: 'exact',
    },
    {
      id: 501, name: 'Болт М8 оцинк.', sku: 'BOLT-M8Z',
      unit: { id: 5, name: 'штука', symbol: 'шт' },
      category: { id: 4, name: 'Крепёж' },
      is_active: true, requires_review: true, match: 'partial',
    },
  ];

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

  async function createModal(detail: unknown, itemOverride?: TemporaryItemVm) {
    serviceMock.loadDetail.mockResolvedValue(detail);
    const fixture = TestBed.createComponent(TempItemDetailModalComponent);
    // item is an `input.required(...)`; setInput must precede the first CD.
    fixture.componentRef.setInput('item', itemOverride ?? mockItem);
    fixture.detectChanges();
    // ngOnInit awaits loadDetail + loadOperations; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    return fixture;
  }

  it('loads detail and operations on init', async () => {
    const fixture = await createModal({
      balances_per_site: [{ site_id: 's-1', site_name: 'Main', balance: 10 }],
    });

    expect(serviceMock.loadDetail).toHaveBeenCalledWith('ti-1');
    expect(serviceMock.loadOperations).toHaveBeenCalledWith('ti-1');
    expect(fixture.nativeElement.textContent).toContain('Test');
    expect(fixture.nativeElement.textContent).toContain('Main');
  });

  it('renders no identity section when detail has no candidates', async () => {
    const fixture = await createModal({ balances_per_site: [] });

    expect(fixture.nativeElement.querySelector('[data-testid="review-identity-candidates"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="review-identity-merge"]').length).toBe(0);
  });

  it('renders identity fields for every candidate and emits the chosen one', async () => {
    const fixture = await createModal({
      balances_per_site: [{ site_id: 's-1', site_name: 'Main', balance: 10 }],
      identity_candidates: CANDIDATES,
    });

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="review-identity-candidate"]');
    expect(rows.length).toBe(2);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Болт М8');
    expect(text).toContain('BOLT-M8');
    expect(text).toContain('Крепёж');
    expect(text).toContain('Точное совпадение');
    expect(text).toContain('Возможное совпадение');
    expect(text).toContain('Кандидат тоже на проверке');

    let emitted: { item: TemporaryItemVm; candidate: IdentityCandidateDto } | undefined;
    fixture.componentInstance.mergeWithCandidate.subscribe((e: any) => (emitted = e));

    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="review-identity-merge"]');
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
    (buttons[1] as HTMLButtonElement).click();

    expect(emitted?.item.id).toBe('ti-1');
    expect(emitted?.candidate.id).toBe(501);
    expect(emitted?.candidate.name).toBe('Болт М8 оцинк.');
  });

  it('disables the merge CTA when the review item has no balance', async () => {
    // The list DTO carries no balance, so readiness must come from the detail:
    // a zero-balance review item (e.g. still pending acceptance) must not merge.
    const fixture = await createModal({ balances_per_site: [], identity_candidates: CANDIDATES });

    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="review-identity-merge"]');
    expect(buttons.length).toBe(2);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[0] as HTMLButtonElement).title).toContain('Нет остатка для слияния');
  });

  it('hides the section when the candidate payload is malformed', async () => {
    const fixture = await createModal({
      balances_per_site: [],
      identity_candidates: [{ id: null, name: '' }, 'junk'],
    });

    expect(fixture.nativeElement.querySelector('[data-testid="review-identity-candidates"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="review-identity-merge"]').length).toBe(0);
  });

  it('renders only valid candidates when the payload is partially malformed', async () => {
    const fixture = await createModal({
      balances_per_site: [],
      identity_candidates: [
        { id: 42, name: 'Валидный', match: 'partial' },
        { id: 'oops', name: '' },
      ],
    });

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="review-identity-candidate"]');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Валидный');
  });
});
