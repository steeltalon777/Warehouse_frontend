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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Defensive normalizer for candidate payloads received from the BFF
 * (ADR-0033 §7.2). Drops entries without a usable numeric `id` or a non-empty
 * `name`, so a malformed payload degrades to "no candidates" instead of
 * rendering a broken CTA. Optional fields are copied only when well-formed.
 */
export function normalizeIdentityCandidates(raw: unknown): IdentityCandidateDto[] {
  if (!Array.isArray(raw)) return [];

  const result: IdentityCandidateDto[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;

    const id = Number(entry['id']);
    const name = typeof entry['name'] === 'string' ? entry['name'].trim() : '';
    if (!Number.isSafeInteger(id) || id <= 0 || name.length === 0) continue;

    const candidate: IdentityCandidateDto = {
      id,
      name,
      match: entry['match'] === 'exact' ? 'exact' : 'partial',
      is_active: entry['is_active'] === true,
      requires_review: entry['requires_review'] === true,
    };
    if (typeof entry['sku'] === 'string' && entry['sku'].length > 0) {
      candidate.sku = entry['sku'];
    }
    if (isRecord(entry['unit'])) {
      candidate.unit = {
        id: Number(entry['unit']['id']),
        name: String(entry['unit']['name'] ?? ''),
        symbol: String(entry['unit']['symbol'] ?? ''),
      };
    }
    if (isRecord(entry['category'])) {
      candidate.category = {
        id: Number(entry['category']['id']),
        name: String(entry['category']['name'] ?? ''),
      };
    }
    result.push(candidate);
  }
  return result;
}
