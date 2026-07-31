import { TestBed } from '@angular/core/testing';
import { TempItemsFiltersComponent, TempItemsFilterValues } from './temp-items-filters.component';

const defaultFilters: TempItemsFilterValues = {
  search: '', uiStatus: null, hasBalance: null, hasPendingAcceptance: null,
  createdAfter: '', createdBefore: '', createdByUserId: '',
};

describe('TempItemsFiltersComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TempItemsFiltersComponent],
    }).compileComponents();
  });

  it('emits filtersChange on status dropdown change', () => {
    const fixture = TestBed.createComponent(TempItemsFiltersComponent);
    fixture.componentRef.setInput('filters', defaultFilters);
    fixture.detectChanges();

    let emitted: any;
    fixture.componentInstance.filtersChange.subscribe((e: any) => emitted = e);

    const select = fixture.nativeElement.querySelector('select');
    select.value = 'needs_review';
    select.dispatchEvent(new Event('change'));
    expect(emitted.uiStatus).toBe('needs_review');
  });

  it('emits reset on reset button click', () => {
    const fixture = TestBed.createComponent(TempItemsFiltersComponent);
    fixture.componentRef.setInput('filters', defaultFilters);
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.reset.subscribe(() => emitted = true);

    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(emitted).toBe(true);
  });
});
