import type { RawSubmitErrorEnvelope } from './envelope';

/**
 * JSON fixtures for the operation-submit problem envelope.
 *
 * Taken from the examples in `docs/TZ-SYNCSERVER_OPERATION_SUBMIT_DOMAIN_ERRORS.md`
 * §3.3 / §10 (Pydantic schemas) and `docs/TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE.md`
 * §13. The parser.spec.ts contract tests assert that each fixture deserializes
 * into the expected normalized types; any mismatch means the TypeScript mirror
 * drifted from the Pydantic schema.
 */

const BASE_ENVELOPE = {
  type: 'urn:warehouse:problem:operation-submit-rejected',
  title: 'Недостаточно товара',
  status: 409,
  code: 'operation-submit-rejected',
  instance: '/api/v1/operations/3f2b9c0e-9c1a-4f6d-9b10-2f1d3c4e5a6b/submit',
  trace_id: 'trace-0001',
} as const;

export const FIXTURE_INSUFFICIENT_STOCK_WITH_UNIT: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  detail:
    'Недостаточно товара: Кабель — запрошено 120, на складе 80. Всего проблемных групп: 1.',
  errors: [
    {
      code: 'insufficient_stock',
      scope: 'line_group',
      operation_line_ids: [1, 2],
      item: { id: 100, name: 'Кабель' },
      stock_site: { id: 1, name: 'Основной склад' },
      required_qty: '120.000',
      available_qty: '80.000',
      unit: { id: 3, name: 'метр', symbol: 'м' },
    },
  ],
};

export const FIXTURE_INSUFFICIENT_STOCK_WITHOUT_UNIT: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  detail:
    'Недостаточно товара: Болт — запрошено 10, на складе 5. Всего проблемных групп: 1.',
  errors: [
    {
      code: 'insufficient_stock',
      scope: 'line_group',
      operation_line_ids: [7],
      item: { id: 101, name: 'Болт' },
      stock_site: { id: 2, name: 'Склад Б' },
      required_qty: '10.000',
      available_qty: '5.000',
    },
  ],
};

export const FIXTURE_INSUFFICIENT_ISSUED_BALANCE: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  title: 'Недостаточно выданного остатка',
  detail: 'Недостаточно выданного остатка по Кабель.',
  errors: [
    {
      code: 'insufficient_issued_balance',
      scope: 'line_group',
      operation_line_ids: [3],
      item: { id: 100, name: 'Кабель' },
      issue_object: { id: 7, name: 'Объект А' },
      required_qty: '25.000',
      available_qty: '10.000',
      unit: { id: 3, name: 'метр', symbol: 'м' },
    },
  ],
};

export const FIXTURE_STALE_VERSION: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  title: 'Операция была изменена',
  detail: 'Операция была изменена в другой вкладке. Актуальная версия 3.',
  errors: [{ code: 'stale_version', scope: 'operation', expected_version: 2, actual_version: 3 }],
};

export const FIXTURE_OPERATION_IN_WRONG_STATE: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  title: 'Некорректное состояние операции',
  detail: 'Операция в статусе «SUBMITTED», для проведения требуется «DRAFT».',
  errors: [
    {
      code: 'operation_in_wrong_state',
      scope: 'operation',
      current_state: 'SUBMITTED',
      allowed_states: ['DRAFT'],
    },
  ],
};

export const FIXTURE_ROLE_NOT_PERMITTED: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  title: 'Недостаточно прав',
  status: 403,
  detail: 'Недостаточно прав для проведения операции.',
  errors: [{ code: 'role_not_permitted', scope: 'operation' }],
};

export const FIXTURE_OPERATION_NOT_FOUND: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  type: 'urn:warehouse:problem:operation-not-found',
  title: 'Операция не найдена',
  status: 404,
  code: 'operation-not-found',
  detail: 'Операция не найдена.',
  errors: [{ code: 'operation_not_found', scope: 'operation' }],
};

export const FIXTURE_AGGREGATED_LINE_GROUP: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  detail:
    'Недостаточно товара: Кабель — запрошено 120, на складе 80. Всего проблемных групп: 1.',
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
  ],
};

/**
 * Unknown code fixture. The error item deliberately carries a rogue `detail`
 * field — the server contract has no `errors[].detail`, so the parser must
 * ignore it and use `envelope.detail` instead.
 */
export const FIXTURE_UNKNOWN_CODE = {
  ...BASE_ENVELOPE,
  title: 'Неизвестная ошибка',
  detail: 'Новый тип доменной ошибки от сервера.',
  errors: [
    { code: 'future_unknown_code', scope: 'line_group', detail: 'detail не с уровня errors[]' },
  ],
} as unknown as RawSubmitErrorEnvelope;

/** Legacy format: plain `{detail: string}` without `errors`/`code`. */
export const FIXTURE_LEGACY_DETAIL_ONLY: { detail: string } = {
  detail: 'sync_error: сервер вернул ошибку в старом формате',
};

/** Known line_group code with a missing mandatory field (`item`). */
export const FIXTURE_INSUFFICIENT_STOCK_MISSING_ITEM: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  detail: 'Недостаточно товара: — запрошено 120, на складе 80.',
  errors: [
    {
      code: 'insufficient_stock',
      scope: 'line_group',
      operation_line_ids: [1],
      stock_site: { id: 1, name: 'Основной склад' },
      required_qty: '120.000',
      available_qty: '80.000',
    },
  ],
};

/** Known line_group code whose `operation_line_ids` overflow a safe integer. */
export const FIXTURE_INSUFFICIENT_STOCK_UNSAFE_LINE_ID: RawSubmitErrorEnvelope = {
  ...BASE_ENVELOPE,
  detail: 'Недостаточно товара: Кабель — запрошено 120, на складе 80.',
  errors: [
    {
      code: 'insufficient_stock',
      scope: 'line_group',
      operation_line_ids: [Number.MAX_SAFE_INTEGER + 1],
      item: { id: 100, name: 'Кабель' },
      stock_site: { id: 1, name: 'Основной склад' },
      required_qty: '120.000',
      available_qty: '80.000',
    },
  ],
};
