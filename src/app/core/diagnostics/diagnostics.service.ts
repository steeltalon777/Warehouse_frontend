import { Inject, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthContextService } from '../services/auth-context.service';
import { DiagnosticsSessionService } from '../services/diagnostics-session.service';
import {
  DIAGNOSTICS_QUEUE_PORT,
  DiagnosticEventDetails,
  DiagnosticEventInput,
  DiagnosticEventType,
  DiagnosticEventVm,
  DiagnosticSeverity,
  DiagnosticsQueuePort,
} from './diagnostics.models';

/**
 * DiagnosticsService — единая точка входа для UI-диагностики.
 *
 * Принимает события от компонентов/сервисов через `track()`,
 * обогащает их контекстом (session, route, auth, draft) и
 * передаёт в DiagnosticsQueueService (через DIAGNOSTICS_QUEUE_PORT).
 *
 * Per contract §7.1 / §8.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticsService {
  private readonly queue = inject<DiagnosticsQueuePort>(DIAGNOSTICS_QUEUE_PORT);
  private readonly session = inject(DiagnosticsSessionService);
  private readonly auth = inject(AuthContextService);
  private readonly router = inject(Router);

  /**
   * Записать диагностическое событие.
   * @param type тип события (из DiagnosticEventType)
   * @param input необязательный контекст (HTTP, draft, error и т.п.)
   */
  track(type: DiagnosticEventType, input?: DiagnosticEventInput): void {
    const authCtx = this.auth.authContext();
    const route = this.router.url || undefined;

    const event: DiagnosticEventVm = {
      event_id: this.newEventId(),
      event_type: type,
      occurred_at: new Date().toISOString(),
      session_id: this.session.sessionId,
      tab_id: this.session.tabId,
      frontend_version: this.session.frontendVersion,
      severity: this.severityFor(type),
    };

    if (route) event.route = route;
    if (authCtx?.userId) event.user_id = authCtx.userId;
    if (authCtx?.defaultSiteId) event.site_id = authCtx.defaultSiteId;
    if (input?.operationType) event.operation_type = input.operationType;
    else if (input?.draft?.type) event.operation_type = input.draft.type;
    if (input?.draft?.draftId) event.draft_id = input.draft.draftId;
    if (input?.draft?.idempotencyKey) event.idempotency_key = input.draft.idempotencyKey;
    if (this.session.lastServerRequestId) {
      event.server_request_id = this.session.lastServerRequestId;
    }

    const details = this.buildDetails(input);
    if (details) event.details = details;

    try {
      this.queue.enqueue(event);
    } catch {
      // Diagnostics must never break the app.
    }
  }

  private buildDetails(input?: DiagnosticEventInput): DiagnosticEventDetails | undefined {
    if (!input) return undefined;
    const d: DiagnosticEventDetails = {};
    if (input.itemsCount !== undefined) d.items_count = input.itemsCount;
    if (input.durationMs !== undefined) d.duration_ms = input.durationMs;
    if (input.httpMethod) d.http_method = input.httpMethod;
    if (input.httpUrl) d.http_url = input.httpUrl;
    if (input.httpStatus !== undefined) d.http_status = input.httpStatus;
    if (input.errorCode) d.error_code = input.errorCode;
    if (input.errorMessage) d.error_message = input.errorMessage.slice(0, 200);
    if (input.draftStatus) d.draft_status = input.draftStatus;
    if (input.hasUnsavedChanges !== undefined) d.has_unsaved_changes = input.hasUnsavedChanges;
    if (input.reason) d.reason = input.reason.slice(0, 500);
    if (input.stackTraceSnippet) d.stack_trace_snippet = input.stackTraceSnippet.slice(0, 300);
    return Object.keys(d).length > 0 ? d : undefined;
  }

  private severityFor(type: DiagnosticEventType): DiagnosticSeverity {
    switch (type) {
      case 'unexpected_error':
        return 'critical';
      case 'request_failed':
      case 'response_processing_failed':
        return 'error';
      case 'validation_failed':
      case 'outcome_unknown':
      case 'navigation_away_with_unsaved':
        return 'warning';
      default:
        return 'info';
    }
  }

  private newEventId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }
}
