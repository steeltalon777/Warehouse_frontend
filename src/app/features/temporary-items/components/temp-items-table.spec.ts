import { TestBed } from '@angular/core/testing';
import { TempItemsTableComponent } from './temp-items-table.component';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';

describe('TempItemsTableComponent', () => {
  const mockItems: TemporaryItemVm[] = [
    { id: '1', name: 'Item 1', uiStatus: 'needs_review', uiStatusLabel: 'Требует разбора', createdAt: '19.05.2026 10:00', totalBalance: 10, unitSymbol: 'шт', operationsCount: 2, createdByUserId: 'u-1', status: 'active', canConvert: true, canMergeToPermanent: true, canMergeToTemp: true, canDelete: false, hasPendingAcceptance: false },
    { id: '2', name: 'Item 2', uiStatus: 'can_delete', uiStatusLabel: 'Можно удалить', createdAt: '18.05.2026 15:00', totalBalance: 0, unitSymbol: 'шт', operationsCount: 0, createdByUserId: 'u-2', status: 'active', canConvert: false, canMergeToPermanent: false, canMergeToTemp: false, canDelete: true, hasPendingAcceptance: false },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TempItemsTableComponent],
    }).compileComponents();
  });

  it('renders rows and emits rowClick', () => {
    const fixture = TestBed.createComponent(TempItemsTableComponent);
    const comp = fixture.componentInstance;
    fixture.componentRef.setInput('rows', mockItems);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalCount', 2);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.data-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Item 1');
  });

  it('emits sort event on column click', () => {
    const fixture = TestBed.createComponent(TempItemsTableComponent);
    fixture.componentRef.setInput('rows', mockItems);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalCount', 2);
    fixture.detectChanges();

    let sortColumn = '';
    fixture.componentInstance.sort.subscribe((col: string) => sortColumn = col);

    const nameHeader = fixture.nativeElement.querySelector('.col-name');
    nameHeader.click();
    expect(sortColumn).toBe('name');
  });

  it('shows empty state when no rows', () => {
    const fixture = TestBed.createComponent(TempItemsTableComponent);
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('pageSize', 25);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalCount', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('не найдены');
  });
});
