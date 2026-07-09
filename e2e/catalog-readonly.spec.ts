import { expect, test } from '@playwright/test';
import { loginAsRole, loginAsRoot } from './helpers/login';
import { installNetworkGuard } from './helpers/network-guard';

test.describe('Catalog readonly alias', () => {
  test.beforeEach(({ page }) => {
    installNetworkGuard(page);
  });

  test('catalog route stays readonly even for root', async ({ page }) => {
    await loginAsRoot(page);
    await page.goto('/catalog/');

    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('app-root')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Раскрыть всё' })).toBeVisible();
    await expect(page.locator('app-search-input input[placeholder="Название, SKU, ключевые слова"]')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Категория' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ ТМЦ' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Применить все' })).toHaveCount(0);
    await expect(page.locator('app-pending-changes-bar')).toHaveCount(0);
  });

  test('catalog compatibility path does not redirect into nomenclature', async ({ page }) => {
    await loginAsRoot(page);
    await page.goto('/catalog/items/');

    await expect(page).toHaveURL(/\/catalog\/items\/?$/);
    await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Категория' })).toHaveCount(0);
  });

  test('nomenclature route stays editable for root', async ({ page }) => {
    await loginAsRoot(page);
    await page.goto('/nomenclature/');

    await expect(page).toHaveURL(/\/nomenclature\/?$/);
    await expect(page.getByRole('heading', { name: 'Номенклатура' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Категория' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ ТМЦ' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Применить все' })).toBeVisible();
    await expect(page.locator('app-pending-changes-bar')).toBeVisible();
  });

  test('observer alias is redirected away from editable nomenclature', async ({ page }) => {
    await loginAsRole(page, 'buh_observer');
    await page.goto('/nomenclature/');

    await expect(page).toHaveURL(/\/catalog\/?$/);
    await expect(page.getByRole('heading', { name: 'Каталог' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Категория' })).toHaveCount(0);
  });
});
