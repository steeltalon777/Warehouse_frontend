import { OperationDraftVm } from '../../../../core/models/operations.models';

/**
 * Serialize a draft snapshot for dirty-state comparison.
 * Returns a JSON string identifying the fields that matter for
 * "has unsaved changes" detection.
 *
 * Fields included:
 *  - type
 *  - sourceSiteId / destinationSiteId
 *  - effectiveAt
 *  - comment
 *  - personName / issueObjectId / issueObjectName / writeOffSource
 *  - lines (localId, itemId, quantity)
 *
 * Fields excluded (do not trigger dirty):
 *  - id, status, createdByUserId, acceptanceState, lastSavedSnapshot, isBalanceRefreshing
 *  - itemName, categoryName, sku, unitName (display snapshots only)
 *  - availableQuantity, sourceSiteQuantity (transient runtime data)
 */
export function snapshotDraft(draft: OperationDraftVm): string {
  const clean = {
    type: draft.type,
    sourceSiteId: draft.sourceSiteId ?? null,
    destinationSiteId: draft.destinationSiteId ?? null,
    effectiveAt: draft.effectiveAt ?? null,
    comment: draft.comment ?? null,
    personName: draft.personName ?? null,
    issueObjectId: draft.issueObjectId ?? null,
    issueObjectName: draft.issueObjectName ?? null,
    writeOffSource: draft.writeOffSource ?? null,
    lines: draft.lines.map(l => ({
      localId: l.localId,
      itemId: l.itemId ?? null,
      inlineItem: l.inlineItem ? { clientKey: l.inlineItem.clientKey } : null,
      quantity: l.quantity ?? null,
    })),
  };
  return JSON.stringify(clean);
}

/**
 * Compare current draft against a saved snapshot.
 * Returns true when there are no meaningful differences.
 */
export function isDraftClean(draft: OperationDraftVm): boolean {
  if (!draft.lastSavedSnapshot) return draft.lines.length === 0;
  return snapshotDraft(draft) === draft.lastSavedSnapshot;
}
