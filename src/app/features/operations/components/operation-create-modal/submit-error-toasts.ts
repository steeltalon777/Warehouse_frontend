import type { KnownLineGroupError, SubmitErrorEnvelope, UnknownError } from '../../submit-error/envelope';
import { countErroredLines } from '../../submit-error/parser';

/**
 * Toast texts and hint formatting for the operation-submit error surface
 * (TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE §7, §8). Pure functions so the
 * modal keeps them unit-testable.
 */

export const OPERATION_LEVEL_TOAST_MESSAGES: Record<string, string> = {
  stale_version: 'Операция была изменена другим пользователем. Перечитайте данные.',
  operation_in_wrong_state: 'Операцию нельзя провести в текущем состоянии.',
  role_not_permitted: 'Недостаточно прав для проведения операции.',
  operation_not_found: 'Операция не найдена.',
  operation_cancel_rejected: 'Не удалось отменить операцию.',
};

export const GENERIC_SUBMIT_ERROR_TOAST =
  'Не удалось провести операцию. Попробуйте ещё раз или обратитесь к администратору.';

export function lineGroupToast(lineCount: number): string {
  return `Не удалось провести операцию: ошибки в ${lineCount} строках`;
}

/**
 * Inline hint under an errored row: «На складе: X м, запрошено: Y м».
 * `required_qty` / `available_qty` are displayed as-is (strings); the unit
 * symbol is appended only when the envelope carries one (§6.2).
 */
export function formatSubmitStockHint(error: KnownLineGroupError): string {
  const unit = error.unit?.symbol ? ` ${error.unit.symbol}` : '';
  return `На складе: ${error.available_qty}${unit}, запрошено: ${error.required_qty}${unit}`;
}

/**
 * Builds the toast list for a failed submit envelope (§7, §8.2):
 * - line-group errors → one toast with the unique errored-line count;
 * - each operation-level error → its fixed text;
 * - unknown errors / unparseable envelope → one generic toast.
 * Falls back to the generic toast when nothing more specific applies.
 */
export function buildSubmitToasts(envelope: SubmitErrorEnvelope | null): string[] {
  if (!envelope) return [GENERIC_SUBMIT_ERROR_TOAST];

  const toasts: string[] = [];
  let hasLineGroup = false;
  let hasUnknown = false;

  for (const error of envelope.errors) {
    if (error.kind === 'known_line_group') {
      if (!error.malformed) hasLineGroup = true;
    } else if (error.kind === 'known_operation') {
      toasts.push(OPERATION_LEVEL_TOAST_MESSAGES[error.code] ?? GENERIC_SUBMIT_ERROR_TOAST);
    } else {
      hasUnknown = true;
    }
  }

  if (hasLineGroup) {
    toasts.push(lineGroupToast(countErroredLines(envelope)));
  }
  if (hasUnknown) {
    toasts.push(GENERIC_SUBMIT_ERROR_TOAST);
  }
  if (toasts.length === 0) {
    toasts.push(GENERIC_SUBMIT_ERROR_TOAST);
  }
  return toasts;
}

/** Unknown `errors[]` entries for console logging (§8.2, §12.1). */
export function collectUnknownSubmitErrors(
  envelope: SubmitErrorEnvelope | null,
): UnknownError[] {
  if (!envelope) return [];
  return envelope.errors.filter((error): error is UnknownError => error.kind === 'unknown');
}
