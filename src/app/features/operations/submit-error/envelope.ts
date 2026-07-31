/**
 * Raw and normalized DTOs for the operation-submit problem envelope.
 *
 * SOURCE OF TRUTH: the Pydantic schemas in
 * `docs/TZ-SYNCSERVER_OPERATION_SUBMIT_DOMAIN_ERRORS.md` §3.3
 * (`ProblemEnvelope`, `InsufficientStockError`, `InsufficientIssuedBalanceError`,
 * `StaleVersionError`, `OperationInWrongStateError`, `RoleNotPermittedError`,
 * `OperationNotFoundError`). These interfaces are a manual mirror; if the
 * Pydantic schema changes, update this file to match. The TypeScript types are
 * NOT the source of truth — the Pydantic schema is.
 */

/**
 * Raw DTO — exact mirror of a single JSON `errors[]` item, without narrowing.
 * Any `code` value is allowed here; narrowing happens in the normalizer.
 */
export interface RawSubmitError {
  code: string;
  scope: 'operation' | 'line_group';
  operation_line_ids?: number[];
  item?: { id: number; name: string };
  stock_site?: { id: number; name: string };
  issue_object?: { id: number; name: string };
  required_qty?: string;
  available_qty?: string;
  unit?: { id: number; name: string; symbol: string };
  expected_version?: number;
  actual_version?: number;
  current_state?: string;
  allowed_states?: string[];
}

/** Raw envelope — mirror of `ProblemEnvelope` (TZ-SYNCSERVER §3.3). */
export interface RawSubmitErrorEnvelope {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
  trace_id?: string;
  errors: RawSubmitError[];
}

/**
 * Known error codes. Single source of truth on the frontend, synchronized with
 * TZ-SYNCSERVER §3.3. If the server adds a code, extend this union.
 */
export type KnownErrorCode =
  | 'insufficient_stock'
  | 'insufficient_issued_balance'
  | 'stale_version'
  | 'operation_in_wrong_state'
  | 'role_not_permitted'
  | 'operation_not_found';

/**
 * Known line-group error: mapped to the affected rows via `operation_line_ids`.
 * `unit` is display-only; it never participates in balance aggregation.
 */
export interface KnownLineGroupError {
  kind: 'known_line_group';
  code: 'insufficient_stock' | 'insufficient_issued_balance';
  operation_line_ids: number[];
  item: { id: number; name: string };
  stock_site?: { id: number; name: string };
  issue_object?: { id: number; name: string };
  required_qty: string;
  available_qty: string;
  unit?: { id: number; name: string; symbol: string };
  /**
   * Set when at least one `operation_line_ids[i]` is not a safe integer
   * (`Number.isSafeInteger`, TZ-FRONTEND §3.3). The group is kept for
   * diagnostics but must NOT be highlighted or used for line lookups by the UI.
   */
  malformed?: boolean;
}

/** Known operation-level error: shown as a toast, never highlighted inline. */
export interface KnownOperationError {
  kind: 'known_operation';
  code: Exclude<KnownErrorCode, 'insufficient_stock' | 'insufficient_issued_balance'>;
  expected_version?: number;
  actual_version?: number;
  current_state?: string;
  allowed_states?: string[];
}

/**
 * Unrecognized code or failed normalization.
 * `detail` always comes from `envelope.detail` — the server contract has no
 * `errors[].detail` field.
 */
export interface UnknownError {
  kind: 'unknown';
  code: string;
  scope: 'operation' | 'line_group';
  detail?: string;
}

export type NormalizedSubmitError = KnownLineGroupError | KnownOperationError | UnknownError;

/**
 * Normalized envelope: same shape as `RawSubmitErrorEnvelope`, but `errors[]`
 * are `NormalizedSubmitError[]` — ready for the error service and the UI.
 */
export interface SubmitErrorEnvelope {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
  trace_id?: string;
  errors: NormalizedSubmitError[];
}
