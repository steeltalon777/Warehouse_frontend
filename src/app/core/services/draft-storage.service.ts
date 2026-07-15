import { Injectable, inject } from '@angular/core';

import { OperationDraftVm } from '../models/operations.models';
import { snapshotDraft } from '../../features/operations/components/operation-create-modal/operation-draft-mappers';
import { DiagnosticsSessionService } from './diagnostics-session.service';

const PREFIX = 'warehouse.draft.v1';
const SCHEMA_VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Per-session draft saved to sessionStorage.
 *
 * Stored under key: `warehouse.draft.v1.<session_id>`.
 * `personName` and `comment` are stripped before serialization (PII guard).
 */
export interface SavedDraft {
  /** JSON-serialized draft (no PII). */
  draft: string;
  /** ISO 8601 timestamp of when this was saved. */
  savedAt: string;
  /** Idempotency key from the draft. */
  idempotencyKey: string;
  /** Draft id from the draft. */
  draftId: string;
  /** Operation type for diagnostics. */
  operationType: string;
  /** Number of lines at save time. */
  itemsCount: number;
  /** Schema version for future migration. */
  schemaVersion: 1;
}

/**
 * Lightweight metadata for the restore UI banner.
 * Avoids exposing the full draft payload to consumers that don't need it.
 */
export interface DraftMetadata {
  savedAt: string;
  itemsCount: number;
  operationType: string;
}

/**
 * Service for saving / loading the in-flight operation draft to
 * `sessionStorage`. Session-scoped (per `session_id`) and TTL-bounded (24h).
 *
 * Per contract `docs/contracts/DRAFT_PROTECTION_CONTRACTS.md` §3.
 */
@Injectable({ providedIn: 'root' })
export class DraftStorageService {
  private readonly session = inject(DiagnosticsSessionService);

  /**
   * Build the full sessionStorage key. Per-session so multiple users
   * sharing a browser don't see each other's drafts.
   */
  private storageKey(): string {
    return `${PREFIX}.${this.session.sessionId}`;
  }

  /**
   * Save a draft. Returns true if the write succeeded, false if it was
   * skipped (no lines) or sessionStorage is unavailable.
   */
  save(draft: OperationDraftVm): boolean {
    if (!draft) return false;
    if (!draft.lines || draft.lines.length === 0) return false;

    const safeDraft = this.stripPii(draft);
    const draftJson = snapshotDraft(safeDraft);

    const record: SavedDraft = {
      draft: draftJson,
      savedAt: new Date().toISOString(),
      idempotencyKey: safeDraft.idempotencyKey ?? '',
      draftId: safeDraft.draftId ?? '',
      operationType: safeDraft.type,
      itemsCount: safeDraft.lines.length,
      schemaVersion: SCHEMA_VERSION,
    };

    try {
      sessionStorage.setItem(this.storageKey(), JSON.stringify(record));
      return true;
    } catch {
      // sessionStorage may be unavailable (private mode, quota, etc.)
      return false;
    }
  }

  /**
   * Load a saved draft, applying TTL and schema-version checks.
   * Returns null if no valid record is present.
   */
  load(): SavedDraft | null {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(this.storageKey());
    } catch {
      return null;
    }
    if (!raw) return null;

    let parsed: SavedDraft;
    try {
      parsed = JSON.parse(raw) as SavedDraft;
    } catch {
      // Corrupt entry — clear it.
      this.clear();
      return null;
    }

    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      this.clear();
      return null;
    }

    if (!parsed.savedAt || Date.now() - Date.parse(parsed.savedAt) > TTL_MS) {
      this.clear();
      return null;
    }

    return parsed;
  }

  /** Returns true if a valid (non-expired) draft exists. */
  hasDraft(): boolean {
    return this.load() !== null;
  }

  /** Remove the saved draft. Safe to call when nothing is stored. */
  clear(): void {
    try {
      sessionStorage.removeItem(this.storageKey());
    } catch {
      // ignore
    }
  }

  /**
   * Return lightweight metadata for the restore banner.
   * Returns null if no valid draft exists.
   */
  getMetadata(): DraftMetadata | null {
    const saved = this.load();
    if (!saved) return null;
    return {
      savedAt: saved.savedAt,
      itemsCount: saved.itemsCount,
      operationType: saved.operationType,
    };
  }

  /**
   * Strip PII before serialization. `personName` and `comment` are never
   * persisted. If new PII fields are added to OperationDraftVm, they must
   * be added here too.
   */
  private stripPii(draft: OperationDraftVm): OperationDraftVm {
    return {
      ...draft,
      // PII guard: never persist these fields.
      personName: undefined,
      comment: undefined,
    };
  }
}
