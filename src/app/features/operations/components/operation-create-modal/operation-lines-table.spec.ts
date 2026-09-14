import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { OperationLinesTableComponent, type IdentityCandidateAction } from './operation-lines-table.component';
import type { OperationLineDraftVm } from '../../../../core/models/operations.models';
import type { IdentityCandidateRef } from '../../../../core/models/identity-candidate.models';

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

describe('OperationLinesTableComponent — ADR-0033 identity candidates', () => {
  const CANDIDATES: IdentityCandidateRef[] = [
    {
      id: 500,
      name: 'Болт М8',
      sku: 'BOLT-M8',
      unit: { id: 5, name: 'штука', symbol: 'шт' },
      category: { id: 4, name: 'Крепёж' },
      match: 'exact',
    },
    { id: 501, name: 'Болт М8 оцинк.', match: 'partial' },
  ];

  const IDENTITY_HINT = 'ТМЦ «Болт М8» уже существует в каталоге. Используйте существующую позицию';

  function createFixture() {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationLinesTableComponent],
    }).compileComponents();
  });

  it('renders candidates with name/SKU/unit/category and one action button per candidate', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('submitErrorLines', {
      'local-1': {
        groupId: 'g1',
        stale: false,
        text: IDENTITY_HINT,
        identityDuplicate: { requestedName: 'Болт М8', candidates: CANDIDATES, intraBatch: false },
      },
    });
    fixture.detectChanges();

    const block = fixture.nativeElement.querySelector(
      '[data-testid="identity-duplicate-candidates"]',
    ) as HTMLElement;
    expect(block).toBeTruthy();
    expect(block.textContent).toContain('Болт М8');
    expect(block.textContent).toContain('BOLT-M8');
    expect(block.textContent).toContain('шт');
    expect(block.textContent).toContain('Крепёж');
    expect(block.querySelectorAll('[data-testid="identity-candidate-use"]').length).toBe(2);

    const hint = fixture.nativeElement.querySelector('[data-testid="operation-line-submit-hint"]');
    expect(hint.textContent.trim()).toBe(IDENTITY_HINT);
  });

  it('does not render the candidate block for an intra-batch duplicate but keeps the hint', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('submitErrorLines', {
      'local-1': {
        groupId: 'g1',
        stale: false,
        text: 'ТМЦ «Болт М8» указана в нескольких строках операции одинаково',
        identityDuplicate: { requestedName: 'Болт М8', candidates: [], intraBatch: true },
      },
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="identity-duplicate-candidates"]'),
    ).toBeNull();
    const hint = fixture.nativeElement.querySelector('[data-testid="operation-line-submit-hint"]');
    expect(hint.textContent).toContain('в нескольких строках операции');
  });

  it('does not render the candidate block when the candidate list is empty', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('submitErrorLines', {
      'local-1': {
        groupId: 'g1',
        stale: false,
        text: IDENTITY_HINT,
        identityDuplicate: { requestedName: 'Болт М8', candidates: [], intraBatch: false },
      },
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="identity-duplicate-candidates"]'),
    ).toBeNull();
  });

  it('emits useIdentityCandidate with the row localId and the clicked candidate', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('submitErrorLines', {
      'local-1': {
        groupId: 'g1',
        stale: false,
        text: IDENTITY_HINT,
        identityDuplicate: { requestedName: 'Болт М8', candidates: CANDIDATES, intraBatch: false },
      },
    });
    fixture.detectChanges();

    const emitted: IdentityCandidateAction[] = [];
    fixture.componentInstance.useIdentityCandidate.subscribe(action => emitted.push(action));

    const buttons = fixture.nativeElement.querySelectorAll(
      '[data-testid="identity-candidate-use"]',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    fixture.detectChanges();

    expect(emitted).toEqual([{ localId: 'local-1', candidate: CANDIDATES[1] }]);
  });
});

describe('OperationLinesTableComponent — balance column (refresh button moved to modal-table-toolbar)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationLinesTableComponent],
    }).compileComponents();
  });

  it('does NOT render the refresh button inside the table (it now lives in modal-table-toolbar)', () => {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.detectChanges();

    // The «Имеется» column header still exists (TZ §22: .col-avail).
    const th = fixture.nativeElement.querySelector('th.col-avail');
    expect(th).toBeTruthy();
    // The refresh button is no longer inside the table — it lives in the
    // modal-table-toolbar per TZ §13. The data-testid is preserved globally
    // (modal E2E specs verify it).
    expect(fixture.nativeElement.querySelector('[data-testid="operation-lines-refresh-all"]')).toBeNull();
  });
});

describe('OperationLinesTableComponent — Stage 1 read-only mode', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationLinesTableComponent],
    }).compileComponents();
  });

  /** `[disabled]` on an ngModel control is applied by NgModel in a microtask. */
  async function flush(fixture: ReturnType<typeof TestBed.createComponent>): Promise<void> {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  }

  async function createFixture(isReadonly: boolean) {
    const fixture = TestBed.createComponent(OperationLinesTableComponent);
    fixture.componentRef.setInput('lines', LINES);
    fixture.componentRef.setInput('operationType', 'MOVE');
    fixture.componentRef.setInput('isReadonly', isReadonly);
    await flush(fixture);
    return fixture;
  }

  it('hides every remove button and disables qty inputs in read-only mode', async () => {
    const fixture = await createFixture(true);

    expect(fixture.nativeElement.querySelectorAll('.remove-btn').length).toBe(0);
    const qtyInputs = fixture.nativeElement.querySelectorAll('.qty-input');
    expect(qtyInputs.length).toBe(2);
    for (const input of qtyInputs) {
      expect((input as HTMLInputElement).disabled).toBe(true);
    }
  });

  it('keeps remove buttons and editable qty inputs in draft mode', async () => {
    const fixture = await createFixture(false);

    expect(fixture.nativeElement.querySelectorAll('.remove-btn').length).toBe(2);
    const qtyInputs = fixture.nativeElement.querySelectorAll('.qty-input');
    for (const input of qtyInputs) {
      expect((input as HTMLInputElement).disabled).toBe(false);
    }
  });
});
