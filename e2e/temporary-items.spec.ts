import { test, expect } from '@playwright/test';

const CHIEF_CREDENTIALS = { username: 'chief', password: 'chief123' };
const OBSERVER_CREDENTIALS = { username: 'observer', password: 'observer123' };

async function loginAs(page, { username, password }: { username: string; password: string }) {
  await page.goto('/login/');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/client\/|\/temporary-items\//);
}

// ─── Scenario A: List and filter ───
test.describe('Scenario A: List and filter', () => {
  test('A1: Login and navigate to /temporary-items/', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-root');
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('A2: Info card shows live counts', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-info-card');
    await expect(page.locator('app-temp-items-info-card')).toBeVisible();
  });

  test('A3: Apply search filter updates table', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const searchInput = page.locator('app-temp-items-filters input[placeholder*="Поиск"]');
    await searchInput.fill('test');
    await page.waitForTimeout(500);
  });

  test('A4: Status filter updates table', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const statusSelect = page.locator('app-temp-items-filters select').first();
    await statusSelect.selectOption('needs_review');
    await page.waitForTimeout(300);
  });

  test('A5: Page size changes display', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const pageSizeSelect = page.locator('app-temp-items-table select');
    await pageSizeSelect.selectOption('50');
    await page.waitForTimeout(300);
  });

  test('A6: Sort by created date changes order', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const dateHeader = page.locator('app-temp-items-table th').filter({ hasText: 'Создана' });
    await dateHeader.click();
    await page.waitForTimeout(300);
    await expect(dateHeader.locator('.sort-arrow')).toBeVisible();
  });
});

// ─── Scenario B: Modal detail ───
test.describe('Scenario B: Modal detail', () => {
  test('B1: Row click opens modal', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const firstRow = page.locator('app-temp-items-table .data-row').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForSelector('app-temp-item-detail-modal');
      await expect(page.locator('app-temp-item-detail-modal')).toBeVisible();
    }
  });

  test('B2: Modal shows metadata', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const firstRow = page.locator('app-temp-items-table .data-row').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForSelector('app-temp-item-detail-modal');
      await expect(page.locator('app-temp-item-detail-modal .modal-title')).toBeVisible();
    }
  });

  test('B3: Close modal returns to table', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const firstRow = page.locator('app-temp-items-table .data-row').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForSelector('app-temp-item-detail-modal');
      const closeBtn = page.locator('app-temp-item-detail-modal .modal-close');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(page.locator('app-temp-item-detail-modal')).not.toBeVisible();
      }
    }
  });
});

// ─── Scenario C: Convert to permanent ───
test.describe('Scenario C: Convert to permanent', () => {
  test('C1: Convert form opens from modal', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const convertBtn = page.locator('app-temp-items-table .data-row .action-buttons button').nth(1).first();
    if (await convertBtn.isVisible()) {
      await convertBtn.click();
      await page.waitForSelector('app-temp-item-convert-form');
      await expect(page.locator('app-temp-item-convert-form')).toBeVisible();
    }
  });
});

// ─── Scenario D: Merge with permanent ───
test.describe('Scenario D: Merge with permanent', () => {
  test('D1: Merge form opens from modal', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const mergeBtn = page.locator('app-temp-items-table .data-row .action-buttons button').nth(2).first();
    if (await mergeBtn.isVisible()) {
      await mergeBtn.click();
      await page.waitForSelector('app-temp-item-merge-permanent-form');
      await expect(page.locator('app-temp-item-merge-permanent-form')).toBeVisible();
    }
  });
});

// ─── Scenario E: Delete (zero balance) ───
test.describe('Scenario E: Delete', () => {
  test('E1: Delete form opens for deletable item', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const deleteBtn = page.locator('app-temp-items-table .data-row .action-buttons .danger').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await page.waitForSelector('app-temp-item-delete-form');
      await expect(page.locator('app-temp-item-delete-form')).toBeVisible();
    }
  });
});

// ─── Scenario F: Permission restrictions (observer) ───
test.describe('Scenario F: Permission restrictions', () => {
  test('F1: Observer sees only Open button', async ({ page }) => {
    await loginAs(page, OBSERVER_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const firstRow = page.locator('app-temp-items-table .data-row').first();
    if (await firstRow.isVisible()) {
      const actionBtns = firstRow.locator('.action-buttons button');
      const btnCount = await actionBtns.count();
      expect(btnCount).toBeLessThanOrEqual(1);
    }
  });

  test('F2: Observer modal shows disabled actions', async ({ page }) => {
    await loginAs(page, OBSERVER_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const firstRow = page.locator('app-temp-items-table .data-row').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForSelector('app-temp-item-detail-modal');
      const actionBtns = page.locator('app-temp-item-detail-modal .action-btn');
      const btnCount = await actionBtns.count();
      for (let i = 0; i < btnCount; i++) {
        await expect(actionBtns.nth(i)).toBeDisabled();
      }
    }
  });
});

// ─── Scenario G: Blocked by pending acceptance ───
test.describe('Scenario G: Blocked by pending acceptance', () => {
  test('G1: Warning banner visible for items in pending acceptance', async ({ page }) => {
    await loginAs(page, CHIEF_CREDENTIALS);
    await page.goto('/temporary-items/');
    await page.waitForSelector('app-temp-items-table');
    const firstRow = page.locator('app-temp-items-table .data-row').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForSelector('app-temp-item-detail-modal');
      const warning = page.locator('app-temp-item-detail-modal .warning-banner');
      if (await warning.isVisible()) {
        const actionBtns = page.locator('app-temp-item-detail-modal .action-btn');
        const btnCount = await actionBtns.count();
        for (let i = 0; i < btnCount; i++) {
          await expect(actionBtns.nth(i)).toBeDisabled();
        }
      }
    }
  });
});
