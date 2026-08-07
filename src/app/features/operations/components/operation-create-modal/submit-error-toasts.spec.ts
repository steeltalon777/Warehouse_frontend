import { describe, it, expect } from 'vitest';
import { parseSubmitErrorResponse } from '../../submit-error/parser';
import {
  FIXTURE_AGGREGATED_LINE_GROUP,
  FIXTURE_INSUFFICIENT_STOCK_WITHOUT_UNIT,
  FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT,
  FIXTURE_OPERATION_IN_WRONG_STATE,
  FIXTURE_OPERATION_NOT_FOUND,
  FIXTURE_ROLE_NOT_PERMITTED,
  FIXTURE_STALE_VERSION,
  FIXTURE_UNKNOWN_CODE,
} from '../../submit-error/envelope.fixtures';
import {
  buildSubmitToasts,
  collectUnknownSubmitErrors,
  formatSubmitStockHint,
  GENERIC_SUBMIT_ERROR_TOAST,
  lineGroupToast,
  OPERATION_LEVEL_TOAST_MESSAGES,
} from './submit-error-toasts';

function parseFixture(fixture: unknown) {
  const result = parseSubmitErrorResponse(fixture);
  expect(result.ok, 'fixture must parse').toBe(true);
  return result.envelope!;
}

describe('submit-error-toasts', () => {
  it('line-group-only envelope produces one toast with the unique errored-line count', () => {
    const envelope = parseFixture(FIXTURE_AGGREGATED_LINE_GROUP);
    expect(buildSubmitToasts(envelope)).toEqual([lineGroupToast(2)]);
  });

  it('aggregated group dedupes line ids (errors [1,4] and [1,4] count as 2 lines)', () => {
    // Two distinct line-group errors referencing the same ids must still count
    // unique lines, not the length of errors[] (TZ §7).
    const envelope = parseFixture({
      ...FIXTURE_AGGREGATED_LINE_GROUP,
      errors: [
        {
          code: 'insufficient_stock',
          scope: 'line_group',
          operation_line_ids: [1, 4],
          item: { id: 100, name: 'Кабель' },
          stock_site: { id: 1, name: 'Основной склад' },
          required_qty: '120.000',
          available_qty: '80.000',
          unit: { id: 3, name: 'метр', symbol: 'м' },
        },
        {
          code: 'insufficient_stock',
          scope: 'line_group',
          operation_line_ids: [7, 9],
          item: { id: 200, name: 'Болт' },
          stock_site: { id: 1, name: 'Основной склад' },
          required_qty: '5.000',
          available_qty: '3.000',
          unit: { id: 5, name: 'штука', symbol: 'шт' },
        },
      ],
    });
    expect(buildSubmitToasts(envelope)).toEqual([lineGroupToast(4)]);
  });

  it('stale_version produces the fixed operation-level toast', () => {
    const envelope = parseFixture(FIXTURE_STALE_VERSION);
    expect(buildSubmitToasts(envelope)).toEqual([
      'Операция была изменена другим пользователем. Перечитайте данные.',
    ]);
  });

  it('operation_in_wrong_state produces its fixed toast', () => {
    const envelope = parseFixture(FIXTURE_OPERATION_IN_WRONG_STATE);
    expect(buildSubmitToasts(envelope)).toEqual([
      'Операцию нельзя провести в текущем состоянии.',
    ]);
  });

  it('role_not_permitted produces its fixed toast', () => {
    const envelope = parseFixture(FIXTURE_ROLE_NOT_PERMITTED);
    expect(buildSubmitToasts(envelope)).toEqual(['Недостаточно прав для проведения операции.']);
  });

  it('operation_not_found produces its fixed toast', () => {
    const envelope = parseFixture(FIXTURE_OPERATION_NOT_FOUND);
    expect(buildSubmitToasts(envelope)).toEqual(['Операция не найдена.']);
  });

  it('OPERATION_LEVEL_TOAST_MESSAGES covers the cancel-flow operation-level code', () => {
    expect(OPERATION_LEVEL_TOAST_MESSAGES['operation_cancel_rejected']).toBe(
      'Не удалось отменить операцию.',
    );
  });

  it('mixture of line-group and operation errors yields one toast per kind', () => {
    const envelope = parseFixture({
      ...FIXTURE_STALE_VERSION,
      errors: [
        ...FIXTURE_STALE_VERSION.errors,
        {
          code: 'insufficient_stock',
          scope: 'line_group',
          operation_line_ids: [1, 4],
          item: { id: 100, name: 'Кабель' },
          stock_site: { id: 1, name: 'Основной склад' },
          required_qty: '120.000',
          available_qty: '80.000',
          unit: { id: 3, name: 'метр', symbol: 'м' },
        },
      ],
    });
    expect(buildSubmitToasts(envelope)).toEqual([
      'Операция была изменена другим пользователем. Перечитайте данные.',
      lineGroupToast(2),
    ]);
  });

  it('unknown code falls back to the generic toast and is collected for logging', () => {
    const envelope = parseFixture(FIXTURE_UNKNOWN_CODE);
    expect(buildSubmitToasts(envelope)).toEqual([GENERIC_SUBMIT_ERROR_TOAST]);
    const unknown = collectUnknownSubmitErrors(envelope);
    expect(unknown).toHaveLength(1);
    expect(unknown[0].code).toBe('future_unknown_code');
  });

  it('null envelope (unparseable payload) produces the generic toast', () => {
    expect(buildSubmitToasts(null)).toEqual([GENERIC_SUBMIT_ERROR_TOAST]);
  });

  it('empty errors array produces the generic toast', () => {
    const envelope = parseFixture({
      type: 'urn:warehouse:problem:sync-error',
      title: 'Ошибка',
      status: 502,
      code: 'sync_error',
      detail: 'Что-то сломалось',
      errors: [],
    });
    expect(buildSubmitToasts(envelope)).toEqual([GENERIC_SUBMIT_ERROR_TOAST]);
  });

  it('formatSubmitStockHint appends the unit symbol when present', () => {
    const envelope = parseFixture(FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT);
    const group = envelope.errors.find(e => e.kind === 'known_line_group')!;
    if (group.kind !== 'known_line_group') throw new Error('expected line group');
    expect(formatSubmitStockHint(group)).toBe('На складе: 80.000 м, запрошено: 120.000 м');
  });

  it('formatSubmitStockHint omits the unit symbol when absent', () => {
    const envelope = parseFixture(FIXTURE_INSUFFICIENT_STOCK_WITHOUT_UNIT);
    const group = envelope.errors.find(e => e.kind === 'known_line_group')!;
    if (group.kind !== 'known_line_group') throw new Error('expected line group');
    expect(formatSubmitStockHint(group)).toBe('На складе: 5.000, запрошено: 10.000');
  });
});
