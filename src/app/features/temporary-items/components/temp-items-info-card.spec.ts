import { TestBed } from '@angular/core/testing';
import { TempItemsInfoCardComponent } from './temp-items-info-card.component';

describe('TempItemsInfoCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TempItemsInfoCardComponent],
    }).compileComponents();
  });

  it('renders all counts', () => {
    const fixture = TestBed.createComponent(TempItemsInfoCardComponent);
    fixture.componentRef.setInput('totalActive', 12);
    fixture.componentRef.setInput('needsReviewCount', 7);
    fixture.componentRef.setInput('inPendingCount', 3);
    fixture.componentRef.setInput('canDeleteCount', 2);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('12');
    expect(fixture.nativeElement.textContent).toContain('7');
    expect(fixture.nativeElement.textContent).toContain('3');
    expect(fixture.nativeElement.textContent).toContain('2');
  });
});
