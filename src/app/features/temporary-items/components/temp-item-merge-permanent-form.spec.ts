import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TempItemMergePermanentFormComponent } from './temp-item-merge-permanent-form.component';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { BffApiService } from '../../../core/api/bff-api.service';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';
import { IdentityCandidateDto } from '../../../core/models/identity-candidate.models';

describe('TempItemMergePermanentFormComponent (ADR-0033 §7.2)', () => {
  let serviceMock: { mergeToPermanent: ReturnType<typeof vi.fn> };
  let bffMock: { getList: ReturnType<typeof vi.fn> };

  const item: TemporaryItemVm = {
    id: 'ti-1', name: 'Болт М8 (временный)', createdAt: '19.05.2026 10:00', totalBalance: 10, unitSymbol: 'шт',
    uiStatus: 'needs_review' as const, uiStatusLabel: 'Требует разбора', createdByUserId: 'u-1',
    status: 'active' as const, canConvert: true, canMergeToPermanent: true, canMergeToTemp: true,
    canDelete: false, hasPendingAcceptance: false, operationsCount: 2,
  };

  const candidate: IdentityCandidateDto = {
    id: 500, name: 'Болт М8', sku: 'BOLT-M8',
    unit: { id: 5, name: 'штука', symbol: 'шт' },
    category: { id: 4, name: 'Крепёж' },
    is_active: true, requires_review: false, match: 'exact',
  };

  beforeEach(async () => {
    serviceMock = { mergeToPermanent: vi.fn().mockResolvedValue({ ok: true }) };
    bffMock = {
      getList: vi.fn().mockReturnValue(of({ items: [], total_count: 0, page: 1, page_size: 20 })),
    };

    await TestBed.configureTestingModule({
      imports: [TempItemMergePermanentFormComponent],
      providers: [
        { provide: TempItemsService, useValue: serviceMock },
        { provide: BffApiService, useValue: bffMock },
      ],
    }).compileComponents();
  });

  function create(prefill: IdentityCandidateDto | null) {
    const fixture = TestBed.createComponent(TempItemMergePermanentFormComponent);
    fixture.componentRef.setInput('item', item);
    if (prefill) fixture.componentRef.setInput('prefillTarget', prefill);
    fixture.detectChanges();
    return fixture;
  }

  it('prefills the merge target from the identity candidate', () => {
    const fixture = create(candidate);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Болт М8');
    expect(text).toContain('BOLT-M8');
    expect(text).toContain('точное');

    const submit = fixture.nativeElement.querySelector('[data-testid="merge-submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it('merges into the prefilled candidate and emits on success', async () => {
    const fixture = create(candidate);
    let emitted: TemporaryItemVm | undefined;
    fixture.componentInstance.submit.subscribe((e: any) => (emitted = e));

    await fixture.componentInstance.onSubmit();

    expect(serviceMock.mergeToPermanent).toHaveBeenCalledWith('ti-1', '500', undefined);
    expect(emitted?.id).toBe('ti-1');
  });

  it('shows the structured error and does not emit on failure', async () => {
    serviceMock.mergeToPermanent.mockResolvedValue({
      ok: false,
      error: { code: 'conflict', message: 'item review already resolved (status=merged)' },
    });
    const fixture = create(candidate);
    let emitted = false;
    fixture.componentInstance.submit.subscribe(() => (emitted = true));

    await fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="merge-error-banner"]');
    expect(banner?.textContent).toContain('item review already resolved (status=merged)');
    expect(emitted).toBe(false);
  });

  it('requires manual confirmation when the candidate unit differs', () => {
    const kgCandidate: IdentityCandidateDto = {
      ...candidate,
      id: 700,
      unit: { id: 6, name: 'килограмм', symbol: 'кг' },
      match: 'partial',
    };
    const fixture = create(kgCandidate);

    expect(fixture.nativeElement.textContent).toContain('Единицы измерения не совпадают');
    const submit = fixture.nativeElement.querySelector('[data-testid="merge-submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('falls back to a generic message when the structured error has no text', async () => {
    serviceMock.mergeToPermanent.mockResolvedValue({
      ok: false,
      error: { code: 'merge_failed', message: '' },
    });
    const fixture = create(candidate);

    await fixture.componentInstance.onSubmit();
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="merge-error-banner"]');
    expect(banner?.textContent).toContain('Ошибка при слиянии');
  });
});
