import { InjectionToken } from '@angular/core';

// ──────────────────────────────────────────────
// §3 DTO событий — DiagnosticEventType
// ──────────────────────────────────────────────

export type DiagnosticEventType =
  | 'form_opened'
  | 'form_closed'
  | 'submit_clicked'
  | 'validation_failed'
  | 'request_started'
  | 'request_succeeded'
  | 'request_failed'
  | 'outcome_unknown'
  | 'response_processing_failed'
  | 'navigation_away_with_unsaved'
  | 'unexpected_error'
  // TZ Stage 4 (draft protection):
  | 'draft_autosaved'
  | 'draft_restored'
  | 'draft_lost'
  | 'draft_cleared';

export type DiagnosticSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface DiagnosticEventDetails {
  items_count?: number;
  invalid_items_count?: number;
  duration_ms?: number;
  http_method?: string;
  http_url?: string;
  http_status?: number;
  error_code?: string;
  error_message?: string;
  draft_status?: string;
  has_unsaved_changes?: boolean;
  reason?: string;
  stack_trace_snippet?: string;
}

export interface DiagnosticEventVm {
  event_id: string;
  event_type: DiagnosticEventType;
  occurred_at: string;
  session_id: string;
  tab_id: string;
  frontend_version: string;
  route?: string;
  operation_type?: string;
  draft_id?: string;
  idempotency_key?: string;
  http_request_id?: string;
  server_request_id?: string;
  user_id?: string;
  device_id?: string;
  site_id?: string;
  severity: DiagnosticSeverity;
  details?: DiagnosticEventDetails;
}

export interface DiagnosticEventBatchVm {
  events: DiagnosticEventVm[];
  sent_at: string;
  sequence: number;
}

// ──────────────────────────────────────────────
// Port interface для DiagnosticsQueueService (Agent C)
// ──────────────────────────────────────────────

export interface DiagnosticsQueuePort {
  enqueue(event: DiagnosticEventVm): void;
}

export const DIAGNOSTICS_QUEUE_PORT = new InjectionToken<DiagnosticsQueuePort>(
  'DIAGNOSTICS_QUEUE_PORT',
);

// ──────────────────────────────────────────────
// Convenience type для параметра track()
// ──────────────────────────────────────────────

export interface DiagnosticEventInput {
  draft?: { draftId?: string; idempotencyKey?: string; type?: string; lines?: unknown[] };
  operationType?: string;
  httpMethod?: string;
  httpUrl?: string;
  httpStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  itemsCount?: number;
  reason?: string;
  stackTraceSnippet?: string;
  hasUnsavedChanges?: boolean;
  draftStatus?: string;
}
