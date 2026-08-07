import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OperationLinesTableComponent } from './operation-lines-table.component';
import type { OperationLineDraftVm } from '../../../../core/models/operations.models';

function makeLine(localId: string, itemName: string, serverLineId?: number): OperationLineDraftVm {
  return {
    localId,
    itemId: '1',
    itemName,
    unitName: 'м',
    quantity: 60,
    isTemporary: false,
    fromBalances: false,
    lineNumber: 1,
    serverLineId: serverLineId ?? null,
  };
}

const LINES: OperationLineDraftVm[] = [
  makeLine('local-1', 'Кабель', 101),
  makeLine('local-2', 'Провод', 102),
];

describe('OperationLinesTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationLinesTableComponent],
    }).compileComponents();
  });

  it('renders rows without submit errors by default', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.detectChanges();

    const erroredRows = fixture.nativeElement.querySelectorAll('.row--has-error');
    expect(erroredRows.length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.qty-input').length).toBe(2);
  });

  it('highlights errored rows and renders the shared hint with a11y attributes', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.componentRef.setInput('submitErrorLines', {
      'local-1': { groupId: 'g1', stale: false, text: 'На складе: 80.000 м, запрошено: 120.000 м' },
      'local-2': { groupId: 'g1', stale: false, text: 'На складе: 80.000 м, запрошено: 120.000 м' },
    });
    fixture.detectChanges();

    const erroredRows = fixture.nativeElement.querySelectorAll('tr.row--has-error');
    expect(erroredRows.length).toBe(2);

    const hintRow = fixture.nativeElement.querySelector('.submit-error-detail-row');
    expect(hintRow).toBeTruthy();
    const hint = hintRow.querySelector('[data-testid="operation-line-submit-hint"]');
    expect(hint.textContent.trim()).toBe('На складе: 80.000 м, запрошено: 120.000 м');

    const firstInput = fixture.nativeElement.querySelector('input[data-qty-for="local-1"]');
    expect(firstInput.getAttribute('aria-invalid')).toBe('true');
    expect(firstInput.getAttribute('aria-describedby')).toBe(
      'submit-error-hint-local-1',
    );
    const hintId = hintRow.querySelector('div[role="alert"]');
    expect(hintId.getAttribute('id')).toBe('submit-error-hint-local-1');
  });

  it('marks the group stale via the dashed class when the row was edited', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.componentRef.setInput('submitErrorLines', {
      'local-1': { groupId: 'g1', stale: true, text: 'На складе: 80.000 м, запрошено: 120.000 м' },
      'local-2': { groupId: 'g1', stale: true, text: 'На складе: 80.000 м, запрошено: 120.000 м' },
    });
    fixture.detectChanges();

    const staleRows = fixture.nativeElement.querySelectorAll('tr.row--has-error--stale');
    expect(staleRows.length).toBe(2);
  });

  it('does not highlight a row without a matching submit-error state', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.componentRef.setInput('submitErrorLines', {
      'local-1': { groupId: 'g1', stale: false, text: 'На складе: 80 м, запрошено: 120 м' },
    });
    fixture.detectChanges();

    const erroredRows = fixture.nativeElement.querySelectorAll('tr.row--has-error');
    expect(erroredRows.length).toBe(1);
    const local2Row = [...fixture.nativeElement.querySelectorAll('tr')].find(
      (tr: Element) => tr.textContent?.includes('Провод'),
    );
    expect(local2Row?.classList.contains('row--has-error')).toBe(false);
  });
});

describe('OperationLinesTableComponent — manual balance refresh button', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationLinesTableComponent],
    }).compileComponents();
  });

  it('renders the «Обновить всё» button inside th.col-avail', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.detectChanges();

    const th = fixture.nativeElement.querySelector('th.col-avail');
    expect(th).toBeTruthy();
    const button = th.querySelector('[data-testid="operation-lines-refresh-all"]');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Обновить всё');
  });

  it('emits refreshAllBalances on click and does NOT toggle sorting', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.detectChanges();

    const emitSpy = vi.spyOn(fixture.componentInstance.refreshAllBalances, 'emit');
    expect(fixture.componentInstance.sortColumn()).toBe('lineNumber');

    const button = fixture.nativeElement.querySelector(
      '[data-testid="operation-lines-refresh-all"]',
    );
    button.click();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.sortColumn()).toBe('lineNumber');
    expect(fixture.componentInstance.sortDirection()).toBe('asc');
  });

  it('disables the button and shows the spinner when isBalanceRefreshing=true', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.componentRef.setInput('isBalanceRefreshing', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="operation-lines-refresh-all"]',
    );
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.avail-refresh-spinner')).toBeTruthy();
    expect(button.querySelector('.avail-refresh-label').textContent).toBe('Обновить всё');
  });

  it('enables the button when isBalanceRefreshing=false', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.componentRef.setInput('isBalanceRefreshing', false);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '[data-testid="operation-lines-refresh-all"]',
    );
    expect(button.disabled).toBe(false);
    expect(button.querySelector('.avail-refresh-spinner')).toBeNull();
  });
});
