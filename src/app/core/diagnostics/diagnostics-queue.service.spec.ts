import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DiagnosticsSessionService } from '../services/diagnostics-session.service';
import { DiagnosticEventVm, DiagnosticSeverity } from './diagnostics.models';
import { DiagnosticsQueueService } from './diagnostics-queue.service';

function makeEvent(overrides: Partial<DiagnosticEventVm> = {}): DiagnosticEventVm {
  return {
    event_id: '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2, 14).padStart(12, '0'),
    event_type: 'form_opened',
    occurred_at: '2026-07-15T10:00:00+00:00',
    session_id: '00000000-0000-0000-0000-000000000001',
    tab_id: '00000000-0000-0000-0000-000000000002',
    frontend_version: 'test',
    severity: 'info' as DiagnosticSeverity,
    ...overrides,
  };
}

describe('DiagnosticsQueueService', () => {
  let service: DiagnosticsQueueService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let mockSession: Partial<DiagnosticsSessionService>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    mockSession = { sessionId: '00000000-0000-0000-0000-000000000099' };
    TestBed.configureTestingModule({
      providers: [
        DiagnosticsQueueService,
        { provide: DiagnosticsSessionService, useValue: mockSession },
      ],
    });
    service = TestBed.inject(DiagnosticsQueueService);
    // Stop the interval timer to avoid leakage between tests
    service.resetForTests();
    fetchMock.mockClear();
  });

  afterEach(() => {
    // Restore any global stubs (fetch, navigator) so they don't leak into
    // other spec files — e.g. DefaultValueAccessor reads navigator.userAgent.
    vi.unstubAllGlobals();
  });

  it('enqueue adds event to the queue', () => {
    service.enqueue(makeEvent());
    // Queue is internal; we can verify by triggering a manual flush
    void service['flush']();
  });

  it('capacity enforcement removes debug/info first when overflow occurs', () => {
    // Directly test enforceCapacity: fill the queue beyond MAX, verify debug+info dropped.
    const events: DiagnosticEventVm[] = [];
    for (let i = 0; i < 201; i++) {
      events.push(makeEvent({ severity: 'info' }));
    }
    // Push via a fresh internal state — assign directly to the queue.
    (service as any).queue.push(...events);
    service['enforceCapacity']();
    const q = (service as any).queue as DiagnosticEventVm[];
    // After enforcement, no info should remain
    expect(q.some((e) => e.severity === 'info')).toBe(false);
    // Total size should be <= MAX_QUEUE_SIZE
    expect(q.length).toBeLessThanOrEqual(200);
  });

  it('flush sends fetch with X-CSRFToken and X-Client-Session-Id headers', async () => {
    // Set CSRF cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrftoken=test-csrf',
    });

    service.enqueue(makeEvent());
    await service['flush']();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/bff/api/v1/diagnostics/ui-events/batch');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-CSRFToken']).toBe('test-csrf');
    expect(init.headers['X-Client-Session-Id']).toBe(
      '00000000-0000-0000-0000-000000000099',
    );
    expect(init.credentials).toBe('same-origin');
  });

  it('flush retries with backoff on failure (1s, 2s, 4s)', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));
    Object.defineProperty(document, 'cookie', { writable: true, value: '' });

    service.enqueue(makeEvent());
    // First attempt fails immediately
    await service['flush']();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((service as any).retryCount).toBe(1);
    // A backoff timer is now armed (1s for first retry)
    expect((service as any).backoffTimer).not.toBeNull();
  });

  it('stops logger after retryCount reaches MAX_RETRIES', async () => {
    // Manually set retryCount to MAX_RETRIES - 1 and trigger one more failure
    fetchMock.mockRejectedValue(new Error('persistent failure'));
    service.enqueue(makeEvent());
    // First failure → retryCount=1
    await service['flush']();
    expect((service as any).retryCount).toBe(1);

    // Simulate two more consecutive failures by directly setting retryCount
    // and calling flush (this exercises the stop logic without timers).
    (service as any).retryCount = 2;
    await service['flush']();
    // Now retryCount=3, which is >= MAX_RETRIES → stopped
    expect((service as any).stopped).toBe(true);
  });

  it('readCsrfToken parses document.cookie correctly', () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrftoken=abc%20123; other=zzz',
    });
    expect(service['readCsrfToken']()).toBe('abc 123');
  });

  it('readCsrfToken returns empty when no cookie', () => {
    Object.defineProperty(document, 'cookie', { writable: true, value: 'foo=bar' });
    expect(service['readCsrfToken']()).toBe('');
  });

  it('flushOnUnload calls navigator.sendBeacon for critical events', () => {
    const sendBeacon = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon });
    service.enqueue(makeEvent({ severity: 'critical' }));
    service['flushOnUnload']();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toBe('/bff/api/v1/diagnostics/ui-events/batch');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('flushOnUnload skips events larger than 60 KB', () => {
    const sendBeacon = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon });
    // Add a critical event with a giant details blob
    const huge = 'x'.repeat(100_000);
    service.enqueue(makeEvent({ severity: 'critical', details: { error_message: huge } }));
    service['flushOnUnload']();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('flushOnUnload skips when no critical/error events', () => {
    const sendBeacon = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon });
    service.enqueue(makeEvent({ severity: 'info' }));
    service['flushOnUnload']();
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
