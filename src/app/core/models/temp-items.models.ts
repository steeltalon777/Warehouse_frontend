import type { IdentityCandidateDto } from './identity-candidate.models';

export interface TemporaryItem {
  id: string;
  /** Display name (maps to item_name from review-items API). */
  name: string;
  /** Alias for name (for backward compat with old template variable name). */
  get item_name(): string;
  normalized_name?: string;
  sku?: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  unit_id?: string;
  unit_name?: string;
  unit_symbol?: string;
  /** Legacy TemporaryItem status or review status for new flow. */
  status: TemporaryItemStatus;
  created_by_user_id: string;
  created_at: string;
  updated_at?: string;
  resolution_type?: string;
  resolved_item_id?: string;
  resolved_by_user_id?: string;
  resolved_at?: string;
  backing_item_is_active?: boolean;
  total_balance: number;
  /** Server-computed action state (D2 list contract). */
  has_pending_acceptance?: boolean;
  has_active_registers?: boolean;
  hashtags?: string;
  /** New review-item fields (permanent catalog items requiring review). */
  requires_review?: boolean;
  review_status?: string;
  review_created_by_user_id?: string;
  review_resolved_by_user_id?: string;
  review_resolved_at?: string;
  review_note?: string;
  /** Balances per site from review-items detail API. */
  balances_per_site?: TempItemBalancePerSite[];
  /** Count of operations using this item. */
  operations_count?: number;
}

export type TemporaryItemStatus = 'active' | 'approved_as_item' | 'merged_to_item' | 'deleted';

export interface TempItemBalancePerSite {
  site_id: string;
  site_name: string;
  balance: number;
}

export interface TempItemOperation {
  id: string;
  operation_type: string;
  operation_type_label?: string;
  status: string;
  status_label?: string;
  quantity: number;
  created_at: string;
}

export interface TempItemDetail extends TemporaryItem {
  balances_per_site: TempItemBalancePerSite[];
  operations: TempItemOperation[];
  operations_count: number;
  /** ADR-0033 §7.2: live identity candidates for this review item (self-excluded). */
  identity_candidates?: IdentityCandidateDto[];
}

export interface TempItemMergePayload {
  target_item_id: string;
  comment?: string;
}

/** Structured outcome of a merge attempt (ADR-0033 §7.2 error surface). */
export interface TempItemMergeResult {
  ok: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/** ADR-0033 §7.2: user picked an identity candidate to merge the review item into. */
export interface TempItemMergeSelection {
  item: TemporaryItemVm;
  candidate: IdentityCandidateDto;
}

export interface TempItemApprovePayload {
  name: string;
  category_id: string;
  unit_id: string;
  sku?: string;
  description?: string;
  hashtags?: string;
}

export interface TempItemsListFilters {
  search?: string;
  ui_status?: TempItemUiStatus;
  has_balance?: boolean;
  has_pending_acceptance?: boolean;
  created_after?: string;
  created_before?: string;
  created_by_user_id?: string;
}

export interface TempItemsSort {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export type TempItemUiStatus =
  | 'needs_review'
  | 'has_balance'
  | 'in_pending_acceptance'
  | 'can_convert'
  | 'can_delete'
  | 'converted'
  | 'merged'
  | 'delete_blocked';

export const TEMP_ITEM_UI_STATUS_LABELS: Record<TempItemUiStatus, string> = {
  'needs_review': 'Требует проверки',
  'has_balance': 'Есть остаток',
  'in_pending_acceptance': 'В незавершённой приёмке',
  'can_convert': 'Можно подтвердить',
  'can_delete': 'Можно удалить',
  'converted': 'Подтверждена',
  'merged': 'Объединена',
  'delete_blocked': 'Удаление заблокировано',
};

export const TEMP_ITEM_UI_STATUS_COLORS: Record<TempItemUiStatus, string> = {
  'needs_review': 'warning',
  'has_balance': 'info',
  'in_pending_acceptance': 'accent',
  'can_convert': 'success',
  'can_delete': 'danger',
  'converted': 'neutral',
  'merged': 'neutral',
  'delete_blocked': 'danger',
};

export interface TemporaryItemVm {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  categoryName?: string;
  unitSymbol?: string;
  status: TemporaryItemStatus;
  uiStatus: TempItemUiStatus;
  uiStatusLabel: string;
  createdAt: string;
  createdByUserId: string;
  totalBalance: number;
  operationsCount: number;
  canConvert: boolean;
  canMergeToPermanent: boolean;
  canMergeToTemp: boolean;
  canDelete: boolean;
  convertBlockedReason?: string;
  mergeBlockedReason?: string;
  deleteBlockedReason?: string;
  hasPendingAcceptance: boolean;
  hasActiveRegisters: boolean;
}

export function computeUiStatus(
  status: TemporaryItemStatus,
  totalBalance: number,
  hasPendingAcceptance: boolean,
  requiresReview?: boolean,
): TempItemUiStatus {
  if (status === 'approved_as_item') return 'converted';
  if (status === 'merged_to_item') return 'merged';
  if (status === 'deleted') return 'delete_blocked';

  if (hasPendingAcceptance) return 'in_pending_acceptance';
  if (requiresReview) return 'needs_review';
  if (totalBalance > 0) return 'needs_review';
  return 'can_delete';
}

export function computeActionFlags(
  status: TemporaryItemStatus,
  totalBalance: number,
  hasPendingAcceptance: boolean,
  hasActiveRegisters: boolean,
  role: string,
): {
  canConvert: boolean;
  canMergeToPermanent: boolean;
  canMergeToTemp: boolean;
  canDelete: boolean;
  convertBlockedReason?: string;
  mergeBlockedReason?: string;
  deleteBlockedReason?: string;
} {
  const isChiefOrRoot = role === 'chief_storekeeper' || role === 'root';

  if (!isChiefOrRoot) {
    return { canConvert: false, canMergeToPermanent: false, canMergeToTemp: false, canDelete: false };
  }

  if (status !== 'active') {
    return { canConvert: false, canMergeToPermanent: false, canMergeToTemp: false, canDelete: false };
  }

  if (hasPendingAcceptance) {
    return {
      canConvert: false, canMergeToPermanent: false, canMergeToTemp: false, canDelete: false,
      convertBlockedReason: 'Нельзя преобразовать: временная ТМЦ участвует в незавершённой приёмке',
      mergeBlockedReason: 'Нельзя слить: временная ТМЦ участвует в незавершённой приёмке',
      deleteBlockedReason: 'Нельзя удалить: временная ТМЦ участвует в незавершённой приёмке',
    };
  }

  // Backend enforcement parity: pending|lost|issued > 0 blocks destructive
  // actions server-side, so the UI must not offer them either.
  if (hasActiveRegisters) {
    return {
      canConvert: false, canMergeToPermanent: false, canMergeToTemp: false, canDelete: false,
      convertBlockedReason: 'Нельзя преобразовать: по временной ТМЦ есть активные регистры (утраты/выдача)',
      mergeBlockedReason: 'Нельзя слить: по временной ТМЦ есть активные регистры (утраты/выдача)',
      deleteBlockedReason: 'Нельзя удалить: по временной ТМЦ есть активные регистры (утраты/выдача)',
    };
  }

  if (totalBalance === 0) {
    return {
      canConvert: false, canMergeToPermanent: false, canMergeToTemp: false, canDelete: true,
      convertBlockedReason: 'Нет остатка для преобразования',
      mergeBlockedReason: 'Нет остатка для слияния',
    };
  }

  return {
    canConvert: true,
    canMergeToPermanent: true,
    canMergeToTemp: true,
    canDelete: false,
    deleteBlockedReason: 'Нельзя удалить: по временной ТМЦ есть остаток',
  };
}

function deriveStatusFromReviewStatus(reviewStatus?: string): TemporaryItemStatus {
  switch (reviewStatus) {
    case 'confirmed': return 'approved_as_item';
    case 'merged': return 'merged_to_item';
    case 'archived': return 'deleted';
    default: return 'active';
  }
}

export function toTempItemVm(
  item: TemporaryItem,
  operationsCount: number,
  role: string,
): TemporaryItemVm {
  const name = item.name || (item as any)['item_name'] || '';
  const status: TemporaryItemStatus = item.status || deriveStatusFromReviewStatus(item.review_status);
  // API serializes Decimal balances as strings ("5.000"); normalize to number.
  const totalBalance = Number(item.total_balance ?? 0);
  const hasPendingAcceptance = item.has_pending_acceptance ?? false;
  const hasActiveRegisters = item.has_active_registers ?? false;

  const uiStatus = computeUiStatus(status, totalBalance, hasPendingAcceptance, item.requires_review);
  const flags = computeActionFlags(status, totalBalance, hasPendingAcceptance, hasActiveRegisters, role);

  return {
    id: item.id,
    name,
    sku: item.sku,
    description: item.description,
    categoryName: item.category_name,
    unitSymbol: item.unit_symbol,
    status,
    uiStatus,
    uiStatusLabel: TEMP_ITEM_UI_STATUS_LABELS[uiStatus],
    createdAt: formatDateTime(item.created_at),
    createdByUserId: item.created_by_user_id,
    totalBalance,
    operationsCount,
    ...flags,
    hasPendingAcceptance,
    hasActiveRegisters,
  };
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
