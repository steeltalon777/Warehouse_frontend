import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

async function openCreateModal(page: Page) {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
}

test.describe('Operation Create Modal — Line Numbers and Total Header', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('line numbers are assigned sequentially (1, 2, 3) when adding items', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');

    // Add first item
    await search.fill('Кабель');
    await page.locator('.modal-overlay .search-option').first().click();
    await expect(page.locator('.modal-overlay tbody tr .col-num').first()).toHaveText('1');

    // Add second item
    await search.fill('Солярка');
    await page.locator('.modal-overlay .search-option').first().click();
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(1)).toHaveText('2');

    // Add third item
    await search.fill('БФ');
    await page.locator('.modal-overlay .search-option').first().click();
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(2)).toHaveText('3');
  });

  test('line numbers renumber after removal', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');

    // Add 3 items
    await search.fill('Кабель');
    await page.locator('.modal-overlay .search-option').first().click();

    await search.fill('Солярка');
    await page.locator('.modal-overlay .search-option').first().click();

    await search.fill('БФ');
    await page.locator('.modal-overlay .search-option').first().click();

    // Verify initial numbers
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(0)).toHaveText('1');
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(1)).toHaveText('2');
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(2)).toHaveText('3');

    // Remove the second row
    await page.locator('.modal-overlay tbody tr').nth(1).locator('.remove-btn').click();

    // Verify renumbering: 1, 2
    const rows = page.locator('.modal-overlay tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.col-num')).toHaveText('1');
    await expect(rows.nth(1).locator('.col-num')).toHaveText('2');
  });

  test('line numbers persist after save and reopen', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');

    // Add 2 items
    await search.fill('Кабель');
    await page.locator('.modal-overlay .search-option').first().click();
    await search.fill('Солярка');
    await page.locator('.modal-overlay .search-option').first().click();

    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(0)).toHaveText('1');
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(1)).toHaveText('2');

    // Save draft
    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations') && response.request().method() === 'POST' && response.status() === 200),
      saveBtn.click(),
    ]);

    // Reopen
    await page.locator('.modal-overlay .btn-close').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await page.locator('tbody tr').filter({ hasText: 'Черновик' }).first().locator('button.number-link').click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // Verify numbers preserved
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(0)).toHaveText('1');
    await expect(page.locator('.modal-overlay tbody tr .col-num').nth(1)).toHaveText('2');
  });
});
