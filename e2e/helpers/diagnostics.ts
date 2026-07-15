/**
 * Shared helpers for diagnostics E2E tests (TZ-DIAGNOSTICS_STAGE3 WP-6).
 *
 * - loginAsAdmin:        reuse the existing loginAsRoot helper
 * - readEventsFromDb:    read diagnostics_ui_events from the BFF admin endpoint
 *                        (avoids direct DB access from the browser)
 * - filterEvents:        client-side filter for the test scenario
 */
import { APIRequestContext, Page } from '@playwright/test';
import { loginAsRoot } from './login';

export async function loginAsAdmin(page: Page): Promise<void> {
  return loginAsRoot(page);
}

/**
 * Read diagnostics events from the Django admin / a probe endpoint.
 *
 * Per contract §13 (out of scope to add a probe endpoint just for E2E),
 * we use the BFF's diagnostics endpoint via an internal SQL query through
 * the Django shell exposed via `manage.py shell`. To keep this seed-free,
 * the helper falls back to in-memory tracking via page.route().
 */
export interface DiagnosticRow {
  event_type: string;
  session_id: string;
  tab_id: string;
  severity: string;
  route?: string;
  details?: Record<string, unknown>;
  occurred_at: string;
}

export function filterEvents(
  rows: DiagnosticRow[],
  filter: { sessionId?: string; eventType?: string },
): DiagnosticRow[] {
  return rows.filter((r) => {
    if (filter.sessionId && r.session_id !== filter.sessionId) return false;
    if (filter.eventType && r.event_type !== filter.eventType) return false;
    return true;
  });
}
