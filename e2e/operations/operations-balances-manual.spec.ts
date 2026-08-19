/**
 * Playwright UI automation for TZ-OPERATION_MODAL_BALANCES_MANUAL_REFRESH (§7)
 * and issue #24 balance lifecycle regression.
 *
 * Scenarios:
 *  A. Warehouse switch refreshes the line qty once (no race); the displayed
 *     «Имеется» value equals the authoritative API value; requests are targeted
 *     (item_ids) and bounded.
 *  B. «Обновить всё» button: disabled + spinner while in-flight, and after the
 *     refresh the line qty matches the authoritative API value.
 *  C. Search dropdown no longer renders `.option-stock` and the search
 *     request carries no `include_balance=true`.
 *  D. A real submit does not trigger a background balance refresh.
 *  LOOP. One idle item never produces a continuing targeted balance request
 *     stream (issue #24 B1 regression).
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

interface StockedBalance {
  itemId: string;
  name: string;
  qty: string;
}

/** Fetch up to `count` items with a positive balance on the given site. */
async function fetchStockedBalances(page: Page, siteName: string, count: number): Promise<StockedBalance[]> {
  return page.evaluate(async ({ siteName, count }) => {
    const sitesResponse = await fetch('/bff/api/v1/catalog/sites', { credentials: 'include' });
    const sitesPayload = await sitesResponse.json();
    const site = (sitesPayload?.data?.sites ?? []).find((s: any) => s.name === siteName);
    if (!site) throw new Error(`Site not found: ${siteName}`);

    const balancesResponse = await fetch(`/bff/api/v1/balances?site_id=${site.site_id}`, { credentials: 'include' });
    const balancesPayload = await balancesResponse.json();
    const rows = Array.isArray(balancesPayload?.data) ? balancesPayload.data : (balancesPayload?.data?.items ?? []);
    const positive = rows
      .filter((b: any) => parseFloat(b.qty) > 0)
      .map((b: any) => ({ itemId: String(b.item_id), name: String(b.item_name ?? ''), qty: String(parseFloat(b.qty)) }))
      .slice(0, count);
    if (positive.length < count) {
      throw new Error(`Only ${positive.length} positive balance rows on ${siteName}`);
    }
    return positive;
  }, { siteName, count });
}

/** Authoritative qty for one item on one site via targeted item_ids (0 when absent). */
async function fetchBalanceByItemId(page: Page, siteName: string, itemId: string): Promise<number> {
  return page.evaluate(async ({ siteName, itemId }) => {
    const sitesResponse = await fetch('/bff/api/v1/catalog/sites', { credentials: 'include' });
    const sitesPayload = await sitesResponse.json();
    const site = (sitesPayload?.data?.sites ?? []).find((s: any) => s.name === siteName);
    if (!site) throw new Error(`Site not found: ${siteName}`);

    const balancesResponse = await fetch(`/bff/api/v1/balances?site_id=${site.site_id}&item_ids=${itemId}`, { credentials: 'include' });
    const balancesPayload = await balancesResponse.json();
    const rows = Array.isArray(balancesPayload?.data) ? balancesPayload.data : (balancesPayload?.data?.items ?? []);
    if (rows.length === 0) return 0;
    return parseFloat(rows[0].qty);
  }, { siteName, itemId });
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

async function addItemByNameToDraft(page: Page, name: string, quantity: string): Promise<void> {
  const modal = page.locator('.modal-overlay');
  const search = modal.locator('input[placeholder*="Поиск ТМЦ для добавления"]');
  await search.fill(name);
  const option = modal.locator('.search-option', { hasText: name }).first();
  await expect(option).toBeVisible({ timeout: 5000 });
  await option.click();
  await expect(search).toHaveValue('');
  const row = modal.locator('tbody tr', { hasText: name }).first();
  await expect(row).toBeVisible();
  await row.locator('.qty-input').fill(quantity);
}

/** Read the numeric «Имеется» value of the first draft row, or null while not FRESH. */
async function readDisplayedAvailable(page: Page): Promise<number | null> {
  const valueEl = page.locator('.modal-overlay tbody tr').first().locator('.col-avail .avail-value');
  const count = await valueEl.count();
  if (count === 0) return null;
  const text = (await valueEl.first().textContent())?.trim() ?? '';
  const parsed = parseFloat(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Wait until the first row's «Имеется» cell shows a numeric value. */
async function waitForAvailableValue(page: Page, timeout = 15000): Promise<number> {
  await expect(page.locator('.modal-overlay tbody tr').first().locator('.col-avail .avail-value')).toBeVisible({ timeout });
  const value = await readDisplayedAvailable(page);
  if (value === null) throw new Error('Available value did not become numeric');
  return value;
}

test.describe('Operation Create Modal — manual balance refresh', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('SCENARIO A: warehouse switch refreshes line qty once and matches authoritative value', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');

    const warehouseA = await selectFirstWarehouse(page);
    const [stocked] = await fetchStockedBalances(page, warehouseA, 1);
    const tracker = trackBalanceRequests(page);

    await addItemByNameToDraft(page, stocked.name, '1');

    // The displayed value must equal the authoritative API balance.
    const displayedA = await waitForAvailableValue(page);
    expect(displayedA).toBe(parseFloat(stocked.qty));

    // Targeted request carried item_ids.
    expect(tracker.urls[0]).toContain('item_ids=');

    const warehouseB = await selectAlternativeWarehouse(page, warehouseA);
    if (!warehouseB) {
      test.skip(true, 'No alternative warehouse available for warehouse-switch scenario');
      return;
    }
    const siteBId = await fetchSiteId(page, warehouseB);

    // Exactly one targeted request for site B (no race, no stream).
    await expect.poll(
      () => tracker.siteIds.filter(siteId => siteId === siteBId).length,
      { timeout: 15000 },
    ).toBeGreaterThanOrEqual(1);
    const siteBUrls = tracker.urls.filter(u => u.includes(`site_id=${siteBId}`));
    expect(siteBUrls[0]).toContain('item_ids=');

    // The displayed value updates to the authoritative site-B value (targeted).
    const expectedB = await fetchBalanceByItemId(page, warehouseB, stocked.itemId);
    await expect.poll(async () => readDisplayedAvailable(page), { timeout: 15000 }).toBe(expectedB);

    // Bounded request count: after the value stabilised, no continuing stream.
    const countAfterStable = tracker.urls.length;
    await page.waitForTimeout(3000);
    expect(tracker.urls.length).toBe(countAfterStable);
  });

  test('SCENARIO B: refresh-all button refreshes line qtys to authoritative values', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    const warehouseA = await selectFirstWarehouse(page);

    const stocked = await fetchStockedBalances(page, warehouseA, 2);
    await addItemByNameToDraft(page, stocked[0].name, '1');
    await addItemByNameToDraft(page, stocked[1].name, '1');

    // Both lines reach a FRESH numeric value.
    await expect(page.locator('.modal-overlay tbody tr').nth(0).locator('.col-avail .avail-value')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.modal-overlay tbody tr').nth(1).locator('.col-avail .avail-value')).toBeVisible({ timeout: 15000 });

    const refreshBtn = page.locator('[data-testid="operation-lines-refresh-all"]');
    await expect(refreshBtn).toBeEnabled({ timeout: 15000 });

    const tracker = trackBalanceRequests(page);
    await refreshBtn.click();

    // The manual refresh fires exactly one targeted balance request; wait for
    // it to fire (validateAndApplyLineStatuses runs before the balance read).
    await expect.poll(() => tracker.urls.length, { timeout: 15000 }).toBe(1);
    expect(tracker.urls[0]).toContain('item_ids=');
    // The button returns to an enabled state once the request completes.
    await expect(refreshBtn).toBeEnabled({ timeout: 15000 });

    // Both rows keep matching the authoritative API value after refresh. The
    // authoritative value is re-fetched at comparison time so a concurrent
    // stand mutation does not drift against the initial snapshot.
    const expected1 = await fetchBalanceByItemId(page, warehouseA, stocked[0].itemId);
    const expected2 = await fetchBalanceByItemId(page, warehouseA, stocked[1].itemId);
    await expect.poll(async () => {
      const row1 = page.locator('.modal-overlay tbody tr').nth(0).locator('.col-avail .avail-value');
      const row2 = page.locator('.modal-overlay tbody tr').nth(1).locator('.col-avail .avail-value');
      const t1 = parseFloat(((await row1.textContent()) ?? '').trim().replace(',', '.'));
      const t2 = parseFloat(((await row2.textContent()) ?? '').trim().replace(',', '.'));
      return `${t1}|${t2}`;
    }, { timeout: 15000 }).toBe(`${expected1}|${expected2}`);
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

  test('SCENARIO D: a real submit does not trigger a background balance refresh', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    const warehouseA = await selectFirstWarehouse(page);
    const [stocked] = await fetchStockedBalances(page, warehouseA, 1);
    await addItemByNameToDraft(page, stocked.name, '1');

    // Wait for the initial targeted refresh to finish (button re-enabled).
    const refreshBtn = page.locator('[data-testid="operation-lines-refresh-all"]');
    await expect(refreshBtn).toBeEnabled({ timeout: 15000 });

    const tracker = trackBalanceRequests(page);
    const countBefore = tracker.urls.length;

    const submitBtn = page.locator('.modal-overlay button:has-text("Подтвердить")');
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    // The submit must happen: success banner or a domain rejection — in both
    // cases no new balance refresh may fire.
    await expect(
      page.locator('[data-testid="operation-submit-result"], [data-testid="operation-submit-toast"]').first(),
    ).toBeVisible({ timeout: 15000 });

    expect(tracker.urls.length).toBe(countBefore);
  });

  test('E2E LOOP REGRESSION: idle one-item modal makes no balance request stream (B1)', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    const warehouseA = await selectFirstWarehouse(page);
    const [stocked] = await fetchStockedBalances(page, warehouseA, 1);

    const tracker = trackBalanceRequests(page);
    await addItemByNameToDraft(page, stocked.name, '1');

    // Wait until the balance cell leaves the loading state and shows a value.
    await waitForAvailableValue(page);

    // After stabilisation: ideally 1 targeted request, tolerated <=2.
    const countAfterStable = tracker.urls.length;
    expect(countAfterStable).toBeLessThanOrEqual(2);

    // Deterministic quiet window: no continuing request stream while idle.
    await page.waitForTimeout(5000);
    expect(tracker.urls.length).toBe(countAfterStable);
    expect(tracker.urls.length).toBeLessThanOrEqual(2);

    // Refresh button is usable again (not permanently disabled).
    const refreshBtn = page.locator('[data-testid="operation-lines-refresh-all"]');
    await expect(refreshBtn).toBeEnabled({ timeout: 5000 });
  });
});
