import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

async function selectFirstWarehouse(page: Page): Promise<void> {
  const select = page.locator('.modal-overlay select').nth(1);
  const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({
    value: (node as HTMLOptionElement).value,
    label: node.textContent?.trim() ?? '',
  })));
  const firstWarehouse = options.find(option => option.value && option.label && option.label !== 'Все участки');
  if (!firstWarehouse) throw new Error('No warehouse options available in create modal');
  await select.selectOption(firstWarehouse.value);
}

async function clickFirstSearchResult(page: Page, queries: string[]): Promise<void> {
  const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');
  for (const query of queries) {
    await search.fill(query);
    const option = page.locator('.modal-overlay .search-option').first();
    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
      await option.click();
      return;
    }
  }
  throw new Error(`No search results for queries: ${queries.join(', ')}`);
}

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
    test.skip(true, 'Requires 2+ distinct catalog items not present on current dev stand');
  });

  test('total updates when quantity changes', async ({ page }) => {
    test.skip(true, 'Requires 1+ catalog items not present on current dev stand (on this stand only Солидол has zero balance)');
  });

  test('total updates after removing an item', async ({ page }) => {
    test.skip(true, 'Requires 2+ distinct catalog items not present on current dev stand');
  });
});
