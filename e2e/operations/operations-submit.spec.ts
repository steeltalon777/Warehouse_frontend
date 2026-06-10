import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId } from '../helpers/seed';

async function openCreateModal(page: Page) {
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
}

async function addFirstVisibleItemToDraft(page: Page, query: string, quantity: string): Promise<string> {
  const modal = page.locator('.modal-overlay');
  const search = modal.locator('input[placeholder*="Поиск ТМЦ для добавления"]');
  await search.fill('');
  await expect(search).toHaveValue('');
  await search.fill(query);

  const optionNames = modal.locator('.search-option .option-name');
  await expect(optionNames.first()).toBeVisible({ timeout: 5000 });
  const names = (await optionNames.allTextContents()).map(name => name.trim()).filter(Boolean);
  const itemName = names[0];
  if (!itemName) throw new Error('No item found for query: ' + query);

  const option = modal.locator('.search-option', { hasText: itemName }).first();
  await option.click();
  await expect(search).toHaveValue('');

  const row = modal.locator('tbody tr', { hasText: itemName }).first();
  await expect(row).toBeVisible();
  await row.locator('.qty-input').fill(quantity);
  return itemName;
}

async function createReceiveDraft(page: Page, siteName: string, itemQuery: string, qty: string): Promise<string> {
  await openCreateModal(page);
  await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
  await page.locator('.modal-overlay select').nth(1).selectOption(siteName);
  const itemName = await addFirstVisibleItemToDraft(page, itemQuery, qty);
  const comment = page.locator('.modal-overlay textarea');
  await comment.fill(`E2E submit test ${generateRunId()}`);
  const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
  await Promise.all([
    page.waitForResponse(response => response.url().includes('/bff/api/v1/operations') && response.request().method() === 'POST' && response.status() === 200),
    saveBtn.click(),
  ]);
  await page.locator('.modal-overlay .btn-close').click();
  await expect(page.locator('.modal-overlay')).not.toBeVisible();
  return itemName;
}

async function findDraftRow(page: Page, itemName: string): Promise<ReturnType<Page['locator']>> {
  await page.locator('[data-testid="operations-tab-drafts"]').click();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-testid="operations-loading-state"]')).toHaveCount(0);
  const row = page.locator('[data-testid="operation-row"]', { hasText: itemName });
  return row;
}

// TODO: Dev stand lacks storekeeper/chief/observer Django users. Skip role-specific tests until stand seed is updated.
const SKIP_ROLE_TESTS = true;

test.describe('OPS-SUBMIT-001..005 — Submit permissions', () => {
  test('OPS-SUBMIT-001: Storekeeper can submit own/allowed warehouse operation', async ({ page }) => {
    test.skip(SKIP_ROLE_TESTS, 'TODO: create storekeeper user on dev stand');
    installNetworkGuard(page);
    await loginAsRole(page, 'storekeeper');
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    const itemName = await createReceiveDraft(page, 'Base', 'Кабель', '3');
    const row = await findDraftRow(page, itemName);
    await expect(row).toBeVisible();

    const submitBtn = row.locator('[data-testid="operation-action-submit"]');
    await expect(submitBtn).toBeVisible();

    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations/') && response.request().method() === 'POST' && response.status() === 200),
      submitBtn.click(),
    ]);

    // After submit, status should change (row may disappear from drafts)
    await expect(page.locator('[data-testid="operation-row"]', { hasText: itemName })).toHaveCount(0);
  });

  test('OPS-SUBMIT-002: Storekeeper cannot submit another warehouse; UI shows rights error; status remains draft', async ({ page }) => {
    test.skip(SKIP_ROLE_TESTS, 'TODO: create storekeeper user on dev stand');
    installNetworkGuard(page);
    // Create a draft on a warehouse other than Base using root (who has access everywhere)
    await loginAsRole(page, 'root');
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    // Try to use 'Site 1' if available; otherwise skip
    const siteSelect = page.locator('.modal-overlay select').nth(1);
    const options = await siteSelect.locator('option').allTextContents();
    const otherSite = options.find(o => o !== 'Base' && o !== 'Все участки');
    if (!otherSite) {
      test.skip('No alternative warehouse available for cross-warehouse test');
      return;
    }

    const itemName = await createReceiveDraft(page, otherSite, 'Кабель', '2');
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    // Now login as storekeeper and try to submit
    await loginAsRole(page, 'storekeeper');
    await page.goto('/operations/', { waitUntil: 'networkidle' });
    const row = await findDraftRow(page, itemName);
    await expect(row).toBeVisible();

    const submitBtn = row.locator('[data-testid="operation-action-submit"]');
    // If button is hidden/disabled, that is acceptable UI behavior
    const isVisible = await submitBtn.isVisible().catch(() => false);
    if (isVisible) {
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/bff/api/v1/operations/') && response.request().method() === 'POST' && (response.status() === 200 || response.status() === 403)),
        submitBtn.click(),
      ]);
      // Status should remain draft (row still in drafts tab)
      await page.goto('/operations/', { waitUntil: 'networkidle' });
      const rowAfter = await findDraftRow(page, itemName);
      await expect(rowAfter).toBeVisible();
      await expect(rowAfter.locator('[data-testid="operation-status-cell"]')).toContainText('Черновик');
    } else {
      // Button hidden = rights enforced via UI
      test.info().annotations.push({ type: 'note', description: 'Submit button hidden for non-allowed warehouse' });
    }
  });

  test('OPS-SUBMIT-003: Chief can submit allowed operation across warehouses', async ({ page }) => {
    test.skip(SKIP_ROLE_TESTS, 'TODO: create chief user on dev stand');
    installNetworkGuard(page);
    await loginAsRole(page, 'chief');
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    const itemName = await createReceiveDraft(page, 'Base', 'Кабель', '4');
    const row = await findDraftRow(page, itemName);
    await expect(row).toBeVisible();

    const submitBtn = row.locator('[data-testid="operation-action-submit"]');
    await expect(submitBtn).toBeVisible();

    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations/') && response.request().method() === 'POST' && response.status() === 200),
      submitBtn.click(),
    ]);

    await page.goto('/operations/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="operation-row"]', { hasText: itemName })).toHaveCount(0);
  });

  test('OPS-SUBMIT-004: Root can submit operation across warehouses', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'root');
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    const itemName = await createReceiveDraft(page, 'Base', 'Кабель', '1');
    const row = await findDraftRow(page, itemName);
    await expect(row).toBeVisible();

    const submitBtn = row.locator('[data-testid="operation-action-submit"]');
    await expect(submitBtn).toBeVisible();

    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations/') && response.request().method() === 'POST' && response.status() === 200),
      submitBtn.click(),
    ]);

    await page.goto('/operations/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="operation-row"]', { hasText: itemName })).toHaveCount(0);
  });

  test('OPS-SUBMIT-005: Observer cannot submit; button hidden/disabled and direct BFF attempt is rejected', async ({ page }) => {
    test.skip(SKIP_ROLE_TESTS, 'TODO: create observer user on dev stand');
    installNetworkGuard(page);
    // First, create a draft as root so we have a target
    await loginAsRole(page, 'root');
    await page.goto('/operations/', { waitUntil: 'networkidle' });
    const itemName = await createReceiveDraft(page, 'Base', 'Кабель', '2');

    // Now login as observer
    await loginAsRole(page, 'observer');
    await page.goto('/operations/', { waitUntil: 'networkidle' });
    const row = await findDraftRow(page, itemName);
    await expect(row).toBeVisible();

    const submitBtn = row.locator('[data-testid="operation-action-submit"]');
    const isVisible = await submitBtn.isVisible().catch(() => false);
    if (isVisible) {
      // If visible, click should be rejected
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/bff/api/v1/operations/') && response.request().method() === 'POST' && (response.status() === 403 || response.status() === 401)),
        submitBtn.click(),
      ]);
    } else {
      // Button hidden = correct UI behavior
      test.info().annotations.push({ type: 'note', description: 'Submit button hidden for observer' });
    }

    // Verify row still draft
    await expect(row.locator('[data-testid="operation-status-cell"]')).toContainText('Черновик');
  });
});
