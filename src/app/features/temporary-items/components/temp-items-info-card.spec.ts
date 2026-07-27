import { TestBed } from '@angular/core/testing';
import { TempItemsInfoCardComponent } from './temp-items-info-card.component';

/**
 * Workaround for vitest zoneless environment: see temp-items-table.spec.ts
 * for the rationale. `setInput` does not trigger CD here.
 */
function overrideInputs(
  instance: TempItemsInfoCardComponent,
  values: { totalActive?: number; needsReviewCount?: number; inPendingCount?: number; canDeleteCount?: number },
): void {
  const anyInstance = instance as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) {
      Object.defineProperty(anyInstance, k, { get: () => () => v, configurable: true });
    }
  }
}

describe('TempItemsInfoCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TempItemsInfoCardComponent],
    }).compileComponents();
  });

  it('renders all counts', () => {
    const fixture = TestBed.createComponent(TempItemsInfoCardComponent);
    overrideInputs(fixture.componentInstance, {
      totalActive: 12, needsReviewCount: 7, inPendingCount: 3, canDeleteCount: 2,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('12');
    expect(fixture.nativeElement.textContent).toContain('7');
    expect(fixture.nativeElement.textContent).toContain('3');
    expect(fixture.nativeElement.textContent).toContain('2');
  });
});
