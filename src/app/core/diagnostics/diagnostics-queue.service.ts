import { Inject, Injectable, NgZone, OnDestroy, inject } from '@angular/core';

import { DiagnosticsSessionService } from '../services/diagnostics-session.service';
import {
  DIAGNOSTICS_QUEUE_PORT,
  DiagnosticEventBatchVm,
  DiagnosticEventVm,
  DiagnosticSeverity,
  DiagnosticsQueuePort,
} from './diagnostics.models';

const FLUSH_INTERVAL_MS = 15_000;
const CRITICAL_FLUSH_DELAY_MS = 300;
const MAX_QUEUE_SIZE = 200;
const EARLY_FLUSH_THRESHOLD = 20;
const UNLOAD_MAX_EVENTS = 50;
const UNLOAD_MAX_BYTES = 60 * 1024;
const BACKOFF_STEPS_MS = [1_000, 2_000, 4_000, 30_000];
const MAX_RETRIES = 3;
const BATCH_ENDPOINT = '/bff/api/v1/diagnostics/ui-events/batch';

/**
 * DiagnosticsQueueService — in-memory queue + batch sender.
 *
 * Per contract §6/§7:
 * - max 200 events in memory
 * - flush every 15s OR when 20 events accumulated OR critical
 * - send via `fetch()` (NOT HttpClient) to avoid interceptor recursion
 * - exponential backoff 1s/2s/4s/30s, max 3 retries
 * - on unload, sendBeacon() for critical/error events (max 60 KB)
 *
 * Implements DiagnosticsQueuePort for DI.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticsQueueService implements DiagnosticsQueuePort, OnDestroy {
  private readonly queue: DiagnosticEventVm[] = [];
  private sequence = 0;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private criticalTimer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;
  private stopped = false;
  private retryCount = 0;
  private backoffTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly zone = inject(NgZone);
  private readonly session = inject(DiagnosticsSessionService);

  constructor() {
    this.zone.runOutsideAngular(() => {
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => this.flushOnUnload());
      }
    });
  }

  /** Implementation of DiagnosticsQueuePort. */
  enqueue(event: DiagnosticEventVm): void {
    if (this.stopped) return;
    this.queue.push(event);
    this.enforceCapacity();
    this.scheduleFlushingFor(event);
  }

  private enforceCapacity(): void {
    if (this.queue.length <= MAX_QUEUE_SIZE) return;
    // Drop debug first, then info, keep warning/error/critical
    const filtered = this.queue.filter(
      (e) => e.severity !== 'debug' && e.severity !== 'info',
    );
    this.queue.length = 0;
    this.queue.push(...filtered);
    while (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.shift();
    }
  }

  private scheduleFlushingFor(event: DiagnosticEventVm): void {
    if (event.severity === 'critical' && !this.criticalTimer && !this.criticalTimerArmed()) {
      this.zone.runOutsideAngular(() => {
        this.criticalTimer = setTimeout(() => {
          this.criticalTimer = null;
          this.flush();
        }, CRITICAL_FLUSH_DELAY_MS);
      });
    }
    if (this.queue.length >= EARLY_FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  private criticalTimerArmed(): boolean {
    return this.criticalTimer !== null;
  }

  private async flush(): Promise<void> {
    if (this.sending || this.stopped || this.queue.length === 0) return;
    this.sending = true;

    const take = Math.min(EARLY_FLUSH_THRESHOLD, this.queue.length);
    const events = this.queue.splice(0, take);
    if (events.length === 0) {
      this.sending = false;
      return;
    }

    const payload: DiagnosticEventBatchVm = {
      events,
      sent_at: new Date().toISOString(),
      sequence: ++this.sequence,
    };

    try {
      await this.sendBatch(payload);
      this.retryCount = 0;
    } catch (err) {
      // Put events back at front of queue
      this.queue.unshift(...events);
      this.retryCount += 1;
      if (this.retryCount >= MAX_RETRIES) {
        // eslint-disable-next-line no-console
        console.error('[Diagnostics] max retries reached, stopping logger', err);
        this.stopped = true;
        if (this.flushTimer) {
          clearInterval(this.flushTimer);
          this.flushTimer = null;
        }
      } else {
        const step = Math.min(this.retryCount - 1, BACKOFF_STEPS_MS.length - 1);
        const delay = BACKOFF_STEPS_MS[step];
        this.zone.runOutsideAngular(() => {
          this.backoffTimer = setTimeout(() => {
            this.backoffTimer = null;
            this.flush();
          }, delay);
        });
      }
    } finally {
      this.sending = false;
    }
  }

  private async sendBatch(payload: DiagnosticEventBatchVm): Promise<void> {
    const csrf = this.readCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (csrf) headers['X-CSRFToken'] = csrf;
    if (this.session.sessionId) headers['X-Client-Session-Id'] = this.session.sessionId;

    const response = await fetch(BATCH_ENDPOINT, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Diagnostics batch failed: ${response.status}`);
    }
  }

  private flushOnUnload(): void {
    if (this.queue.length === 0) return;
    const criticalOrError = this.queue.filter(
      (e) => e.severity === 'critical' || e.severity === 'error',
    );
    if (criticalOrError.length === 0) return;

    const limited = criticalOrError.slice(-UNLOAD_MAX_EVENTS);
    const payload: DiagnosticEventBatchVm = {
      events: limited,
      sent_at: new Date().toISOString(),
      sequence: ++this.sequence,
    };
    const body = JSON.stringify(payload);
    if (body.length > UNLOAD_MAX_BYTES) return;

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(BATCH_ENDPOINT, blob);
      } catch {
        // Best-effort; failures are silent.
      }
    }
  }

  private readCsrfToken(): string {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  /** Test-only: clear internal state. */
  resetForTests(): void {
    this.queue.length = 0;
    this.retryCount = 0;
    this.stopped = false;
    if (this.backoffTimer) {
      clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
  }

  ngOnDestroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.criticalTimer) clearTimeout(this.criticalTimer);
    if (this.backoffTimer) clearTimeout(this.backoffTimer);
    this.flushOnUnload();
  }
}
