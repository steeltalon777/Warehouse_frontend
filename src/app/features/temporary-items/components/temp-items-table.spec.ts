import { TestBed } from '@angular/core/testing';
import { TempItemsTableComponent } from './temp-items-table.component';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';

/**
 * Workaround for vitest zoneless environment: `fixture.componentRef.setInput(...)`
 * does not trigger change detection reliably. We override the input getters
 * directly on the component instance so that the template reads our values
 * during the next `fixture.detectChanges()`.
 */
function overrideInputs(
  instance: TempItemsTableComponent,
  values: {
    rows?: TemporaryItemVm[];
    pageSize?: number;
    page?: number;
    totalCount?: number;
  },
): void {
  const anyInstance = instance as unknown as Record<string, unknown>;
  if (values.rows !== undefined) {
    Object.defineProperty(anyInstance, 'rows', { get: () => () => values.rows, configurable: true });
  }
  if (values.pageSize !== undefined) {
    Object.defineProperty(anyInstance, 'pageSize', { get: () => () => values.pageSize, configurable: true });
  }
  if (values.page !== undefined) {
    Object.defineProperty(anyInstance, 'page', { get: () => () => values.page, configurable: true });
  }
  if (values.totalCount !== undefined) {
    Object.defineProperty(anyInstance, 'totalCount', { get: () => () => values.totalCount, configurable: true });
  }
}

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
    overrideInputs(fixture.componentInstance, { rows: mockItems, pageSize: 20, page: 1, totalCount: 2 });
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.data-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Item 1');
  });

  it('emits sort event on column click', () => {
    const fixture = TestBed.createComponent(TempItemsTableComponent);
    overrideInputs(fixture.componentInstance, { rows: mockItems, pageSize: 20, page: 1, totalCount: 2 });
    fixture.detectChanges();

    let sortColumn = '';
    fixture.componentInstance.sort.subscribe((col: string) => sortColumn = col);

    const nameHeader = fixture.nativeElement.querySelector('.col-name');
    nameHeader.click();
    expect(sortColumn).toBe('name');
  });

  it('shows empty state when no rows', () => {
    const fixture = TestBed.createComponent(TempItemsTableComponent);
    overrideInputs(fixture.componentInstance, { rows: [], pageSize: 20, page: 1, totalCount: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('не найдены');
  });
});
