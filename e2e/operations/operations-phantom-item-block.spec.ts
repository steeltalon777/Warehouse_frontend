/**
 * T9 (TZ-PHANTOM_ITEMS_CACHE_PRUNING_AND_REFRESH_FIX): phantom item blocks
 * save/submit with a reason — no 404 "item not found" toast surfaces.
 *
 * Scenario (L1 auto-validation before save):
 *  1. Open the operation create modal, add a real catalog item to the draft.
 *  2. Intercept `POST /bff/api/v1/catalog/read/items/resolve` and report the
 *     line as `missing` (a phantom — the authoritative status SyncServer
 *     returns for an item deleted bypassing Django).
 *  3. Click "Сохранить черновик" → the draft must NOT be persisted to
 *     SyncServer: no POST /operations, a toast with the reason is shown,
 *     and NO "not found" / 404 toast appears.
 *  4. Unroute the mock, replace the phantom line with a valid item, save →
 *     the operation is persisted (POST /operations succeeds).
 *
 * The BFF resolve response is mocked via page.route (established repo
 * pattern) so the test is deterministic and independent of SyncServer seed
 * state. The real SyncServer-side pruning is covered by stand smoke T8.
 *
 * Run: npx playwright test e2e/operations/operations-phantom-item-block.spec.ts
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

async function openCreateModal(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(400);
}

async function selectType(page: Page, type: string): Promise<void> {
  await page.locator('.modal-overlay select').first().selectOption(type);
  await page.waitForTimeout(300);
}

async function selectFirstWarehouse(page: Page): Promise<void> {
  const select = page.locator('.modal-overlay select').nth(1);
  const options = await select.locator('option').evaluateAll(nodes =>
    nodes.map(node => ({
      value: (node as HTMLOptionElement).value,
      label: node.textContent?.trim() ?? '',
    })),
  );
  const first = options.find(o => o.value && o.label && o.label !== 'Все участки');
  if (!first) throw new Error('No warehouse options in create modal');
  await select.selectOption(first.value);
  await expect(select).toHaveValue(first.value);
}

async function addFirstMatchingItem(page: Page, quantity: string): Promise<string> {
  const modal = page.locator('.modal-overlay');
  const queries = ['сол', 'кабель', 'ка', 'со', 'бф', 'тм'];
  for (const query of queries) {
    const search = modal.locator('input[placeholder*="Поиск ТМЦ для добавления"]');
    await search.fill(query);
    const optionNames = modal.locator('.search-option .option-name');
    try {
      await expect(optionNames.first()).toBeVisible({ timeout: 4000 });
    } catch {
      continue;
    }
    const name = (await optionNames.first().textContent())?.trim() ?? '';
    await modal.locator('.search-option').first().click();
    await expect(search).toHaveValue('');
    const row = modal.locator('tbody tr', { hasText: name }).first();
    await expect(row).toBeVisible();
    await row.locator('.qty-input').fill(quantity);
    return name;
  }
  throw new Error('No item found via fallback queries for phantom spec');
}

/** Intercept the BFF resolve endpoint and report every requested id as `missing`. */
async function mockResolveAsPhantom(page: Page): Promise<void> {
  await page.route('**/bff/api/v1/catalog/read/items/resolve', async route => {
    const postData = route.request().postData() || '{}';
    let ids: string[] = [];
    try {
      ids = (JSON.parse(postData)?.item_ids ?? []) as string[];
    } catch {
      ids = [];
    }
    const results = ids.map(id => ({
      requested_id: id,
      status: 'missing',
      canonical_item_id: null,
      item: null,
      reason: 'item not found',
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { results } }),
    });
  });
}

async function removeFirstLine(page: Page): Promise<void> {
  const removeBtn = page.locator('.modal-overlay tbody tr [aria-label="Удалить позицию"]').first();
  await expect(removeBtn).toBeVisible();
  await removeBtn.click();
  // The empty table still renders a single placeholder <tr>; assert no item rows remain.
  await expect(page.locator('.modal-overlay .item-name')).toHaveCount(0);
  await expect(page.locator('.modal-overlay .empty-state')).toContainText('Для добавления');
}

test.describe('Operation create modal — phantom item block (T9)', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('phantom line blocks save with reason and no 404 toast; valid replacement saves', async ({ page }) => {
    await openCreateModal(page);
    await selectType(page, 'RECEIVE');
    await selectFirstWarehouse(page);
    await addFirstMatchingItem(page, '1');

    // Count how many operation-persist POSTs the browser actually issues.
    let operationsPostCount = 0;
    await page.on('request', request => {
      if (request.method() === 'POST' && request.url().includes('/bff/api/v1/operations')) {
        operationsPostCount += 1;
      }
    });

    // Make the resolver report the line as a phantom (missing).
    await mockResolveAsPhantom(page);

    // Save must be blocked: no emit, toast with reason, no 404 toast.
    await page.click('.modal-overlay button:has-text("Сохранить черновик")');

    const toast = page.locator('[data-testid="operation-submit-toast"]');
    await expect(toast).toBeVisible({ timeout: 8000 });
    await expect(toast).toContainText('Сохранение отменено');
    await expect(toast).toContainText('удалённые/недоступные ТМЦ');
    // Hard requirement: the old 404 "item not found" surface must NOT appear.
    await expect(toast).not.toContainText('not found');
    await expect(toast).not.toContainText('404');

    // The line must be visibly flagged as unusable.
    const blockedBadge = page.locator('.modal-overlay [data-testid="line-blocked"]');
    await expect(blockedBadge.first()).toBeVisible();

    // No draft was persisted to SyncServer.
    await page.waitForTimeout(500);
    expect(operationsPostCount, 'save must NOT be emitted for a phantom line').toBe(0);

    // ─── Replace the phantom line with a valid item and save. ───
    await page.unroute('**/bff/api/v1/catalog/read/items/resolve');

    await removeFirstLine(page);
    await selectType(page, 'RECEIVE');
    await addFirstMatchingItem(page, '1');

    // Save again — the real resolver now reports the item as active, so the
    // draft is persisted (POST /operations returns 200/201).
    const saveResponse = page.waitForResponse(
      response =>
        response.url().includes('/bff/api/v1/operations') &&
        response.request().method() === 'POST' &&
        (response.status() === 200 || response.status() === 201),
      { timeout: 10000 },
    );
    await page.click('.modal-overlay button:has-text("Сохранить черновик")');
    await saveResponse;
    expect(operationsPostCount, 'valid replacement must be saved').toBe(1);
  });
});