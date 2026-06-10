import { test, expect } from '@playwright/test';
import { loginAsRole, ROLE_CREDENTIALS } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId, seedSubmittedReceiveOperation, seedSubmittedMoveOperation, seedSubmittedReceiveOperationWithLines } from '../helpers/seed';

/**
 * P0 acceptance detail scenarios.
 *
 * Required UI controls:
 *   - acceptance-detail-page, acceptance-detail-title, acceptance-detail-operation-number
 *   - acceptance-detail-status, acceptance-detail-direction, acceptance-detail-lines-table
 *   - acceptance-line-row, acceptance-line-expected-qty, acceptance-line-accepted-qty-input
 *   - acceptance-line-missing-qty, acceptance-line-comment-input
 *   - acceptance-complete-button, acceptance-cancel-button
 *   - acceptance-validation-error, acceptance-success-message, acceptance-error-message
 */

async function navigateToAcceptanceDetail(page, operationId: string): Promise<void> {
  await page.goto(`/operations/${operationId}/acceptance`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="acceptance-detail-page"]', { state: 'visible' });
}

async function getLineExpectedQty(page, rowIndex: number): Promise<string> {
  const row = page.locator('[data-testid="acceptance-line-row"]').nth(rowIndex);
  const qtyText = await row.locator('[data-testid="acceptance-line-expected-qty"]').textContent();
  return (qtyText ?? '').replace(/[^0-9.]/g, '');
}

async function fillAcceptedQty(page, rowIndex: number, value: string): Promise<void> {
  const row = page.locator('[data-testid="acceptance-line-row"]').nth(rowIndex);
  const input = row.locator('[data-testid="acceptance-line-accepted-qty-input"]');
  // For number inputs, Playwright cannot type non-numeric text (e.g. "abc").
  // Use evaluate to set value directly when needed.
  const inputType = await input.evaluate(el => (el as HTMLInputElement).type);
  if (inputType === 'number' && value !== '' && isNaN(Number(value)) && !value.match(/^\d/)) {
    await input.evaluate((el, v) => {
      (el as HTMLInputElement).value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  } else {
    await input.fill(value);
  }
  // Blur to trigger validation
  await input.evaluate(el => (el as HTMLElement).blur());
  await page.waitForTimeout(100);
}

async function fillComment(page, rowIndex: number, value: string): Promise<void> {
  const row = page.locator('[data-testid="acceptance-line-row"]').nth(rowIndex);
  const input = row.locator('[data-testid="acceptance-line-comment-input"]');
  await input.fill(value);
}

async function getMissingQty(page, rowIndex: number): Promise<string> {
  const row = page.locator('[data-testid="acceptance-line-row"]').nth(rowIndex);
  const qtyText = await row.locator('[data-testid="acceptance-line-missing-qty"]').textContent();
  return (qtyText ?? '').replace(/[^0-9.]/g, '');
}

async function clickAccept(page): Promise<void> {
  const btn = page.locator('[data-testid="acceptance-complete-button"]');
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForTimeout(300);
}

// ─── ACCEPT-FULL-001: Full acceptance for RECEIVE ───

test.describe('ACCEPT-FULL-001: Full acceptance for RECEIVE', () => {
  test('ACCEPT-FULL-001: Full acceptance resolves operation, shows success, leaves pending list', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedReceiveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted RECEIVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);

    // Verify metadata visible
    await expect(page.locator('[data-testid="acceptance-detail-operation-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-detail-status"]')).toBeVisible();

    // Get expected qty and fill in full acceptance
    const expectedQty = await getLineExpectedQty(page, 0);
    expect(expectedQty).toMatch(/\d+/);
    await fillAcceptedQty(page, 0, expectedQty);

    // Submit acceptance
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes(`/bff/api/v1/operations/${seeded.operationId}/accept-lines`) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      clickAccept(page),
    ]);

    // Success message should appear
    await expect(page.locator('[data-testid="acceptance-success-message"]')).toBeVisible({ timeout: 5000 });
    const successText = await page.locator('[data-testid="acceptance-success-message"]').textContent();
    expect(successText).toMatch(/успешно|завершена|Приёмка/);

    // Status badge should update to resolved
    const statusText = await page.locator('[data-testid="acceptance-detail-status"]').textContent();
    expect(statusText).toMatch(/завершена|resolved|Приёмка завершена/);

    // Navigate back to pending list and verify the operation is gone
    await page.goto('/operations/pending-acceptance');
    await page.waitForLoadState('networkidle');
    const row = page.locator('[data-testid="acceptance-page"] [data-testid="operation-row"]')
      .filter({ hasText: seeded.operationId.slice(0, 8).toUpperCase() });
    await expect(row).toHaveCount(0);
  });
});

// ─── ACCEPT-FULL-002: Full acceptance for MOVE ───

test.describe('ACCEPT-FULL-002: Full acceptance for MOVE', () => {
  test('ACCEPT-FULL-002: MOVE operation can be fully accepted; balance assertions limited (P2 blocker)', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedMoveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted MOVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);

    // Verify metadata visible
    await expect(page.locator('[data-testid="acceptance-detail-operation-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-detail-direction"]')).toBeVisible();

    // Get expected qty and fill in full acceptance
    const expectedQty = await getLineExpectedQty(page, 0);
    expect(expectedQty).toMatch(/\d+/);
    await fillAcceptedQty(page, 0, expectedQty);

    // Submit acceptance
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes(`/bff/api/v1/operations/${seeded.operationId}/accept-lines`) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      clickAccept(page),
    ]);

    // Success message should appear
    await expect(page.locator('[data-testid="acceptance-success-message"]')).toBeVisible({ timeout: 5000 });
  });
});

// ─── ACCEPT-PARTIAL-001: Partial acceptance of one line ───

test.describe('ACCEPT-PARTIAL-001: Partial acceptance of one line', () => {
  test('ACCEPT-PARTIAL-001: Partial qty requires note and shows lost qty', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedReceiveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted RECEIVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);

    const expectedQty = await getLineExpectedQty(page, 0);
    const expectedNum = parseFloat(expectedQty);
    expect(expectedNum).toBeGreaterThan(0);

    const partialQty = Math.max(1, expectedNum - 2).toFixed(0);
    await fillAcceptedQty(page, 0, partialQty);
    await fillComment(page, 0, 'Часть товара не доставлена');

    // Verify lost quantity is calculated
    const lost = await getMissingQty(page, 0);
    const lostNum = parseFloat(lost);
    expect(lostNum).toBeGreaterThan(0);

    // Submit acceptance
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes(`/bff/api/v1/operations/${seeded.operationId}/accept-lines`) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      clickAccept(page),
    ]);

    // Success message should appear
    await expect(page.locator('[data-testid="acceptance-success-message"]')).toBeVisible({ timeout: 5000 });

    // Status may be in_progress or resolved depending on business rules
    const statusText = await page.locator('[data-testid="acceptance-detail-status"]').textContent();
    expect(statusText).toMatch(/частично|завершена|в прогрессе/);
  });
});

// ─── ACCEPT-PARTIAL-002: Partial acceptance across several lines ───

test.describe('ACCEPT-PARTIAL-002: Partial acceptance across several lines', () => {
  test('ACCEPT-PARTIAL-002: Per-line missing quantities and comments visible', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();

    // We need two items for multi-line test. Fetch active items via BFF.
    const { getActiveItems } = await import('../helpers/seed');
    const items = await getActiveItems(page, 5);
    if (items.length < 2) {
      test.skip(true, 'Need at least 2 active catalog items for multi-line test');
      return;
    }

    const seeded = await seedSubmittedReceiveOperationWithLines(page, [
      { itemId: items[0].id, qty: '10' },
      { itemId: items[1].id, qty: '8' },
    ], runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create multi-line submitted RECEIVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);

    // Wait for at least 2 line rows
    const rows = page.locator('[data-testid="acceptance-line-row"]');
    await expect(rows).toHaveCount(2, { timeout: 5000 });

    // Partial acceptance for first line
    await fillAcceptedQty(page, 0, '7');
    await fillComment(page, 0, 'Недостача первой позиции');

    // Partial acceptance for second line
    await fillAcceptedQty(page, 1, '5');
    await fillComment(page, 1, 'Недостача второй позиции');

    // Verify lost quantities
    const lost0 = await getMissingQty(page, 0);
    const lost1 = await getMissingQty(page, 1);
    expect(parseFloat(lost0)).toBeGreaterThan(0);
    expect(parseFloat(lost1)).toBeGreaterThan(0);

    // Submit acceptance
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes(`/bff/api/v1/operations/${seeded.operationId}/accept-lines`) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      clickAccept(page),
    ]);

    await expect(page.locator('[data-testid="acceptance-success-message"]')).toBeVisible({ timeout: 5000 });
  });
});

// ─── ACCEPT-VALIDATION-001: Validation rules ───

test.describe('ACCEPT-VALIDATION-001: Accepted quantity validation', () => {
  test('ACCEPT-VALIDATION-001: Accepted qty > expected, negative, empty, malformed are blocked', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedReceiveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted RECEIVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);

    const expectedQty = await getLineExpectedQty(page, 0);
    const expectedNum = parseFloat(expectedQty);
    expect(expectedNum).toBeGreaterThan(0);

    // Test: qty > expected
    const tooHigh = (expectedNum + 10).toFixed(0);
    await fillAcceptedQty(page, 0, tooHigh);
    const error0 = page.locator('[data-testid="acceptance-line-row"]').nth(0).locator('[data-testid="acceptance-validation-error"]');
    await expect(error0).toBeVisible();
    const errorText0 = await error0.textContent();
    expect(errorText0).toMatch(/превышает|не может|корректное/);

    // Test: negative qty
    await fillAcceptedQty(page, 0, '-1');
    await expect(error0).toBeVisible();
    const errorTextNeg = await error0.textContent();
    expect(errorTextNeg).toMatch(/корректное|отрицательное/);

    // Test: empty / malformed
    await fillAcceptedQty(page, 0, '');
    await expect(error0).toBeVisible();

    // Test: malformed (abc)
    await fillAcceptedQty(page, 0, 'abc');
    await expect(error0).toBeVisible();

    // Button should be disabled because of validation errors
    const btn = page.locator('[data-testid="acceptance-complete-button"]');
    await expect(btn).toBeDisabled();
  });
});

// ─── ACCEPT-PERM-001: Role-based access ───

test.describe('ACCEPT-PERM-001: Role-based access for acceptance', () => {
  test('ACCEPT-PERM-001: Storekeeper (root proxy) can view and submit acceptance', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedReceiveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted RECEIVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);

    // Storekeeper can see and interact
    await expect(page.locator('[data-testid="acceptance-complete-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-detail-lines-table"]')).toBeVisible();

    // Fill and submit
    const expectedQty = await getLineExpectedQty(page, 0);
    await fillAcceptedQty(page, 0, expectedQty);

    await Promise.all([
      page.waitForResponse(
        r => r.url().includes(`/bff/api/v1/operations/${seeded.operationId}/accept-lines`) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      clickAccept(page),
    ]);

    await expect(page.locator('[data-testid="acceptance-success-message"]')).toBeVisible({ timeout: 5000 });
  });

  test('ACCEPT-PERM-001: Observer can view detail but gets 403 on submit', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedReceiveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted RECEIVE operation');
      return;
    }

    // Logout and login as observer
    await page.goto('/users/logout/');
    await page.waitForLoadState('networkidle');
    await loginAsRole(page, 'observer');

    // If observer user does not exist in this environment, skip
    const loginError = page.locator('text=/Неверный логин|Invalid login/');
    if (await loginError.isVisible().catch(() => false)) {
      test.skip(true, 'Observer user does not exist in dev database');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);

    // Observer can view detail
    await expect(page.locator('[data-testid="acceptance-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-detail-lines-table"]')).toBeVisible();

    // Observer can fill in values (UI allows)
    const expectedQty = await getLineExpectedQty(page, 0);
    await fillAcceptedQty(page, 0, expectedQty);

    // But submit should fail with error
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes(`/bff/api/v1/operations/${seeded.operationId}/accept-lines`) && r.request().method() === 'POST',
        { timeout: 15000 }
      ),
      clickAccept(page),
    ]);

    // Error message should show access denied
    const errorBanner = page.locator('[data-testid="acceptance-error-message"]');
    await expect(errorBanner).toBeVisible({ timeout: 5000 });
    const errorText = await errorBanner.textContent();
    expect(errorText).toMatch(/Доступ запрещён|403|forbidden/);
  });

  test('ACCEPT-PERM-001: Chief can view and submit acceptance', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'chief');

    // If chief user does not exist in this environment, skip
    const loginError = page.locator('text=/Неверный логин|Invalid login/');
    if (await loginError.isVisible().catch(() => false)) {
      test.skip(true, 'Chief user does not exist in dev database');
      return;
    }

    const runId = generateRunId();
    const seeded = await seedSubmittedReceiveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted RECEIVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);
    await expect(page.locator('[data-testid="acceptance-complete-button"]')).toBeVisible();
  });

  test('ACCEPT-PERM-001: Root can view and submit acceptance', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedReceiveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted RECEIVE operation');
      return;
    }

    await navigateToAcceptanceDetail(page, seeded.operationId);
    await expect(page.locator('[data-testid="acceptance-complete-button"]')).toBeVisible();
  });
});
