import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OperationDraftVm } from '../models/operations.models';
import { DiagnosticsSessionService } from './diagnostics-session.service';
import { DraftStorageService } from './draft-storage.service';

function makeDraft(overrides: Partial<OperationDraftVm> = {}): OperationDraftVm {
  return {
    type: 'RECEIVE',
    status: 'draft',
    effectiveAt: '2026-07-15T10:00:00',
    lines: [
      {
        localId: 'L1',
        itemId: 'item-1',
        quantity: 5,
        inlineItem: null,
      },
    ],
    draftId: 'draft-1',
    idempotencyKey: 'idem-1',
    personName: 'Иванов',
    comment: 'с комментарием',
    ...overrides,
  };
}

describe('DraftStorageService', () => {
  let service: DraftStorageService;
  let sessionMock: { sessionId: string };

  beforeEach(() => {
    sessionMock = { sessionId: 'session-test-id' };
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        DraftStorageService,
        { provide: DiagnosticsSessionService, useValue: sessionMock },
      ],
    });
    service = TestBed.inject(DraftStorageService);
  });

  describe('save / load round-trip', () => {
    it('saves a draft and loads it back', () => {
      const draft = makeDraft();
      const ok = service.save(draft);
      expect(ok).toBe(true);

      const loaded = service.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.draftId).toBe('draft-1');
      expect(loaded!.idempotencyKey).toBe('idem-1');
      expect(loaded!.operationType).toBe('RECEIVE');
      expect(loaded!.itemsCount).toBe(1);
      expect(loaded!.schemaVersion).toBe(1);
    });

    it('returns null when no draft has been saved', () => {
      expect(service.load()).toBeNull();
      expect(service.hasDraft()).toBe(false);
    });

    it('returns false when saving an empty draft (no lines)', () => {
      const ok = service.save(makeDraft({ lines: [] }));
      expect(ok).toBe(false);
      expect(service.hasDraft()).toBe(false);
    });
  });

  describe('PII guard', () => {
    it('strips personName value before serialization', () => {
      service.save(makeDraft({ personName: 'Секретно ФИО' }));
      const loaded = service.load();
      expect(loaded).not.toBeNull();
      const parsed = JSON.parse(loaded!.draft);
      // The PII value must not be present.
      expect(parsed.personName).toBeNull();
      expect(loaded!.draft).not.toContain('Секретно');
      expect(loaded!.draft).not.toContain('ФИО');
    });

    it('strips comment value before serialization', () => {
      service.save(makeDraft({ comment: 'Тайный комментарий 123' }));
      const loaded = service.load();
      expect(loaded).not.toBeNull();
      const parsed = JSON.parse(loaded!.draft);
      // The PII value must not be present.
      expect(parsed.comment).toBeNull();
      expect(loaded!.draft).not.toContain('Тайный');
      expect(loaded!.draft).not.toContain('123');
    });
  });

  describe('TTL', () => {
    it('returns null for expired drafts and clears them', () => {
      // Save a draft, then artificially age its savedAt.
      service.save(makeDraft());
      const key = `warehouse.draft.v1.${sessionMock.sessionId}`;
      const raw = sessionStorage.getItem(key);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      // 25 hours ago
      const expired = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      parsed.savedAt = expired;
      sessionStorage.setItem(key, JSON.stringify(parsed));

      expect(service.load()).toBeNull();
      expect(service.hasDraft()).toBe(false);
      // Cleared on access
      expect(sessionStorage.getItem(key)).toBeNull();
    });

    it('returns the draft if saved less than 24h ago', () => {
      service.save(makeDraft());
      const loaded = service.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.savedAt).toBeTruthy();
    });
  });

  describe('schema version', () => {
    it('rejects drafts with wrong schemaVersion', () => {
      service.save(makeDraft());
      const key = `warehouse.draft.v1.${sessionMock.sessionId}`;
      const parsed = JSON.parse(sessionStorage.getItem(key)!);
      parsed.schemaVersion = 99;
      sessionStorage.setItem(key, JSON.stringify(parsed));

      expect(service.load()).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes the saved draft', () => {
      service.save(makeDraft());
      expect(service.hasDraft()).toBe(true);
      service.clear();
      expect(service.hasDraft()).toBe(false);
      expect(service.load()).toBeNull();
    });

    it('is a no-op when nothing is saved', () => {
      expect(() => service.clear()).not.toThrow();
    });
  });

  describe('per-session keys', () => {
    it('uses different keys for different sessions', () => {
      service.save(makeDraft({ idempotencyKey: 'a' }));
      // Simulate a new session
      sessionMock.sessionId = 'session-other';
      // Recreate service bound to the new session via fresh TestBed
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DraftStorageService,
          { provide: DiagnosticsSessionService, useValue: sessionMock },
        ],
      });
      const other = TestBed.inject(DraftStorageService);
      expect(other.hasDraft()).toBe(false);
      other.save(makeDraft({ idempotencyKey: 'b' }));

      // Restore the original session
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DraftStorageService,
          { provide: DiagnosticsSessionService, useValue: { sessionId: 'session-test-id' } },
        ],
      });
      const first = TestBed.inject(DraftStorageService);
      const loaded = first.load();
      expect(loaded).not.toBeNull();
      expect(loaded!.idempotencyKey).toBe('a');
    });
  });

  describe('getMetadata', () => {
    it('returns metadata without exposing the full draft', () => {
      service.save(makeDraft());
      const meta = service.getMetadata();
      expect(meta).not.toBeNull();
      expect(meta!.itemsCount).toBe(1);
      expect(meta!.operationType).toBe('RECEIVE');
      expect(meta!.savedAt).toBeTruthy();
      expect((meta as any).draft).toBeUndefined();
    });

    it('returns null when no draft exists', () => {
      expect(service.getMetadata()).toBeNull();
    });
  });

  describe('corrupt data', () => {
    it('clears and returns null on JSON parse error', () => {
      const key = `warehouse.draft.v1.${sessionMock.sessionId}`;
      sessionStorage.setItem(key, '{not valid json');
      expect(service.load()).toBeNull();
      expect(sessionStorage.getItem(key)).toBeNull();
    });
  });

  describe('sessionStorage unavailable', () => {
    it('save returns false when sessionStorage.setItem throws', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      const ok = service.save(makeDraft());
      expect(ok).toBe(false);
      setItemSpy.mockRestore();
    });
  });
});