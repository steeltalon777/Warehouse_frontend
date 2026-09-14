import { OperationDraftVm, OperationInlineItemDraftVm } from '../../../../core/models/operations.models';

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
 *  - lines (localId, itemId, quantity, full inline payload)
 *
 * The inline payload is part of the dirty state because an inline temporary
 * item exists only in the draft: renaming/re-categorising it must mark the
 * draft dirty, survive the close guard, and be persisted by Save draft.
 *
 * Fields excluded (do not trigger dirty):
 *  - id, status, createdByUserId, acceptanceState, lastSavedSnapshot, isBalanceRefreshing
 *  - itemName, categoryName, sku, unitName on the line level (display snapshots
 *    derived one-way from `inlineItem` for temporary lines)
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
      inlineItem: snapshotInlineItem(l.inlineItem),
      quantity: l.quantity ?? null,
    })),
  };
  return JSON.stringify(clean);
}

function snapshotInlineItem(inlineItem: OperationInlineItemDraftVm | null | undefined) {
  if (!inlineItem) return null;
  return {
    clientKey: inlineItem.clientKey ?? null,
    name: inlineItem.name ?? '',
    sku: inlineItem.sku ?? null,
    unitId: inlineItem.unitId ?? '',
    unitName: inlineItem.unitName ?? '',
    categoryId: inlineItem.categoryId ?? null,
    categoryName: inlineItem.categoryName ?? null,
    description: inlineItem.description ?? null,
    hashtags: inlineItem.hashtags ?? null,
  };
}

/**
 * Compare current draft against a saved snapshot.
 * Returns true when there are no meaningful differences.
 */
export function isDraftClean(draft: OperationDraftVm): boolean {
  if (!draft.lastSavedSnapshot) return draft.lines.length === 0;
  return snapshotDraft(draft) === draft.lastSavedSnapshot;
}

/**
 * Merge an inline temporary-item payload after a successful server save.
 *
 * The server rewrites `temporary_draft_payload` (at minimum it trims the name
 * and normalizes a missing category to the Uncategorized category), so the
 * server copy is the canonical saved state: it wins for every persisted field.
 * Local values are kept only as a fallback when the server omitted a field,
 * and `unitName` (display-only, never sent to the server) keeps the richer
 * local label.
 *
 * `clientKey` is the stable line identity and must survive the merge.
 */
export function mergeInlineItemAfterSave(
  local: OperationInlineItemDraftVm | null | undefined,
  server: OperationInlineItemDraftVm | null | undefined,
): OperationInlineItemDraftVm | null {
  if (!server) return local ?? null;
  if (!local) return server;
  return {
    clientKey: server.clientKey || local.clientKey,
    name: server.name || local.name,
    sku: server.sku ?? local.sku,
    unitId: server.unitId || local.unitId,
    unitName: local.unitName || server.unitName,
    categoryId: server.categoryId ?? local.categoryId,
    categoryName: server.categoryName ?? local.categoryName ?? null,
    description: server.description ?? local.description ?? null,
    hashtags: server.hashtags ?? local.hashtags ?? null,
  };
}
