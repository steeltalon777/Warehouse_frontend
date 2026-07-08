export interface Category {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  children_count: number;
  items_count: number;
  children?: Category[];
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
  category_name: string | null;
  unit_id: string;
  unit_symbol: string;
  is_active: boolean;
  hashtags: string[];
  source_site_qty?: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  sort_order: number;
  is_active: boolean;
}

export interface BootstrapData {
  user: {
    id: string;
    username: string;
    full_name: string;
  };
  role: string;
  permissions: string[];
  feature_flags: Record<string, boolean>;
  pagination: {
    default_page_size: number;
    max_page_size: number;
  };
  version: string;
  server_time: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── New spec models ───────────────────────────────────────────

export type CatalogNodeType = 'category' | 'item' | 'unit';

export type CatalogNodeState =
  | 'normal'
  | 'selected'
  | 'dirty'
  | 'inactive'
  | 'error';

export type CatalogPendingAction =
  | 'create'
  | 'update'
  | 'deactivate'
  | 'delete'
  | 'merge';

export interface CatalogTreeNodeVm {
  id: string;
  type: CatalogNodeType;
  name: string;

  sku?: string;
  hashtags?: string[];
  meta?: string;

  parentId?: string | null;
  categoryId?: string | null;
  unitId?: string | null;

  isActive: boolean;

  level: number;
  children?: CatalogTreeNodeVm[];

  expanded: boolean;
  selected: boolean;
  dirty: boolean;
  error?: string | null;

  pendingAction?: CatalogPendingAction;
  state?: CatalogNodeState;
}

/**
 * При action='merge':
 *   payload = { target_entity_id: string, source_entity_id: string, comment?: string }
 */
export interface CatalogPendingChange {
  localId: string;
  entityType: 'category' | 'item' | 'unit';
  entityId?: string;
  action: CatalogPendingAction;
  payload: Record<string, unknown>;
}

export interface CatalogInlineEditEvent {
  nodeId: string;
  nodeType: CatalogNodeType;
  field: string;
  value: unknown;
}

// ─── Batch contract ──────────────────────────────────────────

export interface CatalogBatchChange {
  local_id: string;
  entity_type: 'unit' | 'category' | 'item';
  action: 'create' | 'update' | 'deactivate' | 'delete' | 'merge';
  entity_id?: string | number;
  payload: Record<string, unknown>;
}

export interface CatalogBatchRequest {
  client_batch_id: string;
  mode: string;
  changes: CatalogBatchChange[];
}

export interface CatalogBatchRecord {
  local_id: string;
  entity_type: string;
  action: string;
  status: string;
  entity_id?: number;
  error_code?: string;
  error_message?: string;
}

export interface CatalogBatchResponse {
  client_batch_id: string;
  mode: string;
  status: string;
  summary?: {
    error?: number;
    [key: string]: unknown;
  };
  records: CatalogBatchRecord[];
  server_time: string;
}

export interface ItemMergeRequest {
  source_item_id: string;
  target_item_id: string;
  comment?: string;
}

export interface CategoryMergeRequest {
  source_category_id: string;
  target_category_id: string;
  comment?: string;
}
