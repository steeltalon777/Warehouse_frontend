import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

async function openCreateModal(page: Page) {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
}

test.describe('Operation Create Modal — Total Header', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('header shows Позиции: 0, Всего: 0 when empty', async ({ page }) => {
    await openCreateModal(page);

    const header = page.locator('.modal-overlay .section-header h3');
    await expect(header).toHaveText('Позиции: 0, Всего: 0');
  });

  test('header updates when adding items with quantity', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');
    const header = page.locator('.modal-overlay .section-header h3');

    // Add first item with quantity 5
    await search.fill('Кабель');
    await page.locator('.modal-overlay .search-option').first().click();
    await page.locator('.modal-overlay tbody tr').first().locator('.qty-input').fill('5');
    // Header should show 1 item, total 5
    await expect(header).toHaveText('Позиции: 1, Всего: 5');

    // Add second item with quantity 3
    await search.fill('БФ');
    await page.locator('.modal-overlay .search-option').first().click();
    await page.locator('.modal-overlay tbody tr').nth(1).locator('.qty-input').fill('3');
    // Header should show 2 items, total 8
    await expect(header).toHaveText('Позиции: 2, Всего: 8');
  });

  test('total updates when quantity changes', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');
    const header = page.locator('.modal-overlay .section-header h3');

    // Add item
    await search.fill('Кабель');
    await page.locator('.modal-overlay .search-option').first().click();
    await page.locator('.modal-overlay tbody tr').first().locator('.qty-input').fill('10');

    // Change quantity to 7
    await page.locator('.modal-overlay tbody tr').first().locator('.qty-input').fill('7');
    await expect(header).toHaveText('Позиции: 1, Всего: 7');
  });

  test('total updates after removing an item', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');
    const header = page.locator('.modal-overlay .section-header h3');

    // Add 2 items with quantities
    await search.fill('Кабель');
    await page.locator('.modal-overlay .search-option').first().click();
    await page.locator('.modal-overlay tbody tr').first().locator('.qty-input').fill('10');

    await search.fill('БФ');
    await page.locator('.modal-overlay .search-option').first().click();
    await page.locator('.modal-overlay tbody tr').nth(1).locator('.qty-input').fill('5');

    await expect(header).toHaveText('Позиции: 2, Всего: 15');

    // Remove first item
    await page.locator('.modal-overlay tbody tr').first().locator('.remove-btn').click();

    // Should be 1 item, total 5
    await expect(header).toHaveText('Позиции: 1, Всего: 5');
  });
});
