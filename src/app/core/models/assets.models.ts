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
  source_site_id?: string;
  item_id: string;
  item_name: string;
  unit_symbol: string;
  qty: string;
  note?: string;
}

export interface LostAssetResolvePayload {
  action: 'found_to_destination' | 'return_to_source' | 'write_off';
  qty: string;
  note?: string;
  responsible_recipient_id?: string;
}

export interface IssuedAssetRow {
  recipient_id: string;
  recipient_name: string;
  item_id: string;
  item_name: string;
  unit_symbol: string;
  qty: string;
  issued_at: string;
}
