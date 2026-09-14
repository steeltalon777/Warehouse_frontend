/**
 * ADR-0033 Item Identity Guard — shared candidate DTOs.
 *
 * SOURCE OF TRUTH: SyncServer Pydantic schemas
 * (`IdentityCandidateRef` in operation-submit errors,
 * `IdentityCandidateDto` in `/catalog/items/identity-candidates` and the
 * review-item detail). These interfaces are a manual mirror; if the Pydantic
 * schema changes, update this file to match.
 */

export interface IdentityCandidateUnitDto {
  id: number;
  name: string;
  symbol: string;
}

export interface IdentityCandidateCategoryDto {
  id: number;
  name: string;
}

/** Candidate ref inside the operation-submit `item_identity_duplicate` error. */
export interface IdentityCandidateRef {
  id: number;
  name: string;
  sku?: string | null;
  unit?: IdentityCandidateUnitDto | null;
  category?: IdentityCandidateCategoryDto | null;
  match: 'exact' | 'partial';
}

/** Candidate from the read contract (identity-candidates endpoint + review detail). */
export interface IdentityCandidateDto extends IdentityCandidateRef {
  is_active: boolean;
  requires_review: boolean;
}

/** Response of `GET /catalog/items/identity-candidates`. */
export interface ItemIdentityCandidatesResponse {
  candidates: IdentityCandidateDto[];
}
