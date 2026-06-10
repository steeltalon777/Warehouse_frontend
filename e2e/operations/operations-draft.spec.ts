import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId } from '../helpers/seed';

async function openCreateModal(page: Page) {
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
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

async function addFirstVisibleItemToDraft(page: Page, query: string, quantity: string): Promise<string> {
  const usedNames = new Set<string>();
  const name = await addVisibleItemToDraft(page, query, quantity, usedNames);
  if (!name) throw new Error('No item found for query: ' + query);
  return name;
}

test.describe('OPS-DRAFT-001..004 — Draft and submit', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await page.goto('/operations/', { waitUntil: 'networkidle' });
  });

  test('OPS-DRAFT-001: Create RECEIVE draft; status is draft; appears in drafts tab', async ({ page }) => {
    await openCreateModal(page);

    // Set type RECEIVE and warehouse Base
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const itemName = await addFirstVisibleItemToDraft(page, 'Кабель', '5');

    const comment = page.locator('.modal-overlay textarea');
    await comment.fill(`E2E draft ${generateRunId()}`);

    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
    await expect(saveBtn).toBeEnabled();

    const savePromise = Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations') && response.request().method() === 'POST' && response.status() === 200),
      saveBtn.click(),
    ]);
    await savePromise;

    // Close modal
    await page.locator('.modal-overlay .btn-close').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Switch to drafts tab
    await page.locator('[data-testid="operations-tab-drafts"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="operations-loading-state"]')).toHaveCount(0);

    // Draft should appear in the list
    const draftRow = page.locator('[data-testid="operation-row"]', { hasText: itemName });
    await expect(draftRow).toBeVisible({ timeout: 5000 });
    await expect(draftRow.locator('[data-testid="operation-status-cell"]')).toContainText('Черновик');
  });

  test('OPS-DRAFT-002: Create MOVE draft with source/destination; same-source-destination validation is enforced', async ({ page }) => {
    await openCreateModal(page);

    // Default is MOVE
    await expect(page.locator('.modal-overlay label:has-text("Склад-источник")')).toBeVisible();
    await expect(page.locator('.modal-overlay label:has-text("Склад-получатель")')).toBeVisible();

    // Select same source and destination
    const selects = page.locator('.modal-overlay select');
    await expect(selects).toHaveCount(3);
    await selects.nth(1).selectOption('Base');
    await selects.nth(2).selectOption('Base');

    const itemName = await addFirstVisibleItemToDraft(page, 'Кабель', '3');

    // Save should be disabled or validation should show because same source/destination
    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
    // Depending on implementation, the button may be disabled or a validation hint is shown
    const isDisabled = await saveBtn.isDisabled().catch(() => false);
    if (!isDisabled) {
      // If button is not disabled, there should be a validation hint
      await expect(page.locator('.modal-overlay .validation-hint')).toBeVisible();
    }

    // Fix by changing destination
    await selects.nth(2).selectOption('Site 1');
    await page.waitForTimeout(300);

    await expect(saveBtn).toBeEnabled();
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations') && response.request().method() === 'POST' && response.status() === 200),
      saveBtn.click(),
    ]);

    // Close modal and verify in drafts
    await page.locator('.modal-overlay .btn-close').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    await page.locator('[data-testid="operations-tab-drafts"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="operation-row"]', { hasText: itemName })).toBeVisible({ timeout: 5000 });
  });

  test('OPS-DRAFT-003: Edit own draft line quantity/comment; invalid quantities block submit', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');
    const itemName = await addFirstVisibleItemToDraft(page, 'Кабель', '5');

    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations') && response.request().method() === 'POST' && response.status() === 200),
      saveBtn.click(),
    ]);

    // Close modal
    await page.locator('.modal-overlay .btn-close').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();

    // Open the draft from the list
    await page.locator('[data-testid="operations-tab-drafts"]').click();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="operation-row"]', { hasText: itemName }).first().locator('button.number-link').click();
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // Edit quantity to invalid value
    const qtyInput = page.locator('.modal-overlay .qty-input').first();
    await qtyInput.fill('-1');
    await page.waitForTimeout(300);

    const confirmBtn = page.locator('.modal-overlay button:has-text("Подтвердить")');
    // Invalid quantity should block submit
    await expect(confirmBtn).toBeDisabled();

    // Fix quantity
    await qtyInput.fill('10');
    await page.waitForTimeout(300);
    await expect(confirmBtn).toBeEnabled();

    // Edit comment
    const comment = page.locator('.modal-overlay textarea');
    await comment.fill(`Updated comment ${generateRunId()}`);

    // Save updated draft
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations/') && response.request().method() === 'PATCH' && response.status() === 200),
      saveBtn.click(),
    ]);
  });

  test('OPS-DRAFT-004: Empty draft cannot be submitted', async ({ page }) => {
    await openCreateModal(page);
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption('Base');

    const confirmBtn = page.locator('.modal-overlay button:has-text("Подтвердить")');
    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');

    // No items added
    await expect(confirmBtn).toBeDisabled();
    await expect(saveBtn).toBeDisabled();

    // Validation hint should mention empty lines
    await expect(page.locator('.modal-overlay .validation-hint')).toContainText('Добавьте минимум одну позицию');
  });
});
