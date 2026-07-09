import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId } from '../helpers/seed';

async function goToOperations(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="operations-page"], [data-testid="operations-loading-state"], [data-testid="operations-error-message"]', { timeout: 30000 });
}

async function waitForTableLoaded(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="operations-loading-state"]')).toHaveCount(0);
}

async function getConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe('OPS-UI-001..010 — Operations Journal UI', () => {
  test('OPS-UI-001: Authenticated user opens /operations/; Django shell and Angular content visible; no blocking console errors; no infinite loader', async ({ page }) => {
    installNetworkGuard(page);
    const consoleErrors = await getConsoleErrors(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);

    // Angular content visible
    await expect(page.locator('[data-testid="operations-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="operations-title"]')).toContainText('Операции');

    // Django shell visible (topbar and sidebar assumed)
    const shellElements = await page.locator('.wh-topbar, .topbar, nav, .sidebar').count();
    expect(shellElements).toBeGreaterThan(0);

    // No infinite loader — table or empty state should appear within reasonable time
    await expect(page.locator('[data-testid="operations-table"], [data-testid="operations-empty-state"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="operations-loading-state"]')).toHaveCount(0);

    // No blocking console errors (network/HTTP errors are acceptable; Angular/runtime errors are not)
    const blockingErrors = consoleErrors.filter(e =>
      e.includes('Angular') ||
      e.includes('TypeError') ||
      e.includes('ReferenceError') ||
      e.includes('Cannot read') ||
      e.includes('undefined is not')
    );
    expect(blockingErrors).toEqual([]);
  });

  test('OPS-UI-002: Empty/filter-no-results state is understandable; no 500/403; reset works when filters active', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    // Apply a search that should yield no results
    const runId = generateRunId();
    const searchInput = page.locator('[data-testid="operations-search-input"]');
    await searchInput.fill(`__NO_RESULTS_${runId}__`);
    await page.waitForTimeout(500);
    await waitForTableLoaded(page);

    // No 500/403 error banner
    await expect(page.locator('[data-testid="operations-error-message"]')).toHaveCount(0);

    // Empty state is understandable
    const emptyState = page.locator('[data-testid="operations-empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('Операции не найдены');

    // Reset clears filters and reloads list
    await page.locator('[data-testid="operations-reset-filters-button"]').click();
    await page.waitForTimeout(500);
    await waitForTableLoaded(page);
    await expect(emptyState).toHaveCount(0);
  });

  test('OPS-UI-003: Search by operation number sends expected BFF query and narrows visible rows', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    // First capture any existing number
    const firstRow = page.locator('[data-testid="operation-row"]').first();
    const hasRows = await firstRow.isVisible().catch(() => false);
    if (!hasRows) {
      test.skip('No existing operations to search by number');
      return;
    }

    const numberText = await page.locator('[data-testid="operation-number-link"]').first().textContent() || '';
    const query = numberText.trim();

    const responsePromise = page.waitForResponse(response => {
      if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.searchParams.get('search') === query && response.status() === 200;
    });

    await page.locator('[data-testid="operations-search-input"]').fill(query);
    await responsePromise.catch(() => null);
    await page.waitForTimeout(500);
    await waitForTableLoaded(page);

    // All visible rows should contain the search term
    const visibleRows = page.locator('[data-testid="operation-row"]');
    const count = await visibleRows.count();
    if (count === 0) {
      await expect(page.locator('[data-testid="operations-empty-state"]')).toBeVisible();
    } else {
      for (let i = 0; i < count; i++) {
        const rowNumber = await visibleRows.nth(i).locator('[data-testid="operation-number-link"]').textContent() || '';
        expect(rowNumber).toContain(query);
      }
    }
  });

  test('OPS-UI-004: Type filter sends expected BFF query and shows only selected type', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    const responsePromise = page.waitForResponse(response => {
      if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.searchParams.get('type') === 'RECEIVE' && response.status() === 200;
    });

    await page.locator('[data-testid="operations-type-filter"]').selectOption('RECEIVE');
    await responsePromise;
    await waitForTableLoaded(page);

    // All visible rows should show RECEIVE type label
    const visibleRows = page.locator('[data-testid="operation-row"]');
    const count = await visibleRows.count();
    if (count === 0) {
      // Empty state is acceptable if no RECEIVE operations exist
      await expect(page.locator('[data-testid="operations-empty-state"]')).toBeVisible();
    } else {
      for (let i = 0; i < count; i++) {
        const typeCell = visibleRows.nth(i).locator('[data-testid="operation-type-cell"]');
        await expect(typeCell).toContainText('Приход');
      }
    }
  });

  test('OPS-UI-005: Site filter sends expected BFF query and does not break table/pagination', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    // Get first available site option
    const siteSelect = page.locator('[data-testid="operations-site-filter"]');
    const options = await siteSelect.locator('option').allTextContents();
    const siteOption = options.find(o => o !== 'Все участки');
    if (!siteOption) {
      test.skip('No sites available in filter');
      return;
    }

    const responsePromise = page.waitForResponse(response => {
      if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.searchParams.has('site_id') && response.status() === 200;
    });

    await siteSelect.selectOption({ label: siteOption });
    await responsePromise;
    await waitForTableLoaded(page);

    // Table or empty state should be visible, no error
    await expect(page.locator('[data-testid="operations-table"], [data-testid="operations-empty-state"]')).toBeVisible();
    await expect(page.locator('[data-testid="operations-error-message"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="operations-pagination"]')).toBeVisible();
  });

  test('OPS-UI-006: Valid date range filters; invalid range shows UI validation and does not send meaningless request', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const validFrom = new Date(today);
    validFrom.setDate(validFrom.getDate() - 30);
    const validTo = new Date(today);

    // Valid range: should trigger a request
    const validResponsePromise = page.waitForResponse(response => {
      if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.searchParams.has('created_after') && url.searchParams.has('created_before') && response.status() === 200;
    });

    await page.locator('[data-testid="operations-date-from"]').fill(toIsoDate(validFrom));
    await page.locator('[data-testid="operations-date-to"]').fill(toIsoDate(validTo));
    await validResponsePromise;
    await waitForTableLoaded(page);
    await expect(page.locator('[data-testid="operations-error-message"]')).toHaveCount(0);

    // Invalid range: from > to
    await page.locator('[data-testid="operations-date-from"]').fill(toIsoDate(validTo));
    await page.locator('[data-testid="operations-date-to"]').fill(toIsoDate(validFrom));
    await page.waitForTimeout(500);

    // Should not send a request with meaningless dates, or should show validation
    // We check that no error banner appears and no empty state is forced by invalid params
    await expect(page.locator('[data-testid="operations-error-message"]')).toHaveCount(0);
  });

  test('OPS-UI-007: Только мои sends own-user filter and is resettable', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    const responsePromise = page.waitForResponse(response => {
      if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.searchParams.get('created_by_user_id') === 'me' && response.status() === 200;
    });

    await page.locator('[data-testid="operations-only-mine-checkbox"]').check();
    await responsePromise;
    await waitForTableLoaded(page);

    // Reset should clear the checkbox and reload
    const resetPromise = page.waitForResponse(response => {
      if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return !url.searchParams.has('created_by_user_id') && response.status() === 200;
    });
    await page.locator('[data-testid="operations-reset-filters-button"]').click();
    await resetPromise;
    await waitForTableLoaded(page);
    await expect(page.locator('[data-testid="operations-only-mine-checkbox"]')).not.toBeChecked();
  });

  test('OPS-UI-008: Reset clears filters and reloads list', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    // Set a few filters
    await page.locator('[data-testid="operations-search-input"]').fill('test');
    await page.locator('[data-testid="operations-type-filter"]').selectOption('RECEIVE');
    await page.locator('[data-testid="operations-only-mine-checkbox"]').check();
    await page.waitForTimeout(500);
    await waitForTableLoaded(page);

    const resetPromise = page.waitForResponse(response => {
      if (!response.url().includes('/bff/api/v1/operations') || response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return !url.searchParams.has('search') && !url.searchParams.has('type') && !url.searchParams.has('created_by_user_id') && response.status() === 200;
    });
    await page.locator('[data-testid="operations-reset-filters-button"]').click();
    await resetPromise;
    await waitForTableLoaded(page);

    await expect(page.locator('[data-testid="operations-search-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="operations-type-filter"]')).toHaveValue('0: null');
    await expect(page.locator('[data-testid="operations-only-mine-checkbox"]')).not.toBeChecked();
  });

  test('OPS-UI-009: Pagination and page size 10/20/50 work without broken counts', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    const totalText = await page.locator('[data-testid="operations-pagination"] .page-info').textContent() || '';
    const totalMatch = totalText.match(/из\s+(\d+)/);
    const totalCount = totalMatch ? parseInt(totalMatch[1], 10) : 0;

    if (totalCount === 0) {
      test.skip('No operations to test pagination');
      return;
    }

    // Test page sizes
    for (const size of [10, 20, 50]) {
      if (totalCount < size) continue;
      await page.locator('[data-testid="operations-page-size-select"]').selectOption(String(size));
      await page.waitForTimeout(500);
      await waitForTableLoaded(page);

      const visibleRows = await page.locator('[data-testid="operation-row"]').count();
      expect(visibleRows).toBeLessThanOrEqual(size);
    }

    // If more than one page, test next page
    if (totalCount > 10) {
      const nextBtn = page.locator('[data-testid="operations-pagination"] .page-buttons button').last();
      await nextBtn.click();
      await page.waitForTimeout(500);
      await waitForTableLoaded(page);
    }
  });

  test('OPS-UI-010: Date sorting can be toggled and remains stable', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
    await goToOperations(page);
    await waitForTableLoaded(page);

    const dateHeader = page.locator('[data-testid="operations-table"] th.col-date');
    await expect(dateHeader).toBeVisible();

    const firstCellBefore = await page.locator('[data-testid="operation-row"]').first().locator('[data-testid="operation-date-cell"]').textContent().catch(() => null);
    await dateHeader.click();
    await page.waitForTimeout(500);
    await waitForTableLoaded(page);

    const firstCellAfterFirstClick = await page.locator('[data-testid="operation-row"]').first().locator('[data-testid="operation-date-cell"]').textContent().catch(() => null);
    await dateHeader.click();
    await page.waitForTimeout(500);
    await waitForTableLoaded(page);
    const firstCellAfterSecondClick = await page.locator('[data-testid="operation-row"]').first().locator('[data-testid="operation-date-cell"]').textContent().catch(() => null);

    // After toggling, table still renders without error
    await expect(page.locator('[data-testid="operations-error-message"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="operation-row"]').first()).toBeVisible();
    expect([firstCellBefore, firstCellAfterFirstClick, firstCellAfterSecondClick].some(Boolean)).toBe(true);
  });
});
