/**
 * Playwright UI automation for TZ-OPERATION_MODAL_BALANCES_MANUAL_REFRESH (§7).
 *
 * Scenarios:
 *  A. Warehouse switch updates line qty once (no race) + exactly one new
 *     GET /bff/api/v1/balances request for the new site.
 *  B. «Обновить всё» button: disabled + spinner while in-flight, line qtys
 *     match the API afterwards.
 *  C. Search dropdown no longer renders `.option-stock` and the search
 *     request carries no `include_balance=true`.
 *  D. Submit does not trigger a background balance refresh.
 *
 * Run: npx playwright test e2e/operations/operations-balances-manual.spec.ts
 * Requires: docker stand running with spa_user logged out.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

async function selectFirstWarehouse(page: Page): Promise<string> {
  const select = page.locator('.modal-overlay select').nth(1);
  const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({
    value: (node as HTMLOptionElement).value,
    label: node.textContent?.trim() ?? '',
  })));
  const firstWarehouse = options.find(option => option.value && option.label && option.label !== 'Все участки');
  if (!firstWarehouse) throw new Error('No warehouse options available in create modal');
  await select.selectOption(firstWarehouse.value);
  await expect(select).toHaveValue(firstWarehouse.value);
  return firstWarehouse.label;
}

async function selectAlternativeWarehouse(page: Page, current: string): Promise<string | null> {
  const select = page.locator('.modal-overlay select').nth(1);
  const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({
    value: (node as HTMLOptionElement).value,
    label: node.textContent?.trim() ?? '',
  })));
  const alternative = options.find(option => option.value && option.label && option.label !== 'Все участки' && option.label !== current) ?? null;
  if (alternative) {
    await select.selectOption(alternative.value);
    await expect(select).toHaveValue(alternative.value);
  }
  return alternative?.label ?? null;
}

async function openCreateModal(page: Page) {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
}

async function fetchWarehouseBalance(page: Page, siteName: string, itemNamePart: string): Promise<string> {
  return page.evaluate(async ({ siteName, itemNamePart }) => {
    const sitesResponse = await fetch('/bff/api/v1/catalog/sites', { credentials: 'include' });
    const sitesPayload = await sitesResponse.json();
    const site = (sitesPayload?.data?.sites ?? []).find((s: any) => s.name === siteName);
    if (!site) throw new Error(`Site not found: ${siteName}`);

    const balancesResponse = await fetch(`/bff/api/v1/balances?site_id=${site.site_id}`, { credentials: 'include' });
    const balancesPayload = await balancesResponse.json();
    const rows = Array.isArray(balancesPayload?.data) ? balancesPayload.data : (balancesPayload?.data?.items ?? []);
    const row = rows.find((b: any) => String(b.item_name ?? '').includes(itemNamePart));
    if (!row) throw new Error(`Balance row not found for: ${itemNamePart}`);
    return String(parseFloat(row.qty));
  }, { siteName, itemNamePart });
}

async function fetchSiteId(page: Page, siteName: string): Promise<string> {
  return page.evaluate(async (name) => {
    const sitesResponse = await fetch('/bff/api/v1/catalog/sites', { credentials: 'include' });
    const sitesPayload = await sitesResponse.json();
    const site = (sitesPayload?.data?.sites ?? []).find((s: any) => s.name === name);
    if (!site) throw new Error(`Site not found: ${name}`);
    return String(site.site_id);
  }, siteName);
}

function trackBalanceRequests(page: Page): { urls: string[]; siteIds: string[] } {
  const state = { urls: [] as string[], siteIds: [] as string[] };
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/bff/api/v1/balances')) {
      state.urls.push(url);
      state.siteIds.push(new URL(url).searchParams.get('site_id') ?? '');
    }
  });
  return state;
}

async function addVisibleItemToDraft(page: Page, query: string, quantity: string, usedNames: Set<string>): Promise<string | null> {
  const modal = page.locator('.modal-overlay');
  const search = modal.locator('input[placeholder*="Поиск ТМЦ для добавления"]');
  await search.fill('');
  await expect(search).toHaveValue('');
  await search.fill(query);

  const optionNames = modal.locator('.search-option .option-name');
  await expect(optionNames.first()).toBeVisible({ timeout: 5000 });
  const names = (await optionNames.allTextContents()).map(name => name.trim()).filter(Boolean);
  const itemName = names.find(name => !usedNames.has(name));
  if (!itemName) return null;

  const option = modal.locator('.search-option', { hasText: itemName }).first();
  await option.click();
  await expect(search).toHaveValue('');

  const row = modal.locator('tbody tr', { hasText: itemName }).first();
  await expect(row).toBeVisible();
  await row.locator('.qty-input').fill(quantity);
  usedNames.add(itemName);
  return itemName;
}

async function addFirstMatchingItem(page: Page, queries: string[], quantity: string, usedNames: Set<string> = new Set<string>()): Promise<string> {
  for (const query of queries) {
    const addedName = await addVisibleItemToDraft(page, query, quantity, usedNames).catch(() => null);
    if (addedName) return addedName;
  }
  throw new Error(`No item found for fallback queries: ${queries.join(', ')}`);
}

test.describe('Operation Create Modal — manual balance refresh', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('SCENARIO A: warehouse switch updates line qty once (no race)', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');

    const tracker = trackBalanceRequests(page);
    const warehouseA = await selectFirstWarehouse(page);
    const itemName = await addFirstMatchingItem(page, ['сол', 'кабель', 'ка'], '1');

    // Wait for targeted balance to load after item selection
    const firstRowAvail = page.locator('.modal-overlay tbody tr').first().locator('.col-avail');
    await expect(firstRowAvail).toContainText(/\d+/, { timeout: 10000 });

    const expectedA = await fetchWarehouseBalance(page, warehouseA, itemName).catch(() => null);
    if (expectedA !== null) {
      await expect(firstRowAvail).toContainText(expectedA);
    }

    const countBefore = tracker.siteIds.length;
    const warehouseB = await selectAlternativeWarehouse(page, warehouseA);
    if (!warehouseB) {
      test.skip(true, 'No alternative warehouse available for warehouse-switch scenario');
      return;
    }
    const siteBId = await fetchSiteId(page, warehouseB);

    // Exactly one new GET /bff/api/v1/balances for site B after the switch.
    await expect.poll(() => tracker.siteIds.filter(siteId => siteId === siteBId).length, { timeout: 10000 }).toBe(1);
    await page.waitForTimeout(300);
    expect(tracker.siteIds.filter(siteId => siteId === siteBId).length).toBe(1);
    expect(tracker.siteIds.length).toBe(countBefore + 1);

    // Line qty now matches the API for warehouse B.
    const expectedB = await fetchWarehouseBalance(page, warehouseB, itemName).catch(() => null);
    if (expectedB !== null) {
      await expect(firstRowAvail).toContainText(expectedB);
    }
  });

  test('SCENARIO B: refresh-all button refreshes all line qtys', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    const warehouseA = await selectFirstWarehouse(page);

    // Delay balance responses so the in-flight disabled/spinner state is
    // observable regardless of how fast the local stand answers.
    await page.route('**/bff/api/v1/balances*', async route => {
      await new Promise(resolve => setTimeout(resolve, 400));
      await route.continue();
    });

    const usedNames = new Set<string>();
    const itemName1 = await addFirstMatchingItem(page, ['сол', 'кабель', 'ка'], '1', usedNames);
    const itemName2 = await addFirstMatchingItem(page, ['сол', 'кабель', 'ка'], '1', usedNames);

    // Wait for targeted balance to load
    await expect(page.locator('.modal-overlay tbody tr .col-avail').first()).toContainText(/\d+/, { timeout: 10000 });

    const refreshBtn = page.locator('[data-testid="operation-lines-refresh-all"]');
    await expect(refreshBtn).toBeEnabled();

    await refreshBtn.click();
    // Immediately after the click the button is disabled (in-flight request).
    await expect(refreshBtn).toBeDisabled({ timeout: 5000 });

    // Rows show the «…» loading placeholder while the request is in flight.
    await expect(page.locator('.modal-overlay tbody tr .avail-loading').first()).toBeVisible({ timeout: 5000 });

    await expect(refreshBtn).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('.modal-overlay tbody tr .avail-loading')).toHaveCount(0);

    await page.unroute('**/bff/api/v1/balances*');

    // Line qtys match the API for site A.
    for (const itemName of [itemName1, itemName2]) {
      const cell = page.locator('.modal-overlay tbody tr', { hasText: itemName }).locator('.col-avail');
      const expected = await fetchWarehouseBalance(page, warehouseA, itemName).catch(() => null);
      await expect(cell).toContainText(/\d+/);
      if (expected !== null) {
        await expect(cell).toContainText(expected);
      }
    }
  });

  test('SCENARIO C: search dropdown has no source_site_qty', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await selectFirstWarehouse(page);

    let includeBalanceRequested = false;
    page.on('request', request => {
      if (request.url().includes('include_balance')) {
        includeBalanceRequested = true;
      }
    });

    const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');
    await search.fill('сол');
    await expect(page.locator('.modal-overlay .search-option').first()).toBeVisible({ timeout: 5000 });

    // No «на складе: X» span in the dropdown options.
    await expect(page.locator('.modal-overlay .option-stock')).toHaveCount(0);
    // No enriching balance request with include_balance=true.
    expect(includeBalanceRequested).toBe(false);
  });

  test('SCENARIO D: submit does not trigger background balance refresh', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await selectFirstWarehouse(page);
    await addFirstMatchingItem(page, ['сол', 'кабель', 'ка'], '1');

    // Wait for targeted balance to load
    await expect(page.locator('.modal-overlay tbody tr .col-avail').first()).toContainText(/\d+/, { timeout: 10000 });

    const tracker = trackBalanceRequests(page);
    const countBefore = tracker.urls.length;

    const submitBtn = page.locator('.modal-overlay button:has-text("Подтвердить")');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await page.waitForTimeout(400);

    // No GET /bff/api/v1/balances fired by the submit flow.
    expect(tracker.urls.length).toBe(countBefore);
  });
});
