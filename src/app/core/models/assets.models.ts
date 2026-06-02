export interface PendingAcceptanceRow {
  operation_line_id: string;
  operation_id: string;
  item_id: string;
  item_name: string;
  unit_symbol: string;
  expected_qty: string;
  accepted_qty?: string;
  lost_qty?: string;
  status: string;
}

export interface LostAssetRow {
  operation_line_id: string;
  operation_id: string;
  site_id: string;
  site_name?: string;
  source_site_id?: string;
  source_site_name?: string;
  inventory_subject_id?: string;
  subject_type?: string;
  item_id: string;
  temporary_item_id?: string;
  resolved_item_id?: string;
  resolved_item_name?: string;
  item_name: string;
  display_name?: string;
  sku?: string;
  unit_symbol?: string;
  qty: string;
  note?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
}

export interface LostAssetsFilterVm {
  search: string;
  siteId: string | null;
  operationId: string | null;
  page: number;
  pageSize: number;
}

export interface LostAssetsListResult {
  items: LostAssetRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface LostAssetDetailVm extends LostAssetRow {}

export const LOST_ASSET_ACTION_LABELS: Record<string, string> = {
  found_to_destination: 'Найдено — склад назначения',
  return_to_source: 'Вернуть на источник',
  write_off: 'Списано',
};

export const LOST_ASSET_STATUS_LABELS: Record<string, string> = {
  open: 'Открыт',
  resolved: 'Закрыт',
};

export interface LostAssetResolvePayload {
  action: 'found_to_destination' | 'return_to_source' | 'write_off';
  qty: string;
  note?: string;
  responsible_recipient_id?: string;
}

export interface IssuedAssetRow {
  issue_object_id: string;
  issue_object_name: string;
  issue_object_type: string;
  inventory_subject_id: string;
  subject_type: string;
  item_id?: string;
  temporary_item_id?: string;
  resolved_item_id?: string;
  resolved_item_name?: string;
  display_name: string;
  item_name?: string;
  sku?: string;
  qty: string;
  updated_at: string;
}
