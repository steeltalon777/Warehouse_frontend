import { test, expect, Page } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId } from '../helpers/seed';

interface UnitDto {
  id: string | number;
  name: string;
  symbol?: string | null;
}

interface CategoryDto {
  id: string | number;
  name: string;
}

interface SiteDto {
  site_id: string | number;
  name: string;
}

async function getFirstSite(page: Page): Promise<SiteDto | null> {
  const response = await page.request.get('/bff/api/v1/catalog/sites', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  const sites: SiteDto[] = payload?.data?.sites ?? payload?.data ?? [];
  return sites[0] || null;
}

async function getFirstUnit(page: Page): Promise<UnitDto | null> {
  const response = await page.request.get('/bff/api/v1/catalog/units?limit=10', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  const units: UnitDto[] = payload?.data?.units ?? payload?.data?.items ?? payload?.data ?? [];
  return units[0] || null;
}

async function getFirstCategory(page: Page): Promise<CategoryDto | null> {
  const response = await page.request.get('/bff/api/v1/catalog/categories?limit=10', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  const categories: CategoryDto[] = payload?.data?.categories ?? payload?.data?.items ?? payload?.data ?? [];
  return categories[0] || null;
}

async function createCatalogItemWithSku(
  page: Page,
  name: string,
  sku: string,
  unitId: string | number,
  categoryId: string | number,
): Promise<void> {
  const csrfCookies = await page.context().cookies();
  const csrf = csrfCookies.find(c => c.name === 'csrftoken')?.value;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRFToken'] = csrf;

  const response = await page.request.post('/bff/api/v1/catalog/admin/items', {
    data: {
      name,
      sku,
      unit_id: unitId,
      category_id: categoryId,
      is_active: true,
    },
    headers,
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to seed catalog item: ${response.status()} ${text}`);
  }
}

async function openCreateModal(page: Page) {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Создать операцию")');
  await page.waitForSelector('.modal-overlay');
  await page.waitForTimeout(300);
}

async function createInlineItemWithSku(
  page: Page,
  name: string,
  sku: string,
  unitName: string,
): Promise<void> {
  const modal = page.locator('.modal-overlay').first();
  await modal.locator('button:has-text("Создать ТМЦ")').click();

  await page.waitForTimeout(300);

  await page.locator('.modal-container--inline input[placeholder*="Введите название ТМЦ"]').fill(name);
  await page.locator('.modal-container--inline input[placeholder*="Введите артикул"]').fill(sku);

  const unitSearch = page.locator('.modal-container--inline input[placeholder*="Поиск единицы измерения"]');
  await unitSearch.fill(unitName);
  await expect(page.locator('.modal-container--inline .search-dropdown .dropdown-item').first()).toBeVisible({ timeout: 5000 });
  await page.locator('.modal-container--inline .search-dropdown .dropdown-item').first().click();

  await page.locator('.modal-container--inline button:has-text("Создать и добавить")').click();
  await expect(page.locator('.modal-container--inline')).toHaveCount(0);
}

test.describe('OPS-SKU-CONFLICT-001 — Duplicate SKU UX', () => {
  test('shows readable 409 error in create modal when inline SKU already exists', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'root');

    const site = await getFirstSite(page);
    const unit = await getFirstUnit(page);
    const category = await getFirstCategory(page);
    test.skip(!site, 'No site found on dev stand');
    test.skip(!unit, 'No unit found on dev stand');
    test.skip(!category, 'No category found on dev stand');

    const runId = generateRunId();
    const conflictSku = `E2E-DUP-${runId}`;

    // Seed an existing catalog item with the target SKU
    await createCatalogItemWithSku(
      page,
      `E2E seed item ${runId}`,
      conflictSku,
      unit!.id,
      category!.id,
    );

    await openCreateModal(page);

    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');
    await page.locator('.modal-overlay select').nth(1).selectOption(String(site!.name));

    await createInlineItemWithSku(
      page,
      `E2E conflict item ${runId}`,
      conflictSku,
      unit!.name,
    );

    const modal = page.locator('.modal-overlay').first();
    await modal.locator('.qty-input').fill('1');

    await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('/bff/api/v1/operations') &&
        response.request().method() === 'POST' &&
        response.status() === 409
      ),
      modal.locator('button:has-text("Сохранить черновик")').click(),
    ]);

    const alert = modal.locator('[data-testid="operation-create-submit-error"]');
    await expect(alert).toBeVisible();
    const alertText = await alert.textContent();
    expect(alertText).toContain(conflictSku);
    expect(alertText).toMatch(/уже занят|конфликт/i);

    // User can dismiss the alert and remains in the modal to fix data
    await alert.locator('button[aria-label="Закрыть"]').click();
    await expect(alert).not.toBeVisible();
    await expect(modal).toBeVisible();
  });
});
