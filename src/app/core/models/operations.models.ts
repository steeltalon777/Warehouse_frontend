export type OperationType =
  | 'RECEIVE'
  | 'EXPENSE'
  | 'MOVE'
  | 'WRITE_OFF'
  | 'ISSUE'
  | 'ISSUE_RETURN'
  | 'CORRECTION'
  | 'ADJUSTMENT';

export type OperationStatus =
  | 'draft'
  | 'created'
  | 'pending'
  | 'submitted'
  | 'rejected'
  | 'cancelled';

export interface OperationDto {
  id: string;
  number?: string;
  display_number?: string;
  type: OperationType;
  status: OperationStatus;
  site_id?: string | null;
  site_name?: string | null;
  source_site_id?: string | null;
  source_site_name?: string | null;
  destination_site_id?: string | null;
  destination_site_name?: string | null;
  person_name?: string | null;
  issue_object_id?: string | null;
  issue_object_name_snapshot?: string | null;
  comment?: string | null;
  created_by_user_id: string;
  created_by_label?: string;
  created_at: string;
  updated_at: string;
  effective_at?: string | null;
  lines_count?: number;
  acceptance_state?: string;
  acceptance_state_label?: string;
  lines?: OperationLineDto[];
}

export interface OperationLineDto {
  id?: string;
  operation_id?: string;
  item_id?: string | null;
  resolved_item_id?: string | null;
  item_name?: string;
  resolved_item_name?: string;
  item_name_snapshot?: string;
  item_sku_snapshot?: string | null;
  sku?: string | null;
  unit_id?: string;
  unit_symbol?: string;
  unit_symbol_snapshot?: string;
  category_name_snapshot?: string;
  qty: string;
  accepted_qty?: string;
  lost_qty?: string;
  note?: string;
  is_temporary?: boolean;
}

export interface OperationsFilterVm {
  search: string;
  itemIds?: string[];
  type: OperationType | null;
  status: OperationStatus | null;
  siteId: string | null;
  createdAfter: string | null;
  createdBefore: string | null;
  updatedAfter: string | null;
  updatedBefore: string | null;
  createdByUserId: string | null;
  onlyMine: boolean;
  page: number;
  pageSize: number;
}

export interface OperationListRowVm {
  id: string;
  number: string;
  displayNumber: string;
  type: OperationType;
  typeLabel: string;
  status: OperationStatus;
  statusLabel: string;
  statusLines: string[];
  createdAt: string;
  createdByUserId: string;
  createdByLabel: string;
  sourceSiteId?: string | null;
  sourceSiteName?: string | null;
  destinationSiteId?: string | null;
  destinationSiteName?: string | null;
  personName?: string | null;
  issueObjectId?: string | null;
  issueObjectName?: string | null;
  directionLabel: string;
  siteName: string | null;
  linesCount: number;
  positionCount: number;
  acceptanceStateLabel: string;
  canInvoice: boolean;
  canOpen: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  canDelete: boolean;
  canCancel: boolean;
  canPrint: boolean;
  canAccept: boolean;
}

export interface OperationDraftVm {
  id?: string;
  type: OperationType;
  status: OperationStatus;
  createdByUserId?: string | null;
  sourceSiteId?: string | null;
  destinationSiteId?: string | null;
  personName?: string | null;
  issueObjectId?: string | null;
  issueObjectName?: string | null;
  writeOffSource?: 'warehouse' | 'object' | null;
  acceptanceState?: string | null;
  comment?: string | null;
  lines: OperationLineDraftVm[];
  /** Serialized clean state for dirty-check */
  lastSavedSnapshot?: string;
  /** Whether balance refresh is in progress */
  isBalanceRefreshing?: boolean;
}

export interface OperationLineDraftVm {
  localId: string;
  itemId?: string | null;
  itemName: string;
  categoryName?: string;
  sku?: string | null;
  unitId?: string | null;
  unitName: string;
  quantity: number | null;
  availableQuantity?: number | null;
  sourceSiteQuantity?: number | null;
  destinationSiteQuantity?: number | null;
  isTemporary: boolean;
  fromBalances: boolean;
  error?: string | null;
  /** Preserved line number from backend for stable ordering */
  lineNumber?: number;
}

export interface TemporaryItemDraftVm {
  name: string;
  unitId: string | null;
  categoryId?: string | null;
  comment?: string | null;
  keywords?: string[];
}

export interface SiteDto {
  id: string;
  name: string;
}

export interface BalanceDto {
  item_id: string;
  site_id: string;
  qty: string;
  item_name?: string;
  unit_symbol?: string;
}

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  RECEIVE: 'Приход',
  EXPENSE: 'Расход',
  MOVE: 'Перемещение',
  WRITE_OFF: 'Списание',
  ISSUE: 'Выдача',
  ISSUE_RETURN: 'Возврат выдачи',
  CORRECTION: 'Корректировка',
  ADJUSTMENT: 'Корректировка',
};

export const OPERATION_STATUS_LABELS: Record<OperationStatus, string> = {
  draft: 'Черновик',
  created: 'Подтверждена',
  pending: 'Ожидает приёмки',
  submitted: 'Проведена',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
};

export const STATUS_TABS = [
  { key: 'all', label: 'Все', status: null as OperationStatus | null },
  { key: 'drafts', label: 'Черновики', status: 'draft' as OperationStatus },
  { key: 'confirm', label: 'На подтверждении', status: 'created' as OperationStatus },
  { key: 'acceptance', label: 'Ожидают приёмки', status: 'pending' as OperationStatus },
  { key: 'submitted', label: 'Проведённые', status: 'submitted' as OperationStatus },
  { key: 'cancelled', label: 'Отменённые', status: 'cancelled' as OperationStatus },
];

/** @deprecated Use CSS class bindings (wh-badge--type-*) instead. */
export const TYPE_BADGE_COLORS: Record<OperationType, { bg: string; text: string }> = {
  RECEIVE: { bg: '#DCFCE7', text: '#166534' },
  EXPENSE: { bg: '#DBEAFE', text: '#1E40AF' },
  MOVE: { bg: '#DBEAFE', text: '#1E40AF' },
  WRITE_OFF: { bg: '#FEE2E2', text: '#991B1B' },
  ISSUE: { bg: '#FEF9C3', text: '#854D0E' },
  ISSUE_RETURN: { bg: '#F3F4F6', text: '#374151' },
  CORRECTION: { bg: '#E0E7FF', text: '#3730A3' },
  ADJUSTMENT: { bg: '#E0E7FF', text: '#3730A3' },
};

/** @deprecated Use CSS class bindings (wh-badge--status-*) instead. */
export const STATUS_BADGE_COLORS: Record<OperationStatus, { bg: string; text: string }> = {
  draft: { bg: '#F3F4F6', text: '#6B7280' },
  created: { bg: '#DBEAFE', text: '#1E40AF' },
  pending: { bg: '#FEF9C3', text: '#854D0E' },
  submitted: { bg: '#DCFCE7', text: '#166534' },
  rejected: { bg: '#FEE2E2', text: '#991B1B' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B' },
};
