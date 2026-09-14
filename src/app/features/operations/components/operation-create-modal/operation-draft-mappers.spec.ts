import { describe, it, expect } from 'vitest';
import {
  snapshotDraft,
  isDraftClean,
  mergeInlineItemAfterSave,
} from './operation-draft-mappers';
import type {
  OperationDraftVm,
  OperationInlineItemDraftVm,
  OperationLineDraftVm,
} from '../../../../core/models/operations.models';

function makeInlineItem(overrides: Partial<OperationInlineItemDraftVm> = {}): OperationInlineItemDraftVm {
  return {
    clientKey: 'inline-key-1',
    name: 'Новая позиция',
    sku: null,
    unitId: 'u1',
    unitName: 'шт',
    categoryId: 'c1',
    categoryName: 'Крепёж',
    description: 'desc',
    hashtags: null,
    ...overrides,
  };
}

function makeInlineLine(
  localId: string,
  inlineItem: OperationInlineItemDraftVm,
  overrides: Partial<OperationLineDraftVm> = {},
): OperationLineDraftVm {
  return {
    localId,
    itemId: null,
    itemName: inlineItem.name,
    unitId: inlineItem.unitId,
    unitName: inlineItem.unitName,
    quantity: 1,
    isTemporary: false,
    fromBalances: false,
    lineNumber: 1,
    inlineItem,
    ...overrides,
  };
}

function makeDraft(lines: OperationLineDraftVm[], overrides: Partial<OperationDraftVm> = {}): OperationDraftVm {
  return {
    type: 'RECEIVE',
    status: 'draft',
    effectiveAt: '2026-09-14T10:00',
    destinationSiteId: '21',
    lines,
    ...overrides,
  };
}

describe('operation-draft-mappers — Stage 2 inline payload in dirty state', () => {
  it('includes the full inline payload in snapshotDraft', () => {
    const draft = makeDraft([makeInlineLine('local-1', makeInlineItem())]);
    const snapshot = JSON.parse(snapshotDraft(draft));

    expect(snapshot.lines[0].inlineItem).toEqual({
      clientKey: 'inline-key-1',
      name: 'Новая позиция',
      sku: null,
      unitId: 'u1',
      unitName: 'шт',
      categoryId: 'c1',
      categoryName: 'Крепёж',
      description: 'desc',
      hashtags: null,
    });
  });

  it('marks the draft dirty when only the inline name changes', () => {
    const original = makeDraft([makeInlineLine('local-1', makeInlineItem())]);
    original.lastSavedSnapshot = snapshotDraft(original);
    expect(isDraftClean(original)).toBe(true);

    const renamed = makeDraft([
      makeInlineLine('local-1', makeInlineItem({ name: 'Исправленное имя' })),
    ]);
    renamed.lastSavedSnapshot = original.lastSavedSnapshot;
    expect(isDraftClean(renamed)).toBe(false);
    expect(snapshotDraft(renamed)).not.toBe(snapshotDraft(original));
  });

  it('marks the draft dirty on unit/category/description/sku/hashtags changes', () => {
    const original = makeDraft([makeInlineLine('local-1', makeInlineItem())]);
    original.lastSavedSnapshot = snapshotDraft(original);

    const variants: Partial<OperationInlineItemDraftVm>[] = [
      { unitId: 'u2', unitName: 'кг' },
      { categoryId: 'c2', categoryName: 'Метизы' },
      { description: 'другое' },
      { sku: 'SKU-1' },
      { hashtags: ['tag'] },
    ];

    for (const variant of variants) {
      const changed = makeDraft([
        makeInlineLine('local-1', makeInlineItem(variant)),
      ]);
      changed.lastSavedSnapshot = original.lastSavedSnapshot;
      expect(isDraftClean(changed), JSON.stringify(variant)).toBe(false);
    }
  });

  it('ignores display-only line copies when inlineItem itself is unchanged', () => {
    const first = makeDraft([makeInlineLine('local-1', makeInlineItem())]);
    const second = makeDraft([
      makeInlineLine('local-1', makeInlineItem(), { itemName: 'другой display', unitName: 'другое' }),
    ]);
    expect(snapshotDraft(first)).toBe(snapshotDraft(second));
  });
});

describe('operation-draft-mappers — mergeInlineItemAfterSave', () => {
  it('prefers the server copy for persisted fields (canonical saved state)', () => {
    const local = makeInlineItem({ name: '  Имя  ', categoryId: null, description: 'local desc' });
    const server = makeInlineItem({ name: 'Имя', categoryId: 'uncategorized', description: null });

    const merged = mergeInlineItemAfterSave(local, server);

    expect(merged?.name).toBe('Имя');
    expect(merged?.categoryId).toBe('uncategorized');
    expect(merged?.description).toBe('local desc');
    expect(merged?.clientKey).toBe(server.clientKey);
  });

  it('keeps the richer local unitName (display-only, never persisted)', () => {
    const local = makeInlineItem({ unitName: 'штука (шт)' });
    const server = makeInlineItem({ unitName: 'шт' });

    expect(mergeInlineItemAfterSave(local, server)?.unitName).toBe('штука (шт)');
  });

  it('returns the server copy when there is no local copy', () => {
    const server = makeInlineItem();
    expect(mergeInlineItemAfterSave(null, server)).toEqual(server);
    expect(mergeInlineItemAfterSave(undefined, server)).toEqual(server);
  });

  it('returns the local copy when the server omitted the payload', () => {
    const local = makeInlineItem();
    expect(mergeInlineItemAfterSave(local, null)).toEqual(local);
    expect(mergeInlineItemAfterSave(local, undefined)).toEqual(local);
  });

  it('returns null when both sides are absent (catalog line)', () => {
    expect(mergeInlineItemAfterSave(null, null)).toBeNull();
  });

  it('never changes clientKey on the server side', () => {
    const local = makeInlineItem({ clientKey: 'inline-old' });
    const server = makeInlineItem({ clientKey: 'inline-old' });
    expect(mergeInlineItemAfterSave(local, server)?.clientKey).toBe('inline-old');
  });
});
