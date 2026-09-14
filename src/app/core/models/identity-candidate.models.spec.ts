import { normalizeIdentityCandidates } from './identity-candidate.models';

describe('normalizeIdentityCandidates', () => {
  it('returns an empty list for non-array payloads', () => {
    expect(normalizeIdentityCandidates(undefined)).toEqual([]);
    expect(normalizeIdentityCandidates(null)).toEqual([]);
    expect(normalizeIdentityCandidates({ id: 1, name: 'Болт' })).toEqual([]);
    expect(normalizeIdentityCandidates('broken')).toEqual([]);
  });

  it('keeps a valid candidate with all identity fields', () => {
    const result = normalizeIdentityCandidates([
      {
        id: 500,
        name: ' Болт М8 ',
        sku: 'BOLT-M8',
        unit: { id: 5, name: 'штука', symbol: 'шт' },
        category: { id: 4, name: 'Крепёж' },
        is_active: true,
        requires_review: false,
        match: 'exact',
      },
    ]);

    expect(result).toEqual([
      {
        id: 500,
        name: 'Болт М8',
        sku: 'BOLT-M8',
        unit: { id: 5, name: 'штука', symbol: 'шт' },
        category: { id: 4, name: 'Крепёж' },
        is_active: true,
        requires_review: false,
        match: 'exact',
      },
    ]);
  });

  it('drops malformed entries without a usable id or name', () => {
    const result = normalizeIdentityCandidates([
      null,
      'string',
      42,
      { id: 0, name: 'Zero' },
      { id: -3, name: 'Negative' },
      { id: 'abc', name: 'NaN' },
      { id: 7, name: '   ' },
      { id: 8, name: 'Valid' },
    ]);

    expect(result.map(c => c.id)).toEqual([8]);
  });

  it('defaults match to partial and boolean flags to false', () => {
    const [candidate] = normalizeIdentityCandidates([
      { id: 9, name: 'X', match: 'weird', is_active: 'yes', requires_review: 1 },
    ]);

    expect(candidate.match).toBe('partial');
    expect(candidate.is_active).toBe(false);
    expect(candidate.requires_review).toBe(false);
    expect(candidate.sku).toBeUndefined();
    expect(candidate.unit).toBeUndefined();
    expect(candidate.category).toBeUndefined();
  });
});
