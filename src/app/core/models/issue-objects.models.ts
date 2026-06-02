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
  code?: string;
  normalized_key: string;
  is_active: boolean;
  merged_into_id?: string;
  created_at: string;
  updated_at: string;
}

export interface IssueObjectCreatePayload {
  display_name: string;
  object_type: IssueObjectType;
  code?: string;
}

export interface IssueObjectUpdatePayload {
  display_name?: string;
  object_type?: IssueObjectType;
  code?: string;
  is_active?: boolean;
}

export interface IssueObjectMergePayload {
  source_id: string;
  target_id: string;
}
