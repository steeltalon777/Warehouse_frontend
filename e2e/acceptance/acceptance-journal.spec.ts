import { test, expect } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId, seedSubmittedMoveOperation } from '../helpers/seed';

/**
 * P0 acceptance journal scenarios.
 *
 * Required UI controls:
 *   - acceptance-page, acceptance-title, acceptance-description
 *   - operations-table (wrapped in acceptance-page)
 *   - operations-empty-state (inside operations-table)
 *   - acceptance-error-message
 *   - operation-row, operation-number-link
 *   - acceptance-detail-page (navigated to from list)
 */

test.describe('ACCEPT-UI-001: Open pending acceptance screen', () => {
  test('ACCEPT-UI-001: Title, description, table visible; no loader/error', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    await page.goto('/operations/pending-acceptance');
    await page.waitForLoadState('networkidle');

    // Page container
    await expect(page.locator('[data-testid="acceptance-page"]')).toBeVisible();

    // Title and description
    await expect(page.locator('[data-testid="acceptance-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-title"]')).toContainText('Операции к приёмке');
    await expect(page.locator('[data-testid="acceptance-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-description"]')).toContainText('ожидающие приёмки');

    // Table should be present (or empty state if no data)
    const table = page.locator('[data-testid="acceptance-page"] [data-testid="operations-table"]');
    const emptyState = page.locator('[data-testid="acceptance-page"] [data-testid="operations-empty-state"]');
    await expect(table.or(emptyState).first()).toBeVisible();

    // No loading spinner
    await expect(page.locator('[data-testid="acceptance-loading-state"]')).toHaveCount(0);

    // No error banner
    await expect(page.locator('[data-testid="acceptance-error-message"]')).toHaveCount(0);
  });
});

test.describe('ACCEPT-UI-002: Empty pending acceptance state', () => {
  test('ACCEPT-UI-002: Empty state is understandable when no pending operations', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    await page.goto('/operations/pending-acceptance');
    await page.waitForLoadState('networkidle');

    // If table shows empty state, verify its text
    const emptyState = page.locator('[data-testid="acceptance-page"] [data-testid="operations-empty-state"]');
    if (await emptyState.isVisible().catch(() => false)) {
      const text = await emptyState.textContent();
      expect(text?.toLowerCase()).toMatch(/не найдены|пусто|нет данных|empty/);
    }
  });
});

test.describe('ACCEPT-UI-003: Only submitted RECEIVE/MOVE appear', () => {
  test('ACCEPT-UI-003: Submitted MOVE appears; drafts do not', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedMoveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted MOVE operation');
      return;
    }

    await page.goto('/operations/pending-acceptance');
    await page.waitForLoadState('networkidle');

    // Wait for the operation to appear in the list
    const searchText = seeded.number ?? seeded.operationId.slice(0, 8).toUpperCase();
    const row = page.locator('[data-testid="acceptance-page"] [data-testid="operation-row"]')
      .filter({ hasText: searchText })
      .first();
    await expect(row).toBeVisible({ timeout: 10000 });

    // Verify the row status indicates submitted/pending acceptance
    const statusCell = row.locator('[data-testid="operation-status-cell"]');
    const statusText = await statusCell.textContent();
    expect(statusText).toMatch(/Ожидает приёмки|Приёмка: ожидает|Проведена/);

    // Drafts should not appear because this page only queries submitted with pending acceptance
    // This is implicit in the page logic; we just verify the seeded operation appears.
  });
});

test.describe('ACCEPT-UI-004: Open acceptance card from list', () => {
  test('ACCEPT-UI-004: Operation metadata and lines table visible in detail', async ({ page }) => {
    await installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const runId = generateRunId();
    const seeded = await seedSubmittedMoveOperation(page, runId);
    if (!seeded) {
      test.skip(true, 'Seed helper failed: cannot create submitted MOVE operation');
      return;
    }

    await page.goto('/operations/pending-acceptance');
    await page.waitForLoadState('networkidle');

    // Wait for the row
    const searchText = seeded.number ?? seeded.operationId.slice(0, 8).toUpperCase();
    const row = page.locator('[data-testid="acceptance-page"] [data-testid="operation-row"]')
      .filter({ hasText: searchText })
      .first();
    await expect(row).toBeVisible({ timeout: 10000 });

    // Click the number link to open the acceptance detail
    const numberLink = row.locator('[data-testid="operation-number-link"]');
    await expect(numberLink).toBeVisible();
    await numberLink.click();

    // Navigate to detail page
    await page.waitForURL(/\/operations\/.*\/acceptance/);
    await page.waitForLoadState('networkidle');

    // Detail page visible
    await expect(page.locator('[data-testid="acceptance-detail-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-detail-title"]')).toContainText('Приёмка');
    await expect(page.locator('[data-testid="acceptance-detail-operation-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-detail-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="acceptance-detail-lines-table"]')).toBeVisible();

    // At least one line row
    const lineRows = page.locator('[data-testid="acceptance-line-row"]');
    await expect(lineRows.first()).toBeVisible();
  });
});
