export type IssueObjectType = 'person' | 'base' | 'vehicle' | 'department' | 'contractor' | 'other_object' | 'system_repo';

export const ISSUE_OBJECT_TYPE_LABELS: Record<IssueObjectType, string> = {
  person: 'Человек',
  base: 'База',
  vehicle: 'Машина/Техника',
  department: 'Подразделение/Группа',
  contractor: 'Контрагент',
  other_object: 'Прочий объект',
  system_repo: 'Системный',
};

export interface IssueObject {
  id: string;
  display_name: string;
  object_type: IssueObjectType;
  category_id: string;
  comment?: string | null;
  code?: string;
  normalized_key: string;
  is_active: boolean;
  merged_into_id?: string;
  issued_positions_count?: number;
  issued_total_qty?: string;
  created_at: string;
  updated_at: string;
}

export interface IssueObjectCreatePayload {
  display_name: string;
  comment?: string | null;
  /**
   * Required by backend BFF after migration to category tree.
   * Marked optional in the type so the existing object-form keeps compiling
   * during incremental migration; the new 40/60 workspace form will always
   * pass a selected category.
   */
  category_id?: string;
  object_type?: IssueObjectType;
  code?: string;
}

export interface IssueObjectUpdatePayload {
  display_name?: string;
  comment?: string | null;
  category_id?: string;
  object_type?: IssueObjectType;
  code?: string;
  is_active?: boolean;
}

export interface IssueObjectMergePayload {
  source_id: string;
  target_id: string;
}

export interface IssueObjectCategory {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface IssueObjectCategoryCreatePayload {
  name: string;
  parent_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface IssueObjectCategoryUpdatePayload {
  name?: string;
  parent_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export type IssueRepositoryTreeNode =
  | {
      type: 'category';
      id: string;
      name: string;
      parent_id: string | null;
      is_active: boolean;
      children?: IssueRepositoryTreeNode[];
    }
  | {
      type: 'object';
      id: string;
      name: string;
      comment?: string | null;
      category_id: string;
      is_active: boolean;
    };
