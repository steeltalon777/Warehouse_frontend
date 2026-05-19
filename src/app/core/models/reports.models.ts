export interface ItemMovementRow {
  item_id: string;
  item_name: string;
  item_sku: string;
  category_name: string;
  site_id: string;
  site_name: string;
  operation_type: string;
  qty: string;
  balance_after: string;
  effective_at: string;
}

export interface StockSummaryRow {
  item_id: string;
  item_name: string;
  item_sku: string;
  category_name: string;
  unit_symbol: string;
  total_qty: string;
  sites_count: number;
}
