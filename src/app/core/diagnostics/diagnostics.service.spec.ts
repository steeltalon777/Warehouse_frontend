import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthContextService } from '../services/auth-context.service';
import { DiagnosticsSessionService } from '../services/diagnostics-session.service';
import {
  DIAGNOSTICS_QUEUE_PORT,
  DiagnosticEventInput,
  DiagnosticEventVm,
} from './diagnostics.models';
import { DiagnosticsService } from './diagnostics.service';

describe('DiagnosticsService', () => {
  let service: DiagnosticsService;
  let enqueued: DiagnosticEventVm[];
  let mockQueue: { enqueue: ReturnType<typeof vi.fn> };
  let mockSession: Partial<DiagnosticsSessionService>;
  let mockAuth: { authContext: ReturnType<typeof vi.fn> };
  let mockRouter: { url: string };

  beforeEach(() => {
    enqueued = [];
    mockQueue = {
      enqueue: vi.fn((e: DiagnosticEventVm) => {
        enqueued.push(e);
      }),
    };
    mockSession = {
      sessionId: '00000000-0000-0000-0000-000000000001',
      tabId: '00000000-0000-0000-0000-000000000002',
      frontendVersion: 'test-v1',
      lastServerRequestId: null,
    };
    mockAuth = {
      authContext: vi.fn(() => ({ userId: 'user-1', role: 'root', defaultSiteId: '1' })),
    };
    mockRouter = { url: '/operations' };

    TestBed.configureTestingModule({
      providers: [
        DiagnosticsService,
        { provide: DIAGNOSTICS_QUEUE_PORT, useValue: mockQueue },
        { provide: DiagnosticsSessionService, useValue: mockSession },
        { provide: AuthContextService, useValue: mockAuth },
        { provide: Router, useValue: mockRouter },
      ],
    });

    service = TestBed.inject(DiagnosticsService);
  });

  it('creates an event with all identity fields populated from services', () => {
    service.track('form_opened');
    expect(enqueued).toHaveLength(1);
    const e = enqueued[0];
    expect(e.event_type).toBe('form_opened');
    expect(e.session_id).toBe('00000000-0000-0000-0000-000000000001');
    expect(e.tab_id).toBe('00000000-0000-0000-0000-000000000002');
    expect(e.frontend_version).toBe('test-v1');
    expect(e.user_id).toBe('user-1');
    expect(e.site_id).toBe('1');
    expect(e.route).toBe('/operations');
    expect(e.severity).toBe('info');
    expect(e.event_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('assigns severity correctly for each event type', () => {
    const cases: Array<[string, string]> = [
      ['form_opened', 'info'],
      ['submit_clicked', 'info'],
      ['request_started', 'info'],
      ['request_succeeded', 'info'],
      ['validation_failed', 'warning'],
      ['outcome_unknown', 'warning'],
      ['navigation_away_with_unsaved', 'warning'],
      ['request_failed', 'error'],
      ['response_processing_failed', 'error'],
      ['unexpected_error', 'critical'],
    ];
    for (const [type, expected] of cases) {
      enqueued = [];
      service.track(type as any);
      expect(enqueued[0]?.severity, `severity for ${type}`).toBe(expected);
    }
  });

  it('truncates error_message to 200 chars', () => {
    const long = 'x'.repeat(500);
    service.track('request_failed', { errorMessage: long });
    expect(enqueued[0].details?.error_message).toHaveLength(200);
  });

  it('truncates reason to 500 chars', () => {
    const long = 'x'.repeat(1000);
    service.track('validation_failed', { reason: long });
    expect(enqueued[0].details?.reason).toHaveLength(500);
  });

  it('truncates stack_trace_snippet to 300 chars (only for unexpected_error)', () => {
    const long = 'x'.repeat(800);
    service.track('unexpected_error', { stackTraceSnippet: long });
    expect(enqueued[0].details?.stack_trace_snippet).toHaveLength(300);
  });

  it('does not include draft lines content in details (PII guard)', () => {
    const input: DiagnosticEventInput = {
      draft: {
        draftId: 'd-1',
        idempotencyKey: 'k-1',
        type: 'RECEIVE',
        lines: [{ name: 'Секретный ТМЦ', qty: 999 }],
      },
      itemsCount: 1,
    };
    service.track('form_opened', input);
    const e = enqueued[0];
    expect(e.draft_id).toBe('d-1');
    expect(e.idempotency_key).toBe('k-1');
    expect(e.operation_type).toBe('RECEIVE');
    // itemsCount is allowed (aggregate)
    expect(e.details?.items_count).toBe(1);
    // But the lines themselves must NOT appear
    const json = JSON.stringify(e);
    expect(json).not.toContain('Секретный ТМЦ');
    expect(json).not.toContain('999');
  });

  it('handles null auth context gracefully', () => {
    mockAuth.authContext = vi.fn(() => null);
    service.track('form_opened');
    const e = enqueued[0];
    expect(e.user_id).toBeUndefined();
    expect(e.site_id).toBeUndefined();
  });

  it('handles empty router url gracefully', () => {
    mockRouter.url = '';
    service.track('form_opened');
    const e = enqueued[0];
    expect(e.route).toBeUndefined();
  });

  it('enriches event with server_request_id when set', () => {
    mockSession.lastServerRequestId = 'srv-req-1';
    service.track('request_succeeded');
    expect(enqueued[0].server_request_id).toBe('srv-req-1');
  });

  it('does not throw if queue.enqueue throws (defensive)', () => {
    mockQueue.enqueue = vi.fn(() => {
      throw new Error('queue down');
    });
    expect(() => service.track('form_opened')).not.toThrow();
  });

  it('includes http details when provided', () => {
    service.track('request_failed', {
      httpMethod: 'POST',
      httpUrl: '/bff/api/v1/operations',
      httpStatus: 500,
      errorCode: 'internal_error',
      durationMs: 1234,
    });
    const d = enqueued[0].details!;
    expect(d.http_method).toBe('POST');
    expect(d.http_url).toBe('/bff/api/v1/operations');
    expect(d.http_status).toBe(500);
    expect(d.error_code).toBe('internal_error');
    expect(d.duration_ms).toBe(1234);
  });
});
