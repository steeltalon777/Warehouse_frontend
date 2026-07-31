import { expect, Page, test } from '@playwright/test';

import { installNetworkGuard, loginAsRoot } from './helpers';

const OBJECT_ID = 'pw-issue-object-1';
const CATEGORY_ID = 'pw-issue-category-1';
const OBJECT_NAME = 'PW Layout Vehicle A-01';
const PAGE_URL = '/issued-assets/';
const PARAMS_CARD_MIN_HEIGHT = 320;

interface MockLayoutOptions {
  rows: number;
}

function buildObjectResponse() {
  return {
    id: OBJECT_ID,
    display_name: OBJECT_NAME,
    object_type: 'vehicle',
    category_id: CATEGORY_ID,
    comment: 'PW deterministic layout fixture',
    code: 'PW-LAYOUT-01',
    normalized_key: 'pw-layout-vehicle-a-01',
    is_active: true,
    issued_positions_count: 0,
    issued_total_qty: '0.000',
    created_at: '2026-06-10T09:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
  };
}

function buildTreeResponse() {
  return [
    {
      type: 'category',
      id: CATEGORY_ID,
      name: 'PW Layout Category',
      parent_id: null,
      is_active: true,
      children: [
        {
          type: 'object',
          id: OBJECT_ID,
          name: OBJECT_NAME,
          comment: 'PW deterministic layout fixture',
          category_id: CATEGORY_ID,
          is_active: true,
        },
      ],
    },
  ];
}

function buildCategoriesResponse() {
  return {
    items: [
      {
        id: CATEGORY_ID,
        name: 'PW Layout Category',
        parent_id: null,
        sort_order: 10,
        is_active: true,
        created_at: '2026-06-10T08:00:00Z',
        updated_at: '2026-06-10T08:00:00Z',
      },
    ],
    total_count: 1,
    page: 1,
    page_size: 200,
  };
}

function buildSitesResponse() {
  return [
    {
      site_id: 'pw-site-1',
      name: 'PW Demo Site',
    },
  ];
}

function buildAuthMeResponse() {
  return {
    user_id: 'pw-root',
    role: 'root',
    default_site_id: 'pw-site-1',
  };
}

function buildAssetRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    issue_object_id: OBJECT_ID,
    issue_object_name: OBJECT_NAME,
    issue_object_type: 'vehicle',
    inventory_subject_id: `pw-subject-${index + 1}`,
    subject_type: 'item',
    item_id: `pw-item-${index + 1}`,
    resolved_item_id: `pw-item-${index + 1}`,
    resolved_item_name: `PW Asset ${index + 1}`,
    display_name: `PW Asset ${index + 1}`,
    item_name: `PW Asset ${index + 1}`,
    sku: `PW-SKU-${String(index + 1).padStart(3, '0')}`,
    qty: (index % 3 === 0 ? '1.000' : '2.000'),
    updated_at: `2026-06-${String((index % 9) + 10).padStart(2, '0')}T12:00:00Z`,
  }));
}

async function fulfillOk(route: any, data: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, data }),
  });
}

async function installRepositoryMocks(page: Page, options: MockLayoutOptions): Promise<void> {
  const assetRows = buildAssetRows(options.rows);

  await page.route('**/bff/api/v1/auth/me**', route => fulfillOk(route, buildAuthMeResponse()));
  await page.route('**/bff/api/v1/catalog/sites**', route => fulfillOk(route, buildSitesResponse()));
  await page.route('**/bff/api/v1/issue-object-categories**', route => fulfillOk(route, buildCategoriesResponse()));
  await page.route('**/bff/api/v1/issue-object-categories?**', route => fulfillOk(route, buildCategoriesResponse()));
  await page.route('**/bff/api/v1/issue-objects/tree**', route => fulfillOk(route, buildTreeResponse()));
  await page.route(`**/bff/api/v1/issue-objects/${OBJECT_ID}`, route => fulfillOk(route, buildObjectResponse()));
  await page.route(`**/bff/api/v1/issue-objects/${OBJECT_ID}/assets**`, route => fulfillOk(route, { items: assetRows }));
}

async function assertNoDirectSyncServerCalls(page: Page, action: () => Promise<void>): Promise<void> {
  const apiRequests: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
      apiRequests.push(request.url());
    }
  });

  await action();

  for (const url of apiRequests) {
    const pathname = new URL(url).pathname;
    const isDirectApi = pathname.includes('/api/v1/') && !pathname.includes('/bff/api/v1/');
    expect(isDirectApi, `Unexpected direct SyncServer request: ${url}`).toBeFalsy();
    expect(url, `Unexpected direct localhost:8000 request: ${url}`).not.toContain('localhost:8000');
  }
}

async function openRepositoryPage(page: Page): Promise<void> {
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('issue-repository-page')).toBeVisible();
}

async function selectMockedObject(page: Page): Promise<void> {
  await page.getByTitle('Развернуть всё').click();
  await page.getByRole('button', { name: OBJECT_NAME }).click();
}

async function getHeight(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box).not.toBeNull();
  return box!.height;
}

async function expectInternalScroll(page: Page, wrapperTestId: string): Promise<void> {
  const wrapper = page.getByTestId(wrapperTestId);
  await expect(wrapper).toBeVisible();

  const metrics = await wrapper.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));

  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  await wrapper.evaluate(element => {
    element.scrollTop = Math.max(200, Math.floor(element.scrollHeight / 3));
  });

  await expect.poll(async () => {
    return wrapper.evaluate(element => element.scrollTop);
  }).toBeGreaterThan(metrics.scrollTop);
}

async function expectStickyHeader(page: Page, wrapperTestId: string): Promise<void> {
  const wrapper = page.getByTestId(wrapperTestId);
  const headerCell = page.getByTestId('issued-assets-table').locator('th').first();

  const before = await Promise.all([
    wrapper.boundingBox(),
    headerCell.boundingBox(),
  ]);

  await wrapper.evaluate(element => {
    element.scrollTop = Math.max(220, Math.floor(element.scrollHeight / 2));
  });

  await expect.poll(async () => {
    return wrapper.evaluate(element => element.scrollTop);
  }).toBeGreaterThan(0);

  const after = await Promise.all([
    wrapper.boundingBox(),
    headerCell.boundingBox(),
  ]);

  expect(before[0]).not.toBeNull();
  expect(before[1]).not.toBeNull();
  expect(after[0]).not.toBeNull();
  expect(after[1]).not.toBeNull();
  expect(Math.abs(after[1]!.y - before[1]!.y)).toBeLessThanOrEqual(4);
}

async function prepareMockedObjectLayout(page: Page, options: MockLayoutOptions): Promise<void> {
  installNetworkGuard(page);
  await loginAsRoot(page);
  await installRepositoryMocks(page, options);
  await assertNoDirectSyncServerCalls(page, async () => {
    await openRepositoryPage(page);
    await selectMockedObject(page);
  });
}

test.describe('Issued assets repository layout', () => {
  test('real smoke: /issued-assets/ loads through Django shell and Angular without direct SyncServer calls', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);

    await assertNoDirectSyncServerCalls(page, async () => {
      await openRepositoryPage(page);
      await expect(page.locator('.topbar')).toBeVisible();
      await expect(page.locator('.sidebar')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Репозиторий выдачи' })).toBeVisible();
      await expect(page.getByRole('button', { name: '+ Объект выдачи' })).toBeVisible();
      await expect(page.getByRole('button', { name: '+ Категория выдачи' })).toBeVisible();
    });
  });

  test('mocked layout: 0 rows shows stable empty state contract', async ({ page }) => {
    await prepareMockedObjectLayout(page, { rows: 0 });
    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
    await expect(page.getByTestId('issued-assets-panel')).toBeVisible();
    await expect(page.getByTestId('issued-assets-header')).toBeVisible();
    await expect(page.getByTestId('issued-assets-table-wrap')).toBeVisible();
    await expect(page.getByTestId('issued-assets-empty-state')).toHaveText('За объектом сейчас не числится имущество.');
    await expect(page.getByTestId('issued-asset-row')).toHaveCount(0);
    await expect(page.getByTestId('issue-object-params-card')).toBeVisible();
  });

  for (const rows of [1, 5]) {
    test(`mocked layout: ${rows} row(s) keep params card readable`, async ({ page }) => {
      await prepareMockedObjectLayout(page, { rows });
      await expect(page.getByTestId('issued-asset-row')).toHaveCount(rows);
      await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
      await expect(page.getByTestId('issued-assets-panel')).toBeVisible();
      expect(await getHeight(page, 'issue-object-params-card')).toBeGreaterThanOrEqual(PARAMS_CARD_MIN_HEIGHT);
      await expect(page.getByTestId('issued-assets-table-wrap')).toBeVisible();
      await expect(page.getByTestId('issued-assets-header')).toBeVisible();
    });
  }

  test('mocked layout: 24 rows scroll inside embedded wrapper and keep sticky header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepareMockedObjectLayout(page, { rows: 24 });
    await expect(page.getByTestId('issued-asset-row')).toHaveCount(24);
    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
    await expect(page.getByTestId('issued-assets-panel')).toBeVisible();
    expect(await getHeight(page, 'issue-object-params-card')).toBeGreaterThanOrEqual(PARAMS_CARD_MIN_HEIGHT);
    await expectInternalScroll(page, 'issued-assets-table-wrap');
    await expectStickyHeader(page, 'issued-assets-table-wrap');
  });

  test('mocked layout: expanded mode opens, scrolls internally, and closes on same object', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepareMockedObjectLayout(page, { rows: 24 });
    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
    await expect(page.getByTestId('issued-assets-expand-button')).toBeVisible();
    await page.getByTestId('issued-assets-expand-button').click();

    await expect(page.getByTestId('issued-assets-expanded-dialog')).toBeVisible();
    await expect(page.getByTestId('issued-assets-expanded-title')).toContainText(OBJECT_NAME);
    await expectInternalScroll(page, 'issued-assets-expanded-table-wrap');
    await expectStickyHeader(page, 'issued-assets-expanded-table-wrap');

    await page.getByTestId('issued-assets-expanded-close-button').click();
    await expect(page.getByTestId('issued-assets-expanded-dialog')).toHaveCount(0);
    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
  });

  test('mocked user scenario: embedded return action opens operation modal for the same object', async ({ page }) => {
    await prepareMockedObjectLayout(page, { rows: 1 });

    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
    await page.getByTestId('issued-asset-return-button').click();

    await expect(page.getByRole('heading', { name: 'Новая операция' })).toBeVisible();
    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
    await page.once('dialog', dialog => dialog.accept());
    await page.locator('.modal-overlay').getByRole('button', { name: 'Закрыть' }).click();
    await expect(page.getByRole('heading', { name: 'Новая операция' })).toHaveCount(0);
  });

  test('mocked user scenario: expanded write-off action closes dialog and opens operation modal', async ({ page }) => {
    await prepareMockedObjectLayout(page, { rows: 24 });

    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
    await page.getByTestId('issued-assets-expand-button').click();
    await expect(page.getByTestId('issued-assets-expanded-dialog')).toBeVisible();

    await page.getByTestId('issued-assets-expanded-dialog').getByTestId('issued-asset-writeoff-button').first().click({ force: true });

    await expect(page.getByTestId('issued-assets-expanded-dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Новая операция' })).toBeVisible();
    await expect(page.getByTestId('issued-assets-expand-button')).not.toBeFocused();
    await expect(page.getByTestId('issue-object-detail')).toContainText(OBJECT_NAME);
    await page.once('dialog', dialog => dialog.accept());
    await page.locator('.modal-overlay').getByRole('button', { name: 'Закрыть' }).click();
    await expect(page.getByRole('heading', { name: 'Новая операция' })).toHaveCount(0);
  });
});
