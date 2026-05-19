export interface BalanceRow {
  site_id: string;
  site_name: string;
  item_id: string;
  item_name: string;
  item_sku: string;
  category_id: string;
  category_name: string;
  unit_id: string;
  unit_symbol: string;
  qty: string;
}

export interface BalancesSummary {
  accessible_sites_count: number;
  summary: {
    total_items: number;
    total_qty: string;
  };
}
