/**
 * ADR-0033 Item Identity Guard — targeted Level 6/7 E2E.
 *
 * Covers the two required Angular surfaces against the real stand:
 *  - §7.1 Operation Modal: item_identity_duplicate envelope → candidates →
 *    "use existing" swaps the inline temporary line → re-submit succeeds.
 *  - §7.2 / AC-12 review detail: identity_candidates → merge CTA with the
 *    prefilled target → merge through the BFF → item leaves the review queue
 *    and the balance lands on the canonical item.
 *  - merge error surface: structured BFF error is shown, no false success.
 *
 * Run: npx playwright test e2e/adr-0033-identity-guard.spec.ts
 * Full Docker-backed run: make test-e2e (from the workspace root).
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRoot } from './helpers/login';
import { installNetworkGuard } from './helpers/network-guard';

const BFF = '/bff/api/v1';

// ─── API helpers ───────────────────────────────────────────────────────────

async function getCsrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find(c => c.name === 'csrftoken')?.value ?? '';
}

async function apiPost(page: Page, path: string, data: Record<string, unknown>) {
  const csrf = await getCsrf(page);
  return page.request.post(`${BFF}${path}`, {
    data,
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRFToken': csrf } : {}) },
    failOnStatusCode: false,
  });
}

interface CatalogRef {
  id: string | number;
  name: string;
}

async function getFirstSiteId(page: Page): Promise<string | number | null> {
  const res = await page.request.get(`${BFF}/catalog/sites`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  const sites = body?.data?.sites ?? [];
  return sites[0]?.site_id ?? null;
}

async function getCatalogRefs(page: Page): Promise<{
  unitId: string | number;
  categoryA: string | number;
  categoryB: string | number;
} | null> {
  const [unitsRes, categoriesRes] = await Promise.all([
    page.request.get(`${BFF}/catalog/units`, { failOnStatusCode: false }),
    page.request.get(`${BFF}/catalog/categories`, { failOnStatusCode: false }),
  ]);
  if (!unitsRes.ok() || !categoriesRes.ok()) return null;
  const unitsBody = await unitsRes.json();
  const categoriesBody = await categoriesRes.json();
  const units: CatalogRef[] = unitsBody?.data?.units ?? unitsBody?.data ?? [];
  const categories: CatalogRef[] = categoriesBody?.data?.categories ?? categoriesBody?.data ?? [];
  if (units.length === 0 || categories.length < 2) return null;
  return { unitId: units[0].id, categoryA: categories[0].id, categoryB: categories[1].id };
}

async function apiCreateCatalogItem(
  page: Page,
  name: string,
  unitId: string | number,
  categoryId: string | number,
): Promise<string | number | null> {
  const res = await apiPost(page, '/catalog/admin/items', { name, unit_id: unitId, category_id: categoryId });
  if (!res.ok()) return null;
  const body = await res.json();
  return body?.data?.id ?? null;
}

interface SeededReceive {
  operationId: string;
  lineId: number;
  itemId: string | number | null;
}

async function seedReceiveWithTemporaryLine(
  page: Page,
  opts: {
    siteId: string | number;
    name: string;
    unitId: string | number;
    categoryId: string | number;
    qty: string;
    runId: string;
    submit?: boolean;
    accept?: boolean;
  },
): Promise<SeededReceive | null> {
  const createRes = await apiPost(page, '/operations', {
    type: 'RECEIVE',
    site_id: opts.siteId,
    notes: opts.runId,
    client_request_id: crypto.randomUUID(),
    lines: [
      {
        line_number: 1,
        temporary_item: {
          client_key: 'k1',
          name: opts.name,
          unit_id: opts.unitId,
          category_id: opts.categoryId,
        },
        qty: opts.qty,
      },
    ],
  });
  if (!createRes.ok()) return null;
  const created = await createRes.json();
  const operationId: string | undefined = created?.data?.id;
  if (!operationId) return null;

  if (opts.submit === false) {
    return { operationId, lineId: created?.data?.lines?.[0]?.id ?? 0, itemId: null };
  }

  const submitRes = await apiPost(page, `/operations/${operationId}/submit`, { submit: true });
  if (!submitRes.ok()) return null;
  const submitted = await submitRes.json();
  const line = submitted?.data?.lines?.[0];
  if (!line?.id) return null;

  if (opts.accept) {
    const acceptRes = await apiPost(page, `/operations/${operationId}/accept-lines`, {
      lines: [{ line_id: line.id, accepted_qty: opts.qty, lost_qty: '0' }],
    });
    if (!acceptRes.ok()) return null;
  }

  return { operationId, lineId: line.id, itemId: line.item_id ?? null };
}

async function getOperationStatus(page: Page, operationId: string): Promise<string | null> {
  const res = await page.request.get(`${BFF}/operations/${operationId}`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  return body?.data?.status ?? null;
}

async function getReviewCount(page: Page, search: string): Promise<number> {
  const res = await page.request.get(
    `${BFF}/review-items?search=${encodeURIComponent(search)}&page_size=20`,
    { failOnStatusCode: false },
  );
  if (!res.ok()) return -1;
  const body = await res.json();
  return (body?.data?.items ?? []).length;
}

async function getItemBalance(page: Page, siteId: string | number, itemId: string | number): Promise<number | null> {
  const res = await page.request.get(`${BFF}/balances?site_id=${siteId}`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  const rows = body?.data?.items ?? (Array.isArray(body?.data) ? body.data : []);
  const row = rows.find((r: any) => String(r.item_id) === String(itemId));
  return row ? parseFloat(row.qty) : 0;
}

// ─── UI helpers ────────────────────────────────────────────────────────────

async function openOperationsPage(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
}

async function openDraftInModal(page: Page, runId: string): Promise<void> {
  const row = page.locator('[data-testid="operation-row"]', { hasText: runId }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator('[data-testid="operation-action-edit"]').click();
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10000 });
}

async function submitInModal(page: Page): Promise<void> {
  await page.locator('.modal-overlay button:has-text("Подтвердить")').click();
}

async function openTemporaryItemsSearch(page: Page, search: string): Promise<void> {
  await page.goto('/temporary-items/', { waitUntil: 'networkidle' });
  const searchInput = page.locator('app-temp-items-filters input[placeholder*="Поиск"]');
  await searchInput.fill(search);
  await page.waitForTimeout(600);
}

// ─── Scenarios ─────────────────────────────────────────────────────────────

test.describe('ADR-0033 identity guard E2E', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
  });

  test('§7.1: duplicate submit shows candidates and "use existing" unblocks the line', async ({ page }) => {
    const siteId = await getFirstSiteId(page);
    const refs = await getCatalogRefs(page);
    if (!siteId || !refs) {
      test.skip(true, 'Stand has no site/unit/category fixture');
      return;
    }

    const runId = `adr0033-71-e2e-${Date.now()}`;
    const name = `ADR0033 E2E DUP ${Date.now()}`;
    const canonicalId = await apiCreateCatalogItem(page, name, refs.unitId, refs.categoryA);
    if (!canonicalId) {
      test.skip(true, 'Could not create canonical catalog item via BFF');
      return;
    }

    const seeded = await seedReceiveWithTemporaryLine(page, {
      siteId,
      name,
      unitId: refs.unitId,
      categoryId: refs.categoryA,
      qty: '5',
      runId,
      submit: false,
    });
    if (!seeded) {
      test.skip(true, 'Could not seed RECEIVE draft with inline temporary item');
      return;
    }

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    // Domain error is rendered on the errored line (the toast carries only the
    // "ошибки в N строках" summary, by design of the error surface).
    await expect(page.locator('[data-testid="operation-line-submit-hint"]').first()).toContainText(
      'уже существует в каталоге',
      { timeout: 10000 },
    );
    await expect(page.locator('[data-testid="operation-submit-toast"]')).toContainText(
      'ошибки в 1 строках',
    );

    const candidates = page.locator('[data-testid="identity-duplicate-candidates"]');
    await expect(candidates).toBeVisible();
    await expect(candidates).toContainText(name);
    await expect(page.locator('[data-testid="identity-candidate-use"]').first()).toBeVisible();

    // Swap the inline line to the existing catalog item; qty must survive.
    const lineRow = page.locator('.modal-overlay tbody tr.row--has-error').first();
    const qtyBefore = await lineRow.locator('input').first().inputValue();
    await page.locator('[data-testid="identity-candidate-use"]').first().click();

    const swappedRow = page.locator(`.modal-overlay tbody tr:has-text("ID ${canonicalId}")`).first();
    await expect(swappedRow).toBeVisible({ timeout: 10000 });
    expect(await swappedRow.locator('input').first().inputValue()).toBe(qtyBefore);
    await expect(page.locator('[data-testid="identity-duplicate-candidates"]')).toHaveCount(0);

    // Re-submit goes through.
    await submitInModal(page);
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 15000 });
    expect(await getOperationStatus(page, seeded.operationId)).toBe('submitted');
  });

  test('§7.2 / AC-12: review detail candidates → prefilled merge → queue refresh', async ({ page }) => {
    const siteId = await getFirstSiteId(page);
    const refs = await getCatalogRefs(page);
    if (!siteId || !refs) {
      test.skip(true, 'Stand has no site/unit/category fixture');
      return;
    }

    const name = `ADR0033 E2E MERGE ${Date.now()}`;
    const canonicalId = await apiCreateCatalogItem(page, name, refs.unitId, refs.categoryA);
    if (!canonicalId) {
      test.skip(true, 'Could not create canonical catalog item via BFF');
      return;
    }

    // Different category → PARTIAL candidate; accept so the review item has stock.
    const seeded = await seedReceiveWithTemporaryLine(page, {
      siteId,
      name,
      unitId: refs.unitId,
      categoryId: refs.categoryB,
      qty: '7',
      runId: `adr0033-72-e2e-${Date.now()}`,
      submit: true,
      accept: true,
    });
    if (!seeded || !seeded.itemId) {
      test.skip(true, 'Could not seed accepted RECEIVE with inline temporary item');
      return;
    }

    await openTemporaryItemsSearch(page, name);
    const row = page.locator('app-temp-items-table .data-row', { hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    const section = page.locator('[data-testid="review-identity-candidates"]');
    await expect(section).toBeVisible({ timeout: 10000 });
    await expect(section).toContainText(name);

    const cta = page.locator('[data-testid="review-identity-merge"]').first();
    await expect(cta).toBeEnabled();
    await cta.click();

    // Merge dialog is prefilled with the chosen candidate. Assert on the
    // overlay: the component host itself is zero-size (child is position:fixed).
    const form = page.locator('app-temp-item-merge-permanent-form .modal-overlay');
    await expect(form).toBeVisible({ timeout: 10000 });
    await expect(form).toContainText(name);
    await expect(form).toContainText('Совпадение');

    await page.locator('[data-testid="merge-submit"]').click();

    await expect(form).toBeHidden({ timeout: 15000 });
    await expect(page.locator('app-temp-items-table .data-row', { hasText: name })).toHaveCount(0, {
      timeout: 15000,
    });

    // BFF state: review item resolved, balance moved to the canonical item.
    expect(await getReviewCount(page, name)).toBe(0);
    expect(await getItemBalance(page, siteId, canonicalId)).toBe(7);
  });

  test('§7.2: structured merge error is surfaced without false success', async ({ page }) => {
    const siteId = await getFirstSiteId(page);
    const refs = await getCatalogRefs(page);
    if (!siteId || !refs) {
      test.skip(true, 'Stand has no site/unit/category fixture');
      return;
    }

    const name = `ADR0033 E2E ERR ${Date.now()}`;
    const canonicalId = await apiCreateCatalogItem(page, name, refs.unitId, refs.categoryA);
    if (!canonicalId) {
      test.skip(true, 'Could not create canonical catalog item via BFF');
      return;
    }

    const seeded = await seedReceiveWithTemporaryLine(page, {
      siteId,
      name,
      unitId: refs.unitId,
      categoryId: refs.categoryB,
      qty: '3',
      runId: `adr0033-err-e2e-${Date.now()}`,
      submit: true,
      accept: true,
    });
    if (!seeded || !seeded.itemId) {
      test.skip(true, 'Could not seed accepted RECEIVE with inline temporary item');
      return;
    }

    await page.route(`**${BFF}/review-items/${seeded.itemId}/merge`, route =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: { code: 'conflict', message: 'item does not require review' },
        }),
      }),
    );

    await openTemporaryItemsSearch(page, name);
    const row = page.locator('app-temp-items-table .data-row', { hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    const cta = page.locator('[data-testid="review-identity-merge"]').first();
    await expect(cta).toBeEnabled();
    await cta.click();
    const form = page.locator('app-temp-item-merge-permanent-form .modal-overlay');
    await expect(form).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="merge-submit"]').click();

    const banner = page.locator('[data-testid="merge-error-banner"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText('item does not require review');
    await expect(form).toBeVisible();
  });
});
