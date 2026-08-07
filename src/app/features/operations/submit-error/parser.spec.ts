import { parseSubmitErrorResponse } from './parser';
import type { SubmitErrorEnvelope } from './envelope';
import {
  FIXTURE_AGGREGATED_LINE_GROUP,
  FIXTURE_INSUFFICIENT_ISSUED_BALANCE,
  FIXTURE_INSUFFICIENT_STOCK_MISSING_ITEM,
  FIXTURE_INSUFFICIENT_STOCK_UNSAFE_LINE_ID,
  FIXTURE_INSUFFICIENT_STOCK_WITHOUT_UNIT,
  FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT,
  FIXTURE_LEGACY_DETAIL_ONLY,
  FIXTURE_OPERATION_IN_WRONG_STATE,
  FIXTURE_OPERATION_NOT_FOUND,
  FIXTURE_ROLE_NOT_PERMITTED,
  FIXTURE_STALE_VERSION,
  FIXTURE_UNKNOWN_CODE,
} from './envelope.fixtures';

describe('parseSubmitErrorResponse', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses an envelope with insufficient_stock into KnownLineGroupError', () => {
    const result = parseSubmitErrorResponse(FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT);

    expect(result.ok).toBe(true);
    expect(result.unknown).toBe(false);
    expect(result.envelope).not.toBeNull();

    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_line_group');
    if (error.kind === 'known_line_group') {
      expect(error.code).toBe('insufficient_stock');
      expect(error.operation_line_ids).toEqual([1, 2]);
      expect(error.item).toEqual({ id: 100, name: 'Кабель' });
      expect(error.stock_site).toEqual({ id: 1, name: 'Основной склад' });
      expect(error.required_qty).toBe('120.000');
      expect(error.available_qty).toBe('80.000');
      expect(error.unit).toEqual({ id: 3, name: 'метр', symbol: 'м' });
      expect(error.malformed).toBeUndefined();
    }
  });

  it('parses an insufficient_stock envelope without a unit', () => {
    const result = parseSubmitErrorResponse(FIXTURE_INSUFFICIENT_STOCK_WITHOUT_UNIT);

    expect(result.ok).toBe(true);
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_line_group');
    if (error.kind === 'known_line_group') {
      expect(error.unit).toBeUndefined();
      expect(error.operation_line_ids).toEqual([7]);
    }
  });

  it('parses an insufficient_issued_balance envelope into KnownLineGroupError', () => {
    const result = parseSubmitErrorResponse(FIXTURE_INSUFFICIENT_ISSUED_BALANCE);

    expect(result.ok).toBe(true);
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_line_group');
    if (error.kind === 'known_line_group') {
      expect(error.code).toBe('insufficient_issued_balance');
      expect(error.issue_object).toEqual({ id: 7, name: 'Объект А' });
      expect(error.stock_site).toBeUndefined();
    }
  });

  it('downgrades a line_group error with a missing required field to UnknownError and logs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = parseSubmitErrorResponse(FIXTURE_INSUFFICIENT_STOCK_MISSING_ITEM);

    expect(result.ok).toBe(true);
    expect(result.envelope).not.toBeNull();
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('unknown');
    if (error.kind === 'unknown') {
      expect(error.code).toBe('insufficient_stock');
      expect(error.scope).toBe('line_group');
      expect(error.detail).toBe(FIXTURE_INSUFFICIENT_STOCK_MISSING_ITEM.detail);
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('missing_required_fields'),
      expect.objectContaining({ code: 'insufficient_stock', scope: 'line_group' }),
    );
    consoleSpy.mockRestore();
  });

  it('parses a stale_version envelope into KnownOperationError', () => {
    const result = parseSubmitErrorResponse(FIXTURE_STALE_VERSION);

    expect(result.ok).toBe(true);
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_operation');
    if (error.kind === 'known_operation') {
      expect(error.code).toBe('stale_version');
      expect(error.expected_version).toBe(2);
      expect(error.actual_version).toBe(3);
    }
  });

  it('parses an operation_in_wrong_state envelope with current_state and allowed_states', () => {
    const result = parseSubmitErrorResponse(FIXTURE_OPERATION_IN_WRONG_STATE);

    expect(result.ok).toBe(true);
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_operation');
    if (error.kind === 'known_operation') {
      expect(error.code).toBe('operation_in_wrong_state');
      expect(error.current_state).toBe('SUBMITTED');
      expect(error.allowed_states).toEqual(['DRAFT']);
    }
  });

  it('parses a role_not_permitted envelope into KnownOperationError with minimal fields', () => {
    const result = parseSubmitErrorResponse(FIXTURE_ROLE_NOT_PERMITTED);

    expect(result.ok).toBe(true);
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_operation');
    if (error.kind === 'known_operation') {
      expect(error.code).toBe('role_not_permitted');
      expect(error.expected_version).toBeUndefined();
      expect(error.actual_version).toBeUndefined();
      expect(error.current_state).toBeUndefined();
      expect(error.allowed_states).toBeUndefined();
    }
  });

  it('parses an operation_not_found envelope into KnownOperationError', () => {
    const result = parseSubmitErrorResponse(FIXTURE_OPERATION_NOT_FOUND);

    expect(result.ok).toBe(true);
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_operation');
    if (error.kind === 'known_operation') {
      expect(error.code).toBe('operation_not_found');
    }
  });

  it('parses an aggregated line_group keeping both line ids', () => {
    const result = parseSubmitErrorResponse(FIXTURE_AGGREGATED_LINE_GROUP);

    expect(result.ok).toBe(true);
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_line_group');
    if (error.kind === 'known_line_group') {
      expect(error.operation_line_ids).toEqual([1, 4]);
    }
  });

  it('maps an unknown code to UnknownError with detail from envelope.detail, not errors[].detail', () => {
    const result = parseSubmitErrorResponse(FIXTURE_UNKNOWN_CODE);

    expect(result.ok).toBe(true);
    expect(result.envelope).not.toBeNull();
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('unknown');
    if (error.kind === 'unknown') {
      expect(error.code).toBe('future_unknown_code');
      expect(error.scope).toBe('line_group');
      expect(error.detail).toBe(FIXTURE_UNKNOWN_CODE.detail);
      expect(error.detail).not.toBe('detail не с уровня errors[]');
    }
  });

  it('flags an unsafely large line id as malformed and logs unsafe_integer', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = parseSubmitErrorResponse(FIXTURE_INSUFFICIENT_STOCK_UNSAFE_LINE_ID);

    expect(result.ok).toBe(true);
    expect(result.envelope).not.toBeNull();
    const [error] = result.envelope!.errors;
    expect(error.kind).toBe('known_line_group');
    if (error.kind === 'known_line_group') {
      expect(error.operation_line_ids).toEqual([Number.MAX_SAFE_INTEGER + 1]);
      expect(error.malformed).toBe(true);
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('unsafe_integer'),
      expect.objectContaining({ operation_line_ids: [Number.MAX_SAFE_INTEGER + 1] }),
    );
    consoleSpy.mockRestore();
  });

  it('parses a cancel-flow envelope (operation_cancel_rejected) with a line-group deficit', () => {
    const result = parseSubmitErrorResponse({
      type: 'urn:warehouse:problem:operation-cancel-rejected',
      title: 'Операция не может быть отменена',
      status: 409,
      code: 'operation_cancel_rejected',
      detail:
        'Недостаточно товара: Кабель ВВГ — запрошено 2, на складе 0. Всего проблемных групп: 1.',
      errors: [
        {
          code: 'insufficient_stock',
          scope: 'line_group',
          operation_line_ids: [1],
          item: { id: 100, name: 'Кабель ВВГ' },
          stock_site: { id: 1, name: 'Склад' },
          required_qty: '2',
          available_qty: '0',
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.unknown).toBe(false);
    const envelope = result.envelope as SubmitErrorEnvelope;
    expect(envelope.type).toBe('urn:warehouse:problem:operation-cancel-rejected');
    expect(envelope.code).toBe('operation_cancel_rejected');
    expect(envelope.status).toBe(409);
    expect(envelope.detail).toContain('Недостаточно товара: Кабель ВВГ');

    const [error] = envelope.errors;
    expect(error.kind).toBe('known_line_group');
    if (error.kind === 'known_line_group') {
      expect(error.code).toBe('insufficient_stock');
      expect(error.operation_line_ids).toEqual([1]);
      expect(error.item).toEqual({ id: 100, name: 'Кабель ВВГ' });
      expect(error.required_qty).toBe('2');
      expect(error.available_qty).toBe('0');
    }
  });

  it('falls back to a legacy envelope for a bare {detail: string} payload', () => {
    const result = parseSubmitErrorResponse(FIXTURE_LEGACY_DETAIL_ONLY);

    expect(result.ok).toBe(true);
    expect(result.unknown).toBe(false);
    const envelope = result.envelope as SubmitErrorEnvelope;
    expect(envelope.code).toBe('unknown');
    expect(envelope.detail).toBe(FIXTURE_LEGACY_DETAIL_ONLY.detail);
    expect(envelope.errors).toEqual([]);
  });

  it.each([null, 'some string payload', 42, ['not', 'an', 'object']])(
    'returns unknown:true for an unparseable payload %s',
    (raw) => {
      const result = parseSubmitErrorResponse(raw);

      expect(result.ok).toBe(false);
      expect(result.unknown).toBe(true);
      expect(result.envelope).toBeNull();
      expect(result.logPayload).toBe(raw);
    },
  );
});
