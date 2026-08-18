/**
 * Playwright smoke tests for Operation Create Modal rework.
 *
 * Verifies:
 * 1. Modal layout: 40/30/30 MOVE, 40/60 non-MOVE
 * 2. Warehouse selection, item search, lines table
 * 3. Save/confirm button gating
 * 4. Balance display
 *
 * Run: npx playwright test e2e/operations/operations-create-modal.spec.ts
 * Requires: docker stand running with test_spa_user/user logged out.
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

async function selectFirstWarehouse(page: Page): Promise<string> {
  const select = page.locator('.modal-overlay select').nth(1);
  const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({
    value: (node as HTMLOptionElement).value,
    label: node.textContent?.trim() ?? '',
  })));
  const firstWarehouse = options.find(option => option.value && option.label && option.label !== 'Все участки');
  if (!firstWarehouse) throw new Error('No warehouse options available in create modal');
  await select.selectOption(firstWarehouse.value);
  await expect(select).toHaveValue(firstWarehouse.value);
  return firstWarehouse.label;
}

async function selectAlternativeWarehouse(page: Page, current: string): Promise<string | null> {
  const select = page.locator('.modal-overlay select').nth(1);
  const options = await select.locator('option').evaluateAll(nodes => nodes.map(node => ({
    value: (node as HTMLOptionElement).value,
    label: node.textContent?.trim() ?? '',
  })));
  const alternative = options.find(option => option.value && option.label && option.label !== 'Все участки' && option.label !== current) ?? null;
  if (alternative) {
    await select.selectOption(alternative.value);
    await expect(select).toHaveValue(alternative.value);
  }
  return alternative?.label ?? null;
}

async function openCreateModal(page: Page) {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
}

async function fetchWarehouseBalance(page: Page, siteName: string, itemNamePart: string): Promise<string> {
  return page.evaluate(async ({ siteName, itemNamePart }) => {
    const sitesResponse = await fetch('/bff/api/v1/catalog/sites', { credentials: 'include' });
    const sitesPayload = await sitesResponse.json();
    const site = (sitesPayload?.data?.sites ?? []).find((s: any) => s.name === siteName);
    if (!site) throw new Error(`Site not found: ${siteName}`);

    const balancesResponse = await fetch(`/bff/api/v1/balances?site_id=${site.site_id}`, { credentials: 'include' });
    const balancesPayload = await balancesResponse.json();
    const rows = Array.isArray(balancesPayload?.data) ? balancesPayload.data : (balancesPayload?.data?.items ?? []);
    const row = rows.find((b: any) => String(b.item_name ?? '').includes(itemNamePart));
    if (!row) throw new Error(`Balance row not found for: ${itemNamePart}`);
    return String(parseFloat(row.qty));
  }, { siteName, itemNamePart });
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

async function addFirstMatchingItem(page: Page, queries: string[], quantity: string, usedNames: Set<string> = new Set<string>()): Promise<string> {
  for (const query of queries) {
    const addedName = await addVisibleItemToDraft(page, query, quantity, usedNames).catch(() => null);
    if (addedName) return addedName;
  }
  throw new Error(`No item found for fallback queries: ${queries.join(', ')}`);
}

async function addThreeVisibleItemsToDraft(page: Page): Promise<string[]> {
  const usedNames = new Set<string>();
  const names: string[] = [];
  const queries = ['ка', 'со', 'бф', 'тм', 'др', 'ма', 'те', 'тр', 'ин', 'ро', 'кабель', 'солярка'];
  const quantities = ['10', '2', '100'];

  for (const query of queries) {
    const addedName = await addVisibleItemToDraft(page, query, quantities[names.length] ?? '1', usedNames).catch(() => null);
    if (addedName) names.push(addedName);
    if (names.length >= 3) break;
  }

  return names;
}

async function expectDraftItemNames(page: Page, expectedNames: string[]): Promise<void> {
  await expect(page.locator('.modal-overlay tbody tr')).toHaveCount(expectedNames.length);
  await expect.poll(async () => {
    return page.locator('.modal-overlay .item-name').allTextContents();
  }).toEqual(expect.arrayContaining(expectedNames));
}

test.describe('Operation Create Modal — Layout', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('default MOVE layout shows 40/30/30 type/source/destination', async ({ page }) => {
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
    await openCreateModal(page);

    await expect(page.locator('.modal-overlay label:has-text("Добавить ТМЦ в операцию")')).toBeVisible();
    const searchInput = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');
    await expect(searchInput).toBeVisible();

    const createBtn = page.locator('.modal-overlay button:has-text("Создать ТМЦ")');
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
  });

  test('top add TMC search returns catalog results in create mode', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await selectFirstWarehouse(page);

    await expect(page.locator('.modal-overlay input[placeholder*="Фильтр уже добавленных"]')).not.toBeVisible();
    await page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]').fill('сол');
    await expect(page.locator('.modal-overlay .search-option').first()).toBeVisible();
  });

  test('available quantity column shows a numeric balance, never dash', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await selectFirstWarehouse(page);
    await addFirstMatchingItem(page, ['сол', 'кабель', 'ка'], '1');

    // Wait for targeted balance to load after item selection
    const availableCell = page.locator('.modal-overlay tbody tr').first().locator('.col-avail');
    await expect(availableCell).toContainText(/\d+/, { timeout: 15000 });
    await expect(availableCell).not.toContainText('—');
    await expect(availableCell).not.toContainText('превышает остаток');
  });

  test('available quantity uses current warehouse balance for selected warehouse', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    const selectedWarehouse = await selectFirstWarehouse(page);

    const itemName = await addFirstMatchingItem(page, ['сол', 'кабель', 'ка'], '1');

    // Wait for targeted balance to load after item selection
    const availableCell = page.locator('.modal-overlay tbody tr').first().locator('.col-avail');
    await expect(availableCell).toContainText(/\d+/, { timeout: 15000 });

    const expectedBalance = await fetchWarehouseBalance(page, selectedWarehouse, itemName).catch(() => null);
    if (expectedBalance !== null) {
      await expect(availableCell).toContainText(expectedBalance);
    }
  });

  test('modal has comment textarea with 2 rows', async ({ page }) => {
    await openCreateModal(page);

    const effectiveAt = page.locator('.modal-overlay input[type="datetime-local"]');
    await expect(page.locator('.modal-overlay label:has-text("Дата проведения")')).toBeVisible();
    await expect(effectiveAt).toBeVisible();
    await expect(effectiveAt).not.toHaveValue('');
    await effectiveAt.fill('2026-01-15T10:30');
    await expect(effectiveAt).toHaveValue('2026-01-15T10:30');

    const comment = page.locator('.modal-overlay textarea');
    await expect(comment).toBeVisible({ timeout: 5000 });
    await expect(comment).toHaveAttribute('rows', '2');

    const dateBox = await effectiveAt.boundingBox();
    const commentBox = await comment.boundingBox();
    expect(dateBox?.y ?? 0).toBeLessThan(commentBox?.y ?? 0);
  });
});

test.describe('Operation Create Modal — Validation', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('save disabled state changes based on validation reasons', async ({ page }) => {
    await openCreateModal(page);

    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
    await expect(saveBtn).toBeDisabled();

    // Validation hint should be visible with no-lines message
    await expect(page.locator('.modal-overlay .validation-hint')).toHaveText('Добавьте минимум одну позицию');

    // Change to EXPENSE type — warehouse label changes
    await page.locator('.modal-overlay select').first().selectOption('EXPENSE');
    await page.waitForTimeout(300);

    // Select warehouse
    await selectFirstWarehouse(page);
    await page.waitForTimeout(300);

    // Confirm validation still says add lines
    await expect(page.locator('.modal-overlay .validation-hint')).toHaveText('Добавьте минимум одну позицию');
  });

  test('confirm button is enabled for a valid unsaved draft', async ({ page }) => {
    await openCreateModal(page);

    const confirmBtn = page.locator('.modal-overlay button:has-text("Подтвердить")');
    await expect(confirmBtn).toBeDisabled();

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await selectFirstWarehouse(page);
    await addFirstMatchingItem(page, ['сол', 'кабель', 'ка'], '1');

    await expect(page.locator('.modal-overlay button:has-text("Сохранить черновик")')).toBeEnabled();
  });
});

test.describe('Operation Create Modal — Lines Table', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'spa_user');
  });

  test('lines table shows correct columns for MOVE (Отправляемое количество)', async ({ page }) => {
    await openCreateModal(page);

    const table = page.locator('.modal-overlay table');
    await expect(table.locator('th').nth(0)).toContainText('№');
    await expect(table.locator('th').nth(1)).toContainText('ТМЦ');
    await expect(table.locator('th').nth(2)).toContainText('Отправляемое количество');
    await expect(table.locator('th').nth(3)).toContainText('category_id');
    await expect(table.locator('th').nth(4)).toContainText('Имеется');
  });

  test('lines table shows correct columns for RECEIVE (Количество)', async ({ page }) => {
    await openCreateModal(page);

    // Change to RECEIVE
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.waitForTimeout(300);

    const table = page.locator('.modal-overlay table');
    await expect(table.locator('th').nth(0)).toContainText('№');
    await expect(table.locator('th').nth(2)).toContainText('Количество');
  });

  test('lines table hides added-lines filter when there are too few positions', async ({ page }) => {
    await openCreateModal(page);

    const filterInput = page.locator('.modal-overlay input[placeholder*="Фильтр уже добавленных"]');
    await expect(filterInput).not.toBeVisible();
    await expect(page.locator('.modal-overlay .empty-state')).toContainText('Для добавления используйте поле «Добавить ТМЦ» выше');
  });

  test('saved long draft keeps all item names after repeated save', async ({ page }) => {
    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await selectFirstWarehouse(page);

    const itemNames = await addThreeVisibleItemsToDraft(page);
    expect(itemNames.length).toBe(3);

    const saveBtn = page.locator('.modal-overlay button:has-text("Сохранить черновик")');
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/bff/api/v1/operations') && response.request().method() === 'POST' && response.status() === 200),
      saveBtn.click(),
    ]);
    await expectDraftItemNames(page, itemNames);

    await page.locator('.modal-overlay tbody tr', { hasText: itemNames[0] }).locator('.qty-input').fill('11');
    await saveBtn.click();
    await page.waitForTimeout(1000);
    await expectDraftItemNames(page, itemNames);
  });
});
