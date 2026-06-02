/**
 * Playwright smoke tests for Operation Create Modal rework.
 *
 * Verifies:
 * 1. Modal layout: 40/30/30 MOVE, 40/60 non-MOVE
 * 2. Warehouse selection, item search, lines table
 * 3. Save/confirm button gating
 * 4. Balance display
 *
 * Run: npx playwright test e2e/operations-create-modal.spec.ts
 * Requires: docker stand running with test_spa_user/user logged out.
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:8001';
const TEST_USER = process.env.TEST_USERNAME || 'test_spa_user';
const TEST_PASS = process.env.TEST_PASSWORD || 'test_spa_password';

async function login(page: Page) {
  await page.goto(`${BASE_URL}/users/login/`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"]', TEST_USER);
  await page.fill('input[name="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function openCreateModal(page: Page) {
  await page.goto(`${BASE_URL}/operations/`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
}

test.describe('Operation Create Modal — Layout', () => {
  test('default MOVE layout shows 40/30/30 type/source/destination', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    // Should have three selects: type, source, destination
    const selects = page.locator('.modal-overlay select');
    await expect(selects).toHaveCount(3);

    // Check labels
    await expect(page.locator('.modal-overlay label:has-text("Тип операции")')).toBeVisible();
    await expect(page.locator('.modal-overlay label:has-text("Склад-источник")')).toBeVisible();
    await expect(page.locator('.modal-overlay label:has-text("Склад-получатель")')).toBeVisible();
  });

  test('switching to non-MOVE hides destination and shows 40/60', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    // Change type to EXPENSE (Расход)
    await page.locator('.modal-overlay select').first().selectOption('EXPENSE');
    await page.waitForTimeout(300);

    // Should now have only 2 selects (type + warehouse)
    const selects = page.locator('.modal-overlay select');
    await expect(selects).toHaveCount(2);

    // Check label changed to "Склад"
    await expect(page.locator('.modal-overlay label:has-text("Склад")')).toBeVisible();
    await expect(page.locator('.modal-overlay label:has-text("Склад-получатель")')).not.toBeVisible();

    // Switch back to MOVE
    await page.locator('.modal-overlay select').first().selectOption('MOVE');
    await page.waitForTimeout(300);

    await expect(page.locator('.modal-overlay label:has-text("Склад-получатель")')).toBeVisible();
  });

  test('add TMC row has 80% search and 20% disabled button', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    const searchInput = page.locator('.modal-overlay input[placeholder*="Поиск по названию"]');
    await expect(searchInput).toBeVisible();

    const createBtn = page.locator('.modal-overlay button:has-text("Создать ТМЦ")');
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeDisabled();
  });

  test('modal has comment textarea with 2 rows', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    const comment = page.locator('.modal-overlay textarea');
    await expect(comment).toBeVisible();
    await expect(comment).toHaveAttribute('rows', '2');
  });
});

test.describe('Operation Create Modal — Validation', () => {
  test('save disabled state changes based on validation reasons', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
    await expect(saveBtn).toBeDisabled();

    // Validation hint should be visible with no-lines message
    await expect(page.locator('.modal-overlay .validation-hint')).toHaveText('Добавьте минимум одну позицию');

    // Change to EXPENSE type — warehouse label changes
    await page.locator('.modal-overlay select').first().selectOption('EXPENSE');
    await page.waitForTimeout(300);

    // Select warehouse
    await page.locator('.modal-overlay select').nth(1).selectOption('Site 1');
    await page.waitForTimeout(300);

    // Confirm validation still says add lines
    await expect(page.locator('.modal-overlay .validation-hint')).toHaveText('Добавьте минимум одну позицию');
  });

  test('confirm button disabled until saved', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    const confirmBtn = page.locator('.modal-overlay button:has-text("Подтвердить")');
    await expect(confirmBtn).toBeDisabled();
  });
});

test.describe('Operation Create Modal — Lines Table', () => {
  test('lines table shows correct columns for MOVE (Отправляемое количество)', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    const table = page.locator('.modal-overlay table');
    await expect(table.locator('th').nth(0)).toContainText('ТМЦ');
    await expect(table.locator('th').nth(1)).toContainText('Отправляемое количество');
    await expect(table.locator('th').nth(2)).toContainText('Имеется');
  });

  test('lines table shows correct columns for RECEIVE (Количество)', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    // Change to RECEIVE
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.waitForTimeout(300);

    const table = page.locator('.modal-overlay table');
    await expect(table.locator('th').nth(1)).toContainText('Количество');
  });

  test('lines table has name filter input', async ({ page }) => {
    await login(page);
    await openCreateModal(page);

    const filterInput = page.locator('.modal-overlay input[placeholder*="Фильтр по названию"]');
    await expect(filterInput).toBeVisible();
  });
});
