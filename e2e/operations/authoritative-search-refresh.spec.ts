/**
 * Stage 3a — authoritative item-search refresh in the Operation Modal.
 *
 * Contract (docs/TZ_OPERATION_MODAL_INLINE_TEMP_ITEM_SEARCH_REFRESH_v1.0.md):
 *  - «Обновить и проверить» performs a real `consistency=authoritative`
 *    request for the actual current query/context and fully replaces the
 *    candidate set (no old+new merge);
 *  - it re-validates only the selected permanent items via
 *    /catalog/read/items/resolve; inline/new rows are untouched;
 *  - it never calls the balances endpoint (that stays on «Обновить остатки»);
 *  - type/source-site change invalidates the candidate snapshot.
 *
 * Scenario B (fast-only candidate disappears after refresh) is proven at the
 * BFF level in Warehouse_web/apps/bff_api/tests_issue24.py
 * (BffApiAuthoritativeSearchTests): the modal search always requests
 * authoritative, so a fast-only candidate cannot be produced through it.
 *
 * Run: npx playwright test e2e/operations/authoritative-search-refresh.spec.ts
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRoot } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId } from '../helpers/seed';

const BFF = '/bff/api/v1';

async function getCsrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find(c => c.name === 'csrftoken')?.value ?? '';
}

/**
 * Navigation-first auth guard: direct BFF calls via `page.request` are only
 * reliable once the browser has actually landed on an authenticated app page.
 * A login race otherwise returns the login HTML to `res.json()`.
 */
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

async function postJson(page: Page, url: string, data: Record<string, unknown>) {
  const csrf = await getCsrf(page);
  const res = await page.request.post(url, {
    data,
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRFToken': csrf } : {}) },
    failOnStatusCode: false,
  });
  return { ok: res.ok(), body: await res.json().catch(() => null) as any };
}

async function getSites(page: Page): Promise<Array<{ site_id: string | number; name: string }>> {
  return (await getJson(page, '/catalog/sites'))?.data?.sites ?? [];
}

async function getAnyItem(page: Page): Promise<{ id: string | number; name: string } | null> {
  const item = ((await getJson(page, '/catalog/items?limit=10'))?.data?.items ?? [])[0];
  return item ? { id: item.id, name: item.name } : null;
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

function receivePayload(runId: string, siteId: string | number, lines: Record<string, unknown>[]) {
  return {
    type: 'RECEIVE',
    site_id: siteId,
    notes: runId,
    client_request_id: crypto.randomUUID(),
    lines: lines.map((line, idx) => ({ line_number: idx + 1, ...line })),
  };
}

function operationModal(page: Page) {
  return page.locator('[data-design-id="operation-modal"]');
}

async function openCreateModal(page: Page) {
  await page.locator('[data-testid="operations-create-button"]').click();
  await expect(operationModal(page)).toBeVisible({ timeout: 10000 });
}

async function firstSiteValue(select: ReturnType<Page['locator']>): Promise<string | null> {
  const option = select.locator('option[value]:not([value=""])').first();
  return (await option.count()) ? option.getAttribute('value') : null;
}

function countRequests(page: Page, predicate: (url: string, method: string) => boolean) {
  const seen: string[] = [];
  page.on('request', req => {
    if (predicate(req.url(), req.method())) seen.push(req.url());
  });
  return seen;
}

test.describe('Stage 3a — authoritative item search refresh', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
  });

  test('Scenario A: search → refresh → select existing item → add (no item_not_found)', async ({ page }) => {
    await openAuthenticatedOperations(page);
    const sites = await getSites(page);
    const item = await getAnyItem(page);
    if (!sites.length || !item) {
      test.skip(true, 'Stand has no site/catalog item fixture');
      return;
    }

    await openCreateModal(page);
    const modal = operationModal(page);
    await modal.locator('select').first().selectOption('RECEIVE');
    const destSelect = modal.locator('select').nth(1);
    await destSelect.selectOption(sites[0].site_id.toString());

    const searchInput = modal.locator('[data-design-id="item-search-input"]');
    await searchInput.fill(item.name);
    const options = modal.locator('.search-option');
    await expect(options.first()).toBeVisible({ timeout: 10000 });

    const authoritativeRefreshes = countRequests(
      page,
      (url, method) => method === 'GET' && url.includes('/catalog/search/items') && url.includes('consistency=authoritative'),
    );
    const before = authoritativeRefreshes.length;

    await modal.locator('[data-testid="btn-refresh-check-items"]').click();
    await expect.poll(() => authoritativeRefreshes.length, { timeout: 10000 }).toBeGreaterThan(before);

    const matchingOption = modal.locator('.search-option', { hasText: item.name }).first();
    await expect(matchingOption).toBeVisible({ timeout: 10000 });
    await matchingOption.click();

    const row = modal.locator('app-operation-lines-table tr', { hasText: `ID ${item.id}` }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.locator('.qty-input').fill('1');

    const saved = page.waitForResponse(
      r => r.url().includes('/operations') && r.request().method() === 'POST',
      { timeout: 15000 },
    );
    await modal.locator('[data-design-id="save-draft-btn"]').click();
    const response = await saved;
    expect(response.ok()).toBeTruthy();

    // A freshly refreshed valid candidate must not produce item_not_found.
    await expect(modal.locator('[data-testid="operation-line-row--error"]')).toHaveCount(0);
  });

  test('Scenario C: source-site change invalidates the snapshot and refresh uses the new site', async ({ page }) => {
    await openAuthenticatedOperations(page);
    const sites = await getSites(page);
    const item = await getAnyItem(page);
    if (sites.length < 2 || !item) {
      test.skip(true, 'Stand needs ≥2 sites and a catalog item');
      return;
    }

    await openCreateModal(page);
    const modal = operationModal(page);
    await modal.locator('select').first().selectOption('MOVE');

    const sourceSelect = modal.locator('select').nth(1);
    const siteOptions = await sourceSelect.locator('option[value]:not([value=""])').all();
    if (siteOptions.length < 2) {
      test.skip(true, 'Stand needs ≥2 source-site options');
      return;
    }
    const oldSite = (await siteOptions[0].getAttribute('value'))!;
    const newSite = (await siteOptions[1].getAttribute('value'))!;
    await sourceSelect.selectOption(oldSite);

    const searchInput = modal.locator('[data-design-id="item-search-input"]');
    await searchInput.fill(item.name);
    const options = modal.locator('.search-option');
    await expect(options.first()).toBeVisible({ timeout: 10000 });

    await sourceSelect.selectOption(newSite);

    // Old candidate snapshot is invalidated (query text may remain).
    await expect(options).toHaveCount(0, { timeout: 5000 });

    const refreshForNewSite = page.waitForRequest(
      req => req.method() === 'GET'
        && req.url().includes('/catalog/search/items')
        && req.url().includes('consistency=authoritative')
        && req.url().includes(`source_site_id=${newSite}`),
      { timeout: 15000 },
    );
    await modal.locator('[data-testid="btn-refresh-check-items"]').click();
    await refreshForNewSite;

    await expect(modal.locator('.search-option').first()).toBeVisible({ timeout: 10000 });
  });

  test('Scenario D: refresh resolves only permanent rows; inline row survives; no balances call', async ({ page }) => {
    await openAuthenticatedOperations(page);
    const sites = await getSites(page);
    const item = await getAnyItem(page);
    const refs = await getTemporaryRefs(page);
    if (!sites.length || !item || !refs) {
      test.skip(true, 'Stand has no site/item/unit/category fixture');
      return;
    }

    const runId = generateRunId();
    const created = await postJson(page, `${BFF}/operations`, receivePayload(runId, sites[0].site_id, [
      { item_id: item.id, qty: '2' },
      {
        temporary_item: {
          client_key: `k-refresh-${runId}`,
          name: `Refresh inline ${runId}`,
          unit_id: refs.unitId,
          category_id: refs.categoryId,
        },
        qty: '1',
      },
    ]));
    if (!created.ok || !created.body?.data?.id) {
      test.skip(true, 'Could not seed the draft');
      return;
    }

    await page.goto('/operations/', { waitUntil: 'networkidle' });
    const row = page.locator('[data-testid="operation-row"]', { hasText: runId }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.locator('.number-link').click();
    const modal = operationModal(page);
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Let the automatic balance load on open settle before measuring.
    await page.waitForTimeout(1000);

    const balanceRequests = countRequests(page, url => url.includes('/balances'));
    const resolveBodies: any[] = [];
    page.on('request', req => {
      if (req.method() === 'POST' && req.url().includes('/catalog/read/items/resolve')) {
        try { resolveBodies.push(req.postDataJSON()); } catch { /* ignore */ }
      }
    });
    const balancesBefore = balanceRequests.length;

    const resolveRequest = page.waitForRequest(
      req => req.method() === 'POST' && req.url().includes('/catalog/read/items/resolve'),
      { timeout: 15000 },
    );
    await modal.locator('[data-testid="btn-refresh-check-items"]').click();
    await resolveRequest;
    await expect.poll(() => resolveBodies.length, { timeout: 5000 }).toBeGreaterThan(0);

    // Only the selected permanent item is resolved; the inline row is not.
    expect(resolveBodies[0].item_ids).toEqual([String(item.id)]);

    // Inline row is preserved with its name; nothing is silently removed.
    await expect(modal.locator('app-operation-lines-table tbody tr')).toHaveCount(2);
    await expect(modal.locator('.inline-name-input')).toHaveValue(`Refresh inline ${runId}`);
    await expect(modal.locator('.inline-name-input')).toBeEditable();

    // «Обновить и проверить» must not touch balances.
    expect(balanceRequests.length).toBe(balancesBefore);

    // The separate «Обновить остатки» button still performs its own refresh.
    const balanceAfterRefreshClick = page.waitForRequest(
      req => req.method() === 'GET' && req.url().includes('/balances'),
      { timeout: 15000 },
    );
    await modal.locator('[data-testid="operation-lines-refresh-all"]').click();
    await balanceAfterRefreshClick;
  });
});
