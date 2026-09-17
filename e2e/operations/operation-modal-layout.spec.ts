/**
 * Visual polish — Operation Modal layout.
 *
 * Covers:
 *  - compact Full HD width while retaining the established 4K cap;
 *  - the item table uses its full width, including the empty state;
 *  - content-driven modal height (shrinks for 1–3 rows, caps with inner scroll
 *    for many rows) without changing responsive layout;
 *  - removed CATEGORY_ID column (category stays as human-readable metadata);
 *  - explicit labeled «Карточка» button on inline/new rows;
 *  - the search field keeps its comfortable width behavior (smoke).
 *
 * No API/domain/search-logic changes are asserted here.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRoot } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId } from '../helpers/seed';

const BFF = '/bff/api/v1';

async function openAuthenticatedOperations(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  if (/\/users\/login\//.test(page.url())) {
    await loginAsRoot(page);
    await page.goto('/operations/', { waitUntil: 'networkidle' });
  }
  await expect(page).not.toHaveURL(/\/users\/login\//, { timeout: 10000 });
}

async function getJson(page: Page, path: string): Promise<any> {
  const res = await page.request.get(`${BFF}${path}`, { failOnStatusCode: false });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path} but got status ${res.status()}: ${text.slice(0, 80)}`);
  }
}

async function getCsrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find(c => c.name === 'csrftoken')?.value ?? '';
}

async function getSites(page: Page): Promise<Array<{ site_id: string | number }>> {
  return (await getJson(page, '/catalog/sites'))?.data?.sites ?? [];
}

async function getTemporaryRefs(page: Page): Promise<{ unitId: string | number; categoryId: string | number } | null> {
  const [units, categories] = await Promise.all([
    getJson(page, '/catalog/units'),
    getJson(page, '/catalog/categories'),
  ]);
  const unitList = units?.data?.units ?? [];
  const categoryList = categories?.data?.categories ?? [];
  if (!unitList.length || !categoryList.length) return null;
  return { unitId: unitList[0].id, categoryId: categoryList[0].id };
}

async function seedReceiveDraft(
  page: Page,
  runId: string,
  siteId: string | number,
  lines: Array<Record<string, unknown>>,
): Promise<boolean> {
  const csrf = await getCsrf(page);
  const res = await page.request.post(`${BFF}/operations`, {
    data: {
      type: 'RECEIVE',
      site_id: siteId,
      notes: runId,
      client_request_id: crypto.randomUUID(),
      lines: lines.map((line, idx) => ({ line_number: idx + 1, ...line })),
    },
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRFToken': csrf } : {}) },
    failOnStatusCode: false,
  });
  return res.ok();
}

function temporaryLines(refs: { unitId: string | number; categoryId: string | number }, runId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    temporary_item: {
      client_key: `k-layout-${runId}-${i}`,
      name: `Layout item ${runId} ${i + 1}`,
      unit_id: refs.unitId,
      category_id: refs.categoryId,
    },
    qty: '1',
  }));
}

async function openDraftModal(page: Page, runId: string) {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  const row = page.locator('[data-testid="operation-row"]', { hasText: runId }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator('.number-link').click();
  const modal = page.locator('[data-design-id="operation-modal"]');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
}

test.describe('Operation Modal — layout polish', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
  });

  test('is compact on Full HD, fills the table width, and retains the 4K cap', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openAuthenticatedOperations(page);
    await page.locator('[data-testid="operations-create-button"]').click();

    const modal = page.locator('[data-design-id="operation-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const fullHdBox = await modal.boundingBox();
    expect(fullHdBox).toBeTruthy();
    expect(fullHdBox!.width).toBeGreaterThanOrEqual(1000);
    expect(fullHdBox!.width).toBeLessThanOrEqual(1040);

    const tableLayout = await modal.locator('.lines-data-table').evaluate(table => {
      const tableRect = table.getBoundingClientRect();
      const lastHeader = table.querySelector('thead th:last-child')!.getBoundingClientRect();
      const itemHeader = table.querySelector('thead th:nth-child(2)')!.getBoundingClientRect();
      return {
        trailingGap: Math.abs(tableRect.right - lastHeader.right),
        itemColumnWidth: itemHeader.width,
      };
    });
    expect(tableLayout.trailingGap).toBeLessThanOrEqual(2);
    expect(tableLayout.itemColumnWidth).toBeGreaterThanOrEqual(650);

    await page.setViewportSize({ width: 3840, height: 2160 });
    const fourKBox = await modal.boundingBox();
    expect(fourKBox).toBeTruthy();
    expect(fourKBox!.width).toBeGreaterThanOrEqual(1448);
    expect(fourKBox!.width).toBeLessThanOrEqual(1452);
  });

  test('height is content-driven for a 1-line draft and capped with scroll for many lines', async ({ page }) => {
    await openAuthenticatedOperations(page);
    const sites = await getSites(page);
    const refs = await getTemporaryRefs(page);
    if (!sites.length || !refs) {
      test.skip(true, 'Stand has no site/unit/category fixture');
      return;
    }

    // 1 line → short modal (no forced 640px minimum).
    const oneRun = generateRunId();
    if (!await seedReceiveDraft(page, oneRun, sites[0].site_id, temporaryLines(refs, oneRun, 1))) {
      test.skip(true, 'Could not seed the 1-line draft');
      return;
    }
    const oneModal = await openDraftModal(page, oneRun);
    const oneBox = await oneModal.boundingBox();
    expect(oneBox).toBeTruthy();
    expect(oneBox!.height).toBeLessThan(640);
    expect(oneBox!.height).toBeGreaterThan(250);

    // Many lines → capped at ~94vh and the table scrolls internally.
    const manyRun = generateRunId();
    if (!await seedReceiveDraft(page, manyRun, sites[0].site_id, temporaryLines(refs, manyRun, 20))) {
      test.skip(true, 'Could not seed the many-line draft');
      return;
    }
    const manyModal = await openDraftModal(page, manyRun);
    const manyBox = await manyModal.boundingBox();
    const viewport = page.viewportSize()!;
    expect(manyBox).toBeTruthy();
    expect(manyBox!.height).toBeLessThanOrEqual(viewport.height * 0.94 + 2);

    const scrollState = await manyModal.locator('.modal-table-wrap').evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);

    // Footer actions stay visible with the table scrolled internally.
    await expect(manyModal.locator('[data-design-id="save-draft-btn"]')).toBeVisible();

    // Inline rows expose the explicit labeled card action.
    const cardButton = manyModal.locator('[data-testid="inline-card-edit"]').first();
    await expect(cardButton).toBeVisible();
    await expect(cardButton).toHaveText('Карточка');
  });

  test('category_id column is gone; category remains as item metadata', async ({ page }) => {
    await openAuthenticatedOperations(page);
    const sites = await getSites(page);
    const items = (await getJson(page, '/catalog/items?limit=50'))?.data?.items ?? [];
    const item = items.find((i: any) => i?.id && i?.category_id);
    if (!sites.length || !item) {
      test.skip(true, 'Stand has no site/item-with-category fixture');
      return;
    }
    const categories = (await getJson(page, '/catalog/categories'))?.data?.categories ?? [];
    const categoryName: string | undefined = categories.find(
      (c: any) => String(c.id) === String(item.category_id),
    )?.name;
    if (!categoryName) {
      test.skip(true, 'Could not resolve the item category name on this stand');
      return;
    }

    const runId = generateRunId();
    if (!await seedReceiveDraft(page, runId, sites[0].site_id, [{ item_id: item.id, qty: '1' }])) {
      test.skip(true, 'Could not seed the draft');
      return;
    }

    const modal = await openDraftModal(page, runId);
    const headers = modal.locator('app-operation-lines-table thead th');
    await expect(headers).toHaveCount(5);
    await expect(headers.nth(3)).toContainText('Имеется');
    await expect(modal.locator('app-operation-lines-table thead')).not.toContainText('category_id');
    await expect(modal.locator('.cat-id-value')).toHaveCount(0);
    await expect(modal.locator('.item-meta-cat').first()).toContainText(categoryName);
  });

  test('search field grows with a comfortable width inside the toolbar', async ({ page }) => {
    await openAuthenticatedOperations(page);
    await page.locator('[data-testid="operations-create-button"]').click();
    const modal = page.locator('[data-design-id="operation-modal"]');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const searchInput = modal.locator('[data-design-id="item-search-input"]');
    await expect(searchInput).toBeVisible();
    const box = await searchInput.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(420);
    expect(box!.width).toBeLessThanOrEqual(920);
  });
});
