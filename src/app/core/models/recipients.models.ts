export interface Recipient {
  id: string;
  display_name: string;
  recipient_type: string;
  personnel_no?: string;
  is_active: boolean;
}

export interface RecipientCreatePayload {
  display_name: string;
  recipient_type: string;
  personnel_no?: string;
}

export interface RecipientMergePayload {
  source_id: string;
  target_id: string;
}
