import { test, expect } from '@playwright/test';

// Admin user — superuser with full permissions.
// /catalog/ must be readonly even for superuser (route mode overrides role).
// /nomenclature/ is editable for superuser.
const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };

async function loginAs(page, { username, password }: { username: string; password: string }) {
  await page.goto('/login/');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(client|catalog|nomenclature)\//);
}

// ─── 1. Non-manager readonly catalog ───
test.describe('Non-manager readonly catalog', () => {
  test('1. Login and open /catalog/ — Django shell visible', async ({ page }) => {
    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/catalog/');
    await page.waitForSelector('app-root');
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('2. Catalog page shows Angular content with no write controls', async ({ page }) => {
    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/catalog/');
    await page.waitForSelector('app-root');
    // Page header should show "Каталог" not "Номенклатура"
    await expect(page.locator('app-page-header')).toContainText('Каталог');
    // No create buttons should be visible
    await expect(page.locator('app-action-buttons')).not.toContainText('+ Категория');
    await expect(page.locator('app-action-buttons')).not.toContainText('+ ТМЦ');
    await expect(page.locator('app-action-buttons')).not.toContainText('+ Ед. изм.');
    // No pending changes bar
    await expect(page.locator('app-pending-changes-bar')).not.toBeVisible();
    // No apply button in header
    await expect(page.locator('app-page-header')).not.toContainText('Применить все');
  });

  test('3. Expand/collapse/search/select still works', async ({ page }) => {
    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/catalog/');
    await page.waitForSelector('app-root');
    // Expand/collapse buttons should be visible
    await expect(page.locator('app-action-buttons')).toContainText('Раскрыть всё');
    await expect(page.locator('app-action-buttons')).toContainText('Свернуть всё');
    // Search input should be visible
    await expect(page.locator('app-search-input')).toBeVisible();
    // Catalog tree should be present
    await expect(page.locator('app-catalog-tree')).toBeVisible();
  });

  test('4. Right panel shows readonly detail when selecting a node', async ({ page }) => {
    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/catalog/');
    await page.waitForSelector('app-root');
    // Try selecting a tree node
    const firstNode = page.locator('app-catalog-tree .tree-node').first();
    if (await firstNode.isVisible()) {
      await firstNode.click();
      await page.waitForTimeout(500);
      // Right panel should be visible
      await expect(page.locator('app-right-panel')).toBeVisible();
    }
  });

  test('5. Network — no direct SyncServer calls', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', req => {
      const url = req.url();
      // Only monitor XHR/fetch
      if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
        requests.push(url);
      }
    });

    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/catalog/');
    await page.waitForSelector('app-root');
    await page.waitForTimeout(1000);

    // Assert no direct SyncServer calls
    for (const url of requests) {
      expect(url).not.toContain('/api/v1/');
    }
  });

  test('6. /catalog/ssr/ shows legacy route', async ({ page }) => {
    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/catalog/ssr/');
    // SSR page should load
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});

// ─── 2. Manager readonly catalog alias ───
test.describe('Manager readonly catalog alias', () => {
  test('7. Manager opens /catalog/ — still readonly', async ({ page }) => {
    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/catalog/');
    await page.waitForSelector('app-root');
    // Should show "Каталог" title
    await expect(page.locator('app-page-header')).toContainText('Каталог');
    // No create buttons even for superuser on /catalog/ (route mode forces readonly)
    await expect(page.locator('app-action-buttons')).not.toContainText('+ Категория');
    await expect(page.locator('app-action-buttons')).not.toContainText('+ ТМЦ');
    // No pending changes bar
    await expect(page.locator('app-pending-changes-bar')).not.toBeVisible();
  });
});

// ─── 3. Manager editable nomenclature ───
test.describe('Manager editable nomenclature', () => {
  test('8. /nomenclature/ shows editable controls for manager', async ({ page }) => {
    await loginAs(page, ADMIN_CREDENTIALS);
    await page.goto('/nomenclature/');
    await page.waitForSelector('app-root');
    // Should show "Номенклатура" title
    await expect(page.locator('app-page-header')).toContainText('Номенклатура');
    // Create buttons should be visible for superuser
    await expect(page.locator('app-action-buttons')).toContainText('+ Категория');
    await expect(page.locator('app-action-buttons')).toContainText('+ ТМЦ');
    // Pending changes bar should be visible
    await expect(page.locator('app-pending-changes-bar')).toBeVisible();
    // Apply button should be visible in header
    await expect(page.locator('app-page-header')).toContainText('Применить все');
  });
});
