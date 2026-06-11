export interface Document {
  id: string;
  operation_id: string;
  document_type: string;
  document_number: string;
  status: string;
  template_name?: string;
  payload?: Record<string, unknown>;
  finalized_at?: string;
  created_at: string;
}

export interface DocumentGeneratePayload {
  operation_id: string;
  document_type: string;
  template_name?: string;
  auto_finalize?: boolean;
  language?: string;
  basis_type?: string;
  basis_number?: string;
  basis_date?: string;
}

export interface DocumentStatusPayload {
  status: string;
  finalized_at?: string;
  payload?: Record<string, unknown>;
  payload_hash?: string;
}

export interface OperationWaybillOpenResult {
  document: Document;
  created: boolean;
  pdf_url: string;
  download_url: string;
}
