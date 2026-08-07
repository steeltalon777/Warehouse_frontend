import { Injectable, computed, signal } from '@angular/core';
import type { NormalizedSubmitError, SubmitErrorEnvelope } from './envelope';
import { parseSubmitErrorResponse } from './parser';

/**
 * Error service for operation submit (`docs/TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE.md` §5).
 *
 * Stores line-group errors as stable groups. Each group has its own `id` so the
 * UI can key rendered rows by it. `stale` marks a group whose rows were edited
 * after the error arrived.
 *
 * Lifecycle: the service must not keep state between modal mounts — either the
 * modal provides it at component level (fresh instance per mount) or calls
 * `clearAll()` in `ngOnInit`/`ngOnDestroy`.
 */
@Injectable({ providedIn: 'root' })
export class SubmitErrorService {
  private readonly groupsState = signal<Record<string, ErrorGroup>>({});
  private readonly envelopeState = signal<SubmitErrorEnvelope | null>(null);

  readonly groups = this.groupsState.asReadonly();
  readonly envelope = this.envelopeState.asReadonly();

  /**
   * Latest recognized problem envelope for the operation cancel/restore flow
   * (TZ-OPERATION_CANCEL_DOMAIN_ERRORS §8.2). Set via
   * `setCancelFromHttpError` when the HTTP error body is a problem envelope;
   * cleared by `clearCancel` on success or when the payload is unrecognized.
   * The operations page renders `cancelErrorPayload()?.detail` in its banner.
   */
  private readonly cancelErrorPayloadState = signal<SubmitErrorEnvelope | null>(null);
  readonly cancelErrorPayload = this.cancelErrorPayloadState.asReadonly();

  /** Unique `operation_line_id` → group id, for inline highlighting. */
  readonly linesByGroup = computed<ReadonlyMap<number, string>>(() => {
    const map = new Map<number, string>();
    for (const group of Object.values(this.groupsState())) {
      const error = group.error;
      if (error.kind === 'known_line_group' && !error.malformed) {
        for (const lineId of error.operation_line_ids) map.set(lineId, group.id);
      }
    }
    return map;
  });

  /** Unique errored line ids in group insertion order, for scroll/focus. */
  readonly erroredLineIds = computed<number[]>(() => {
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const group of Object.values(this.groupsState())) {
      const error = group.error;
      if (error.kind === 'known_line_group' && !error.malformed) {
        for (const lineId of error.operation_line_ids) {
          if (!seen.has(lineId)) {
            seen.add(lineId);
            ids.push(lineId);
          }
        }
      }
    }
    return ids;
  });

  /**
   * Parses and normalizes an HTTP error payload and stores the resulting
   * groups. Unparseable payloads log `[submit-error] unknown submit error
   * payload` and reset the state — the UI then falls back to a generic toast
   * (envelope stays null).
   */
  setFromHttpError(raw: unknown): void {
    const result = parseSubmitErrorResponse(raw);
    if (result.unknown || !result.envelope) {
      console.error(`${LOG_PREFIX} unknown submit error payload`, result.logPayload ?? raw);
      this.clearAll();
      return;
    }
    this.envelopeState.set(result.envelope);
    this.groupsState.set(buildGroups(result.envelope));
  }

  clearAll(): void {
    this.envelopeState.set(null);
    this.groupsState.set({});
  }

  /**
   * Parses an HTTP error payload from the cancel/restore flow and stores the
   * recognized envelope in `cancelErrorPayload`. Unparseable payloads (legacy
   * string-detail errors, network failures) reset the signal to `null` — the
   * page then falls back to `OperationsService.error`.
   */
  setCancelFromHttpError(raw: unknown): void {
    const result = parseSubmitErrorResponse(raw);
    if (!result.unknown && result.envelope) {
      this.cancelErrorPayloadState.set(result.envelope);
    } else {
      this.cancelErrorPayloadState.set(null);
    }
  }

  /** Clears the cancel/restore error payload (success path). */
  clearCancel(): void {
    this.cancelErrorPayloadState.set(null);
  }

  /**
   * Marks every group whose `operation_line_ids` intersects `lineIds` as
   * `stale: true` (editing any row of a group invalidates the whole group).
   */
  invalidateByLineIds(lineIds: number[]): void {
    if (lineIds.length === 0) return;
    const target = new Set(lineIds);
    this.groupsState.update((previous) => {
      const next: Record<string, ErrorGroup> = {};
      for (const [id, group] of Object.entries(previous)) {
        next[id] = {
          ...group,
          stale: group.stale || intersects(group.error, target),
        };
      }
      return next;
    });
  }

  /**
   * Removes every group whose `operation_line_ids` is fully covered by
   * `lineIds`. A group whose ids only partially overlap is kept.
   */
  clearByLineIds(lineIds: number[]): void {
    if (lineIds.length === 0) return;
    const target = new Set(lineIds);
    this.groupsState.update((previous) => {
      const next: Record<string, ErrorGroup> = {};
      for (const [id, group] of Object.entries(previous)) {
        if (!coveredByLines(group.error, target)) next[id] = group;
      }
      return next;
    });
  }

  /** First errored line id (in group insertion order) for scroll/focus. */
  firstErroredLineId(): number | null {
    const ids = this.erroredLineIds();
    return ids.length > 0 ? ids[0] : null;
  }
}

export interface ErrorGroup {
  id: string;
  error: NormalizedSubmitError;
  receivedAt: number;
  stale: boolean;
}

const LOG_PREFIX = '[submit-error]';

function buildGroups(envelope: SubmitErrorEnvelope): Record<string, ErrorGroup> {
  const groups: Record<string, ErrorGroup> = {};
  const receivedAt = Date.now();
  for (const error of envelope.errors) {
    const id = createGroupId();
    groups[id] = { id, error, receivedAt, stale: false };
  }
  return groups;
}

function intersects(error: NormalizedSubmitError, lineIds: Set<number>): boolean {
  if (error.kind !== 'known_line_group') return false;
  return error.operation_line_ids.some((id) => lineIds.has(id));
}

function coveredByLines(error: NormalizedSubmitError, lineIds: Set<number>): boolean {
  if (error.kind !== 'known_line_group') return false;
  const ids = error.operation_line_ids;
  return ids.length > 0 && ids.every((id) => lineIds.has(id));
}

function createGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
