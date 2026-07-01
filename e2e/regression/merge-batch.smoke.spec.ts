import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { loginAsRoot } from '../helpers/login';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8001';

interface ItemDto { id: number; name: string; sku?: string | null; is_active?: boolean; }

async function getCsrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find(c => c.name === 'csrftoken')?.value ?? '';
}

async function listItems(page: Page, limit = 50): Promise<ItemDto[]> {
  const r = await page.request.get(`${BASE}/bff/api/v1/catalog/items?limit=${limit}`, { failOnStatusCode: false });
  if (!r.ok()) return [];
  const b = await r.json();
  return (b?.data?.items ?? []) as ItemDto[];
}

async function seedTwoItems(page: Page): Promise<[number, number]> {
  const csrf = await getCsrf(page);
  const r = await page.request.post(`${BASE}/bff/api/v1/catalog/admin/batch`, {
    data: {
      client_batch_id: `seed_${Date.now()}`,
      mode: 'atomic',
      changes: [
        { local_id: 'src', entity_type: 'item', action: 'create', payload: { name: 'E2E_MERGE_SRC', sku: `E2E_MS_${Date.now()}`, unit_id: 1, category_id: 65, is_active: true } },
        { local_id: 'tgt', entity_type: 'item', action: 'create', payload: { name: 'E2E_MERGE_TGT', sku: `E2E_MT_${Date.now()}`, unit_id: 1, category_id: 65, is_active: true } },
      ],
    },
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
    failOnStatusCode: false,
  });
  expect(r.ok(), `seed create ok: ${r.status()}`).toBeTruthy();
  const b = await r.json();
  const data = b?.data ?? b;
  const src = data?.records?.find((x: any) => x.local_id === 'src')?.entity_id;
  const tgt = data?.records?.find((x: any) => x.local_id === 'tgt')?.entity_id;
  expect(src, 'source seed id').toBeTruthy();
  expect(tgt, 'target seed id').toBeTruthy();
  return [src, tgt];
}

async function cleanupItem(request: APIRequestContext, csrf: string, itemId: number): Promise<void> {
  await request.post(`${BASE}/bff/api/v1/catalog/admin/batch`, {
    data: { client_batch_id: `cln_${itemId}_${Date.now()}`, mode: 'atomic', changes: [{ local_id: `cln-${itemId}`, entity_type: 'item', action: 'deactivate', entity_id: itemId }] },
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
    failOnStatusCode: false,
  });
}

// Deactivate any leftover E2E_MERGE_SRC / E2E_MERGE_TGT items from prior failed runs.
// Uses the nomenclature bootstrap endpoint (returns the full active item list) to find orphans,
// then batch-deactivates them so the test starts from a clean tree.
async function cleanupOrphans(page: Page): Promise<void> {
  const csrf = await getCsrf(page);
  const r = await page.request.get(`${BASE}/nomenclature/api/bootstrap/?_=${Date.now()}`, { failOnStatusCode: false });
  if (!r.ok()) return;
  const b = await r.json();
  const items: ItemDto[] = b?.data?.items ?? b?.items ?? [];
  const orphans = items.filter(i => i.name === 'E2E_MERGE_SRC' || i.name === 'E2E_MERGE_TGT');
  for (const it of orphans) {
    await cleanupItem(page.request, csrf, it.id);
  }
}

test.describe('MERGE_BATCH smoke', () => {
  test('merge-item through buffer: indicator, persistence across navigation, apply → source gone', async ({ page, context }) => {
    test.setTimeout(60000);
    await loginAsRoot(page);

    // Pre-cleanup: deactivate any leftover E2E_MERGE items from prior failed runs
    await cleanupOrphans(page);

    // Seed two items so test is deterministic
    const [sourceId, targetId] = await seedTwoItems(page);
    console.log(`seeded source=${sourceId} target=${targetId}`);

    // Open nomenclature, clear any stale buffer
    await page.goto('/nomenclature/', { waitUntil: 'networkidle' });
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Expand the top-level category that holds the seeded items (id=65 «Канцелярские товары»).
    // Seeded items are children of this category and only render when it is expanded.
    const catRow = page.locator('.tree-row', { hasText: 'Канцелярские товары' }).first();
    await catRow.scrollIntoViewIfNeeded();
    const toggle = catRow.locator('.toggle-btn').first();
    if (await toggle.count()) {
      await toggle.click();
      await page.waitForTimeout(500);
    }

    // Find source row
    const sourceRow = page.locator('.tree-row', { hasText: 'E2E_MERGE_SRC' }).first();
    await expect(sourceRow).toBeVisible({ timeout: 10000 });
    await sourceRow.click({ force: true });
    await page.waitForTimeout(400);

    // Click merge button (page-level trigger; modal submit button has a different label)
    const mergeBtn = page.getByRole('button', { name: 'Слияние', exact: true }).first();
    await expect(mergeBtn, 'merge button visible after selecting source').toBeVisible({ timeout: 5000 });
    await mergeBtn.click();
    await page.waitForTimeout(600);

    // Search target inside modal. NOTE: the Angular host `app-merge-item-modal`
    // has 0-height (no host CSS), so Playwright treats it as hidden. Target the
    // inner overlay which is the real visible surface.
    const modal = page.locator('app-merge-item-modal .modal-overlay').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    const searchInput = modal.locator('input').first();
    await searchInput.fill('E2E_MERGE_TGT');
    await page.waitForTimeout(700);

    // Pick first search result
    const firstResult = modal.locator('.search-result-item').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    await firstResult.click({ force: true });
    await page.waitForTimeout(400);

    // Submit merge
    const submitBtn = modal.getByRole('button', { name: /Слияние ТМЦ/i });
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();
    await page.waitForTimeout(700);

    // Assertions: modal closed, pending-merge indicator on source, badge present, buffer in sessionStorage
    await expect(modal).toBeHidden({ timeout: 3000 });
    const pendingRow = page.locator('.tree-row.pending-merge', { hasText: 'E2E_MERGE_SRC' });
    await expect(pendingRow, 'pending-merge CSS class on source row').toBeVisible({ timeout: 4000 });
    await expect(page.locator('.badge-merge', { hasText: 'сливается' }).first()).toBeVisible();

    const storedRaw = await page.evaluate(() => sessionStorage.getItem('catalog_pending_changes'));
    expect(storedRaw, 'sessionStorage non-empty').toBeTruthy();
    expect(storedRaw!, 'sessionStorage contains merge action').toContain('"action":"merge"');

    // Navigate away and back: buffer restored
    await page.goto('/operations/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.goto('/nomenclature/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await expect(
      page.locator('.tree-row.pending-merge', { hasText: 'E2E_MERGE_SRC' }),
      'pending-merge indicator restored after navigation'
    ).toBeVisible({ timeout: 5000 });

    // Apply batch. The page uses a native window.confirm() dialog which Playwright
    // auto-dismisses by default, so register an accept-handler BEFORE clicking.
    page.on('dialog', d => d.accept());
    const applyBtn = page.getByRole('button', { name: /^Применить$/i }).first();
    await expect(applyBtn, 'apply button visible').toBeVisible({ timeout: 5000 });
    await applyBtn.click();
    await page.waitForTimeout(2000);

    // Source gone, target still present
    await expect(page.locator('.tree-row', { hasText: 'E2E_MERGE_SRC' })).toHaveCount(0, { timeout: 6000 });
    await expect(page.locator('.tree-row', { hasText: 'E2E_MERGE_TGT' })).toHaveCount(1);

    // Buffer empty
    const storedAfter = await page.evaluate(() => sessionStorage.getItem('catalog_pending_changes'));
    expect(storedAfter, 'buffer cleared after apply').toBe('[]');

    // Cleanup target
    const csrf = await getCsrf(page);
    await cleanupItem(page.request, csrf, targetId);
  });
});