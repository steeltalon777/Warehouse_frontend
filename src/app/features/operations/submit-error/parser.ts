import type {
  KnownLineGroupError,
  KnownOperationError,
  NormalizedSubmitError,
  RawSubmitErrorEnvelope,
  SubmitErrorEnvelope,
} from './envelope';

/**
 * Parser / normalizer for the operation-submit problem envelope
 * (`docs/TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE.md` §4).
 *
 * The raw payload (`HttpErrorResponse.error` or any `unknown`) is normalized
 * into a `SubmitErrorEnvelope` whose `errors[]` are `NormalizedSubmitError`.
 * No regex parsing of text is ever performed (prohibited by ADR-0025).
 */

export interface ParseResult {
  ok: boolean;
  envelope: SubmitErrorEnvelope | null;
  unknown: boolean;
  logPayload?: unknown;
}

const LOG_PREFIX = '[submit-error]';

const KNOWN_LINE_GROUP_CODES: ReadonlySet<string> = new Set([
  'insufficient_stock',
  'insufficient_issued_balance',
]);

const KNOWN_OPERATION_CODES: ReadonlySet<string> = new Set([
  'stale_version',
  'operation_in_wrong_state',
  'role_not_permitted',
  'operation_not_found',
]);

/**
 * Normalizes an unknown `HttpErrorResponse.error` payload.
 *
 * - object with `errors[]` + string `code` → parsed as an envelope;
 * - object with `detail: string` and no `errors` → legacy fallback envelope;
 * - anything else → `{ unknown: true }` with the raw payload for logging.
 */
export function parseSubmitErrorResponse(raw: unknown): ParseResult {
  if (!isRecord(raw)) {
    return { ok: false, envelope: null, unknown: true, logPayload: raw };
  }

  if (Array.isArray(raw['errors']) && typeof raw['code'] === 'string') {
    const envelope = normalizeEnvelope(raw as unknown as RawSubmitErrorEnvelope);
    return { ok: true, envelope, unknown: false };
  }

  if (typeof raw['detail'] === 'string' && !Array.isArray(raw['errors'])) {
    return { ok: true, envelope: buildLegacyEnvelope(raw['detail']), unknown: false };
  }

  return { ok: false, envelope: null, unknown: true, logPayload: raw };
}

/**
 * Counts unique `operation_line_ids` across all line-group errors
 * (`docs/TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE.md` §7.2). Malformed groups
 * (unsafe integers) are excluded because the UI must not highlight them.
 */
export function countErroredLines(envelope: SubmitErrorEnvelope): number {
  const ids = new Set<number>();
  for (const error of envelope.errors) {
    if (error.kind === 'known_line_group' && !error.malformed) {
      for (const id of error.operation_line_ids) ids.add(id);
    }
  }
  return ids.size;
}

function normalizeEnvelope(raw: RawSubmitErrorEnvelope): SubmitErrorEnvelope {
  const detail = typeof raw.detail === 'string' ? raw.detail : '';
  const errors = (Array.isArray(raw.errors) ? raw.errors : []).map((error) =>
    normalizeError(error, detail),
  );

  const envelope: SubmitErrorEnvelope = {
    type: raw.type,
    title: raw.title,
    status: raw.status,
    code: raw.code,
    detail,
    errors,
  };
  if (raw.instance !== undefined) envelope.instance = raw.instance;
  if (raw.trace_id !== undefined) envelope.trace_id = raw.trace_id;
  return envelope;
}

function normalizeError(raw: unknown, envelopeDetail: string): NormalizedSubmitError {
  if (!isRecord(raw)) {
    return { kind: 'unknown', code: 'unknown', scope: 'operation', detail: envelopeDetail };
  }

  const code = typeof raw['code'] === 'string' ? raw['code'] : '';
  const scope = raw['scope'] === 'line_group' ? 'line_group' : 'operation';

  if (KNOWN_LINE_GROUP_CODES.has(code) && scope === 'line_group') {
    if (hasMissingLineGroupFields(raw)) {
      console.error(`${LOG_PREFIX} missing_required_fields`, { code, scope, error: raw });
      return { kind: 'unknown', code, scope, detail: envelopeDetail };
    }

    const malformed = hasUnsafeLineIds(raw['operation_line_ids']);
    if (malformed) {
      console.error(`${LOG_PREFIX} unsafe_integer`, {
        code,
        operation_line_ids: raw['operation_line_ids'],
      });
    }

    const error: KnownLineGroupError = {
      kind: 'known_line_group',
      code: code as KnownLineGroupError['code'],
      operation_line_ids: raw['operation_line_ids'] as number[],
      item: raw['item'] as { id: number; name: string },
      required_qty: raw['required_qty'] as string,
      available_qty: raw['available_qty'] as string,
    };
    if (raw['stock_site'] !== undefined) {
      error.stock_site = raw['stock_site'] as { id: number; name: string };
    }
    if (raw['issue_object'] !== undefined) {
      error.issue_object = raw['issue_object'] as { id: number; name: string };
    }
    if (raw['unit'] !== undefined) {
      error.unit = raw['unit'] as { id: number; name: string; symbol: string };
    }
    if (malformed) error.malformed = true;
    return error;
  }

  if (KNOWN_OPERATION_CODES.has(code) && scope === 'operation') {
    const error: KnownOperationError = {
      kind: 'known_operation',
      code: code as KnownOperationError['code'],
    };
    if (raw['expected_version'] !== undefined) {
      error.expected_version = raw['expected_version'] as number;
    }
    if (raw['actual_version'] !== undefined) {
      error.actual_version = raw['actual_version'] as number;
    }
    if (raw['current_state'] !== undefined) {
      error.current_state = raw['current_state'] as string;
    }
    if (raw['allowed_states'] !== undefined) {
      error.allowed_states = raw['allowed_states'] as string[];
    }
    return error;
  }

  return { kind: 'unknown', code, scope, detail: envelopeDetail };
}

function hasMissingLineGroupFields(raw: Record<string, unknown>): boolean {
  return (
    !Array.isArray(raw['operation_line_ids']) ||
    raw['operation_line_ids'].length === 0 ||
    !isRecord(raw['item']) ||
    typeof raw['required_qty'] !== 'string' ||
    typeof raw['available_qty'] !== 'string'
  );
}

function hasUnsafeLineIds(ids: unknown): boolean {
  return Array.isArray(ids) && ids.some((id) => !Number.isSafeInteger(id));
}

function buildLegacyEnvelope(detail: string): SubmitErrorEnvelope {
  return {
    type: 'urn:warehouse:problem:legacy',
    title: 'Ошибка сервера',
    status: 0,
    code: 'unknown',
    detail,
    errors: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
