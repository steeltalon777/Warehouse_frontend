import { test, expect } from '@playwright/test';
import { loginAsRole } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';

test.describe('OPS-INLINE-SMOKE-001 — Inline item creation without SKU', () => {
  test('creates inline TMC without SKU field and adds to operation lines', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRole(page, 'root');

    await page.goto('/operations/', { waitUntil: 'networkidle' });

    // Open create operation modal
    await page.click('button:has-text("Создать операцию")');
    await page.waitForSelector('.modal-overlay');
    await page.waitForTimeout(500);

    // Select RECEIVE type
    await page.locator('.modal-overlay select').first().selectOption('RECEIVE');

    // Select first available site
    const siteSelect = page.locator('.modal-overlay select').nth(1);
    const siteOptions = await siteSelect.locator('option[value]:not([value=""])').all();
    if (siteOptions.length > 0) {
      const siteValue = await siteOptions[0].getAttribute('value');
      if (siteValue) await siteSelect.selectOption(siteValue);
    }

    // Open inline create modal
    await page.click('button:has-text("Создать ТМЦ")');
    await expect(page.locator('.modal-container--inline h2')).toHaveText('Создание ТМЦ', { timeout: 5000 });
    await page.waitForTimeout(300);

    const inlineModal = page.locator('.modal-container--inline');

    // AC: SKU/артикул input NOT present (removed by TZ)
    await expect(
      inlineModal.locator(
        'input[placeholder*="артикул"], input[placeholder*="Артикул"], input[placeholder*="SKU"]',
      ),
    ).toHaveCount(0);

    const runId = `E2E_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const itemName = `E2E-SMOKE-${runId}`;

    // Fill name
    await inlineModal.locator('input[placeholder="Введите название ТМЦ"]').fill(itemName);

    // Unit is auto-selected by the component (loadDefaultUnit finds "Штука").
    // Wait for the unit input to become disabled, indicating a unit was pre-selected.
    const unitInput = inlineModal.locator('input[placeholder="Поиск единицы измерения..."]');
    await expect(unitInput).toBeDisabled({ timeout: 5000 });

    // Click "Создать и добавить"
    await inlineModal.locator('button:has-text("Создать и добавить")').click();

    // Inline modal should close
    await expect(inlineModal).toHaveCount(0, { timeout: 5000 });

    // Item appears in operation lines table
    await expect(page.locator('app-operation-lines-table')).toContainText(itemName, { timeout: 5000 });
  });
});
