/**
 * E2E: operation-submit domain-error surface
 * (TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE §14, scenarios 1-7).
 *
 * Scenarios 1, 5 run against the REAL stand: the operation draft is created via
 * the BFF API and the submit reaches SyncServer, which returns the problem
 * envelope. Scenarios 2, 3, 4, 6, 7 create the draft via the API too but
 * intercept only the submit endpoint so the envelope is fully controlled.
 *
 * Run: npx playwright test e2e/operations/submit-errors.spec.ts
 * Full Docker-backed run: make test-e2e (from the workspace root).
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRoot } from '../helpers/login';
import { installNetworkGuard } from '../helpers/network-guard';
import { generateRunId } from '../helpers/seed';

const BFF = '/bff/api/v1';

// ─── API helpers ───────────────────────────────────────────────────────────

async function getCsrf(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find(c => c.name === 'csrftoken');
  return csrf?.value ?? '';
}

interface CreatedOperation {
  id: string;
  dto: Record<string, any>;
}

async function apiCreateDraft(
  page: Page,
  payload: Record<string, unknown>,
): Promise<CreatedOperation | null> {
  const csrf = await getCsrf(page);
  const res = await page.request.post(`${BFF}/operations`, {
    data: payload,
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRFToken': csrf } : {}) },
    failOnStatusCode: false,
  });
  if (!res.ok()) return null;
  const body = await res.json();
  const id = body?.data?.id;
  if (!id) return null;
  return { id, dto: body.data };
}

async function apiGetOperation(page: Page, id: string): Promise<Record<string, any> | null> {
  const res = await page.request.get(`${BFF}/operations/${id}`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  return body?.data ?? null;
}

/**
 * The submit flow saves the draft first (PATCH /operations/{id}), and
 * SyncServer's update recreates the operation lines with NEW ids. Envelopes
 * for mocked submits must therefore reference the ids AFTER that save-step
 * PATCH, otherwise the inline mapping finds no matching local rows. This
 * helper passes the real PATCH through while capturing the fresh line ids.
 */
async function installLineIdCapture(page: Page, operationId: string): Promise<{ get: () => number[] }> {
  let freshIds: number[] = [];
  await page.route(`**${BFF}/operations/${operationId}`, async route => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      const response = await route.fetch();
      const body = await response.json();
      const data = body?.data ?? body;
      freshIds = (data?.lines ?? []).map((l: any) => Number(l.id)).filter(Boolean);
      await route.fulfill({ response });
    } else {
      await route.continue();
    }
  });
  return { get: () => freshIds };
}

interface SiteRef {
  site_id: string | number;
  name: string;
}

interface BalanceRow {
  item_id: string | number;
  item_name: string;
  qty: string;
}

async function getSites(page: Page): Promise<SiteRef[]> {
  const res = await page.request.get(`${BFF}/catalog/sites`, { failOnStatusCode: false });
  if (!res.ok()) return [];
  const body = await res.json();
  return body?.data?.sites ?? [];
}

async function getBalances(page: Page, siteId: string | number): Promise<BalanceRow[]> {
  const res = await page.request.get(`${BFF}/balances?site_id=${siteId}`, { failOnStatusCode: false });
  if (!res.ok()) return [];
  const body = await res.json();
  return body?.data?.items ?? (Array.isArray(body?.data) ? body.data : []);
}

/**
 * First item with balance ≥ 3 at a site + a second, different site. We
 * require at least 3 units so the success-after-fix scenario can demonstrate
 * a safe fix (two lines each > 0 must sum to < balance).
 */
async function findMoveFixture(page: Page): Promise<{
  source: SiteRef;
  dest: SiteRef;
  itemId: string | number;
  itemName: string;
  balance: number;
} | null> {
  const sites = await getSites(page);
  for (const source of sites) {
    const rows = await getBalances(page, source.site_id);
    const row = rows.find(r => parseFloat(r.qty) >= 3);
    const dest = sites.find(s => s.site_id !== source.site_id);
    if (row && dest) {
      return {
        source,
        dest,
        itemId: row.item_id,
        itemName: row.item_name,
        balance: parseFloat(row.qty),
      };
    }
  }
  return null;
}

async function getAnyItem(page: Page): Promise<string | number | null> {
  const res = await page.request.get(`${BFF}/catalog/items?limit=10`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  const items: Array<{ id: string | number }> = body?.data?.items ?? [];
  return items[0]?.id ?? null;
}

// ─── UI helpers ────────────────────────────────────────────────────────────

async function openOperationsPage(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
}

async function openDraftInModal(page: Page, runId: string): Promise<void> {
  const row = page.locator('[data-testid="operation-row"]', { hasText: runId }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator('[data-testid="operation-action-edit"]').click();
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.modal-overlay tbody tr').first()).toBeVisible({ timeout: 10000 });
}

async function submitInModal(page: Page): Promise<void> {
  await page.locator('.modal-overlay button:has-text("Подтвердить")').click();
}

async function expectSubmitToast(page: Page, text: string): Promise<void> {
  await expect(page.locator('[data-testid="operation-submit-toast"]')).toContainText(text, {
    timeout: 10000,
  });
}

// ─── Mock envelopes (mirror of TZ-SYNCSERVER §3.3) ─────────────────────────

function makeEnvelope(errors: unknown[], code = 'operation_submit_rejected'): Record<string, unknown> {
  return {
    type: 'urn:warehouse:problem:operation-submit-rejected',
    title: 'Операция не может быть проведена',
    status: 409,
    code,
    detail: 'Исправьте отмеченные ошибки и повторите проведение.',
    instance: '/api/v1/operations/mock/submit',
    errors,
  };
}

function makeInsufficientStockEnvelope(lineIds: number[]): Record<string, unknown> {
  return makeEnvelope([
    {
      code: 'insufficient_stock',
      scope: 'line_group',
      operation_line_ids: lineIds,
      item: { id: 1001, name: 'Тестовая ТМЦ' },
      stock_site: { id: 1, name: 'Склад' },
      required_qty: '120',
      available_qty: '80',
      unit: { id: 4, name: 'метр', symbol: 'м' },
    },
  ]);
}

function makeStaleVersionEnvelope(): Record<string, unknown> {
  return makeEnvelope([
    { code: 'stale_version', scope: 'operation', expected_version: 1, actual_version: 2 },
  ]);
}

function makeWrongStateEnvelope(): Record<string, unknown> {
  return makeEnvelope([
    {
      code: 'operation_in_wrong_state',
      scope: 'operation',
      current_state: 'SUBMITTED',
      allowed_states: ['DRAFT'],
    },
  ]);
}

function makeUnknownCodeEnvelope(): Record<string, unknown> {
  return makeEnvelope([{ code: 'future_unknown_code', scope: 'operation' }]);
}

function movePayload(
  runId: string,
  sourceSiteId: string | number,
  destSiteId: string | number,
  lines: Array<{ item_id: string | number; qty: string }>,
): Record<string, unknown> {
  return {
    type: 'MOVE',
    site_id: sourceSiteId,
    source_site_id: sourceSiteId,
    destination_site_id: destSiteId,
    notes: `submit-errors ${runId}`,
    client_request_id: crypto.randomUUID(),
    lines: lines.map((l, idx) => ({ line_number: idx + 1, item_id: l.item_id, qty: l.qty })),
  };
}

test.describe('Operation submit-error surface (§14 scenarios 1-7)', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
  });

  test('1. submit_with_insufficient_stock_shows_inline_highlight (real server)', async ({ page }) => {
    const fx = await findMoveFixture(page);
    if (!fx) {
      test.skip(true, 'No site with stocked item available on the stand');
      return;
    }

    // Two lines of the same item; their sum must exceed the available balance.
    const each = Math.ceil(fx.balance / 2) + 5;
    const runId = generateRunId();
    const created = await apiCreateDraft(
      page,
      movePayload(runId, fx.source.site_id, fx.dest.site_id, [
        { item_id: fx.itemId, qty: String(each) },
        { item_id: fx.itemId, qty: String(each) },
      ]),
    );
    if (!created) {
      test.skip(true, 'Could not create MOVE draft via API');
      return;
    }

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    await expectSubmitToast(page, 'ошибки в 2 строках');

    const erroredRows = page.locator('.modal-overlay tbody tr.row--has-error');
    await expect(erroredRows).toHaveCount(2);

    const hints = page.locator('[data-testid="operation-line-submit-hint"]');
    await expect(hints).toHaveCount(2);
    const hintText = (await hints.first().textContent())?.trim() ?? '';
    expect(hintText).toMatch(/На складе: [\d.]+(?: \S+)?, запрошено: [\d.]+(?: \S+)?/);
    const numbers = hintText.match(/([\d.]+)/g)?.map(Number) ?? [];
    expect(numbers.length).toBeGreaterThanOrEqual(2);
    expect(numbers[1]).toBeGreaterThan(fx.balance); // required > available
    expect(numbers[0]).toBeCloseTo(fx.balance, 0); // available matches the balance
  });

  test('2. submit_with_stale_version_shows_refresh_button (mock)', async ({ page }) => {
    const itemId = await getAnyItem(page);
    const sites = await getSites(page);
    if (!itemId || sites.length < 2) {
      test.skip(true, 'No item or two sites available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(
      page,
      movePayload(runId, sites[0].site_id, sites[1].site_id, [{ item_id: itemId, qty: '1' }]),
    );
    if (!created) {
      test.skip(true, 'Could not create MOVE draft via API');
      return;
    }

    await page.route(`**${BFF}/operations/${created.id}/submit`, route =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(makeStaleVersionEnvelope()) }),
    );

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    await expectSubmitToast(page, 'Операция была изменена другим пользователем');
    await expect(page.locator('[data-testid="operation-submit-refresh"]')).toBeVisible();
  });

  test('3. submit_already_submitted_returns_operation_in_wrong_state (mock)', async ({ page }) => {
    const itemId = await getAnyItem(page);
    const sites = await getSites(page);
    if (!itemId || sites.length < 2) {
      test.skip(true, 'No item or two sites available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(
      page,
      movePayload(runId, sites[0].site_id, sites[1].site_id, [{ item_id: itemId, qty: '1' }]),
    );
    if (!created) {
      test.skip(true, 'Could not create MOVE draft via API');
      return;
    }

    const envelope = makeWrongStateEnvelope();
    expect((envelope.errors as Array<{ code: string }>)[0].code).toBe('operation_in_wrong_state');
    await page.route(`**${BFF}/operations/${created.id}/submit`, route =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(envelope) }),
    );

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    await expectSubmitToast(page, 'Операцию нельзя провести в текущем состоянии.');
    await expect(page.locator('[data-testid="operation-submit-refresh"]')).toHaveCount(0);
  });

  test('4. changing_line_clears_group_error (mock)', async ({ page }) => {
    const itemId = await getAnyItem(page);
    const sites = await getSites(page);
    if (!itemId || sites.length < 2) {
      test.skip(true, 'No item or two sites available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(
      page,
      movePayload(runId, sites[0].site_id, sites[1].site_id, [
        { item_id: itemId, qty: '60' },
        { item_id: itemId, qty: '60' },
      ]),
    );
    if (!created) {
      test.skip(true, 'Could not create MOVE draft via API');
      return;
    }
    const dto = await apiGetOperation(page, created.id);
    if ((dto?.lines ?? []).length !== 2) {
      test.skip(true, 'Draft has no two persisted lines to reference');
      return;
    }
    // Lines are recreated by the save-step PATCH with new ids, so the mocked
    // envelope must use the ids captured AFTER that PATCH (see helper note).
    const captured = await installLineIdCapture(page, created.id);
    await page.route(`**${BFF}/operations/${created.id}/submit`, route =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(makeInsufficientStockEnvelope(captured.get())) }),
    );

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    const erroredRows = page.locator('.modal-overlay tbody tr.row--has-error');
    await expect(erroredRows).toHaveCount(2);
    await expectSubmitToast(page, 'ошибки в 2 строках');

    // Editing a significant field (qty) of one row marks the WHOLE group stale.
    await erroredRows.first().locator('.qty-input').fill('10');
    await expect(page.locator('.modal-overlay tbody tr.row--has-error--stale')).toHaveCount(2);
  });

  test('5. success_submit_clears_all_errors (real server)', async ({ page }) => {
    const fx = await findMoveFixture(page);
    if (!fx) {
      test.skip(true, 'No site with stocked item available on the stand');
      return;
    }
    if (fx.balance < 3) {
      test.skip(true, 'Balance too small to demonstrate a successful fix');
      return;
    }

    const each = Math.ceil(fx.balance / 2) + 5;
    const runId = generateRunId();
    const created = await apiCreateDraft(
      page,
      movePayload(runId, fx.source.site_id, fx.dest.site_id, [
        { item_id: fx.itemId, qty: String(each) },
        { item_id: fx.itemId, qty: String(each) },
      ]),
    );
    if (!created) {
      test.skip(true, 'Could not create MOVE draft via API');
      return;
    }

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    await expectSubmitToast(page, 'ошибки в 2 строках');
    await expect(page.locator('.modal-overlay tbody tr.row--has-error')).toHaveCount(2);

    // Fix both lines so the total no longer exceeds the balance.
    const safeQty = Math.max(1, Math.floor((fx.balance - 1) / 2));
    const qtyInputs = page.locator('.modal-overlay tbody tr .qty-input');
    await qtyInputs.nth(0).fill(String(safeQty));
    await qtyInputs.nth(1).fill(String(safeQty));

    // The previous group becomes stale (dashed) while editing.
    await expect(page.locator('.modal-overlay tbody tr.row--has-error--stale')).toHaveCount(2);

    await submitInModal(page);

    // Success closes the modal and removes the toast/highlight.
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="operation-submit-toast"]')).toHaveCount(0);
  });

  test('6. unknown_code_does_not_crash_ui (mock)', async ({ page }) => {
    const itemId = await getAnyItem(page);
    const sites = await getSites(page);
    if (!itemId || sites.length < 2) {
      test.skip(true, 'No item or two sites available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(
      page,
      movePayload(runId, sites[0].site_id, sites[1].site_id, [{ item_id: itemId, qty: '1' }]),
    );
    if (!created) {
      test.skip(true, 'Could not create MOVE draft via API');
      return;
    }

    await page.route(`**${BFF}/operations/${created.id}/submit`, route =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(makeUnknownCodeEnvelope()) }),
    );

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    // Generic message, UI stays alive (modal visible, no inline highlight).
    await expectSubmitToast(page, 'Не удалось провести операцию. Попробуйте ещё раз или обратитесь к администратору.');
    await expect(page.locator('.modal-overlay')).toBeVisible();
    await expect(page.locator('.modal-overlay tbody tr.row--has-error')).toHaveCount(0);
  });

  test('7. scroll_and_focus_to_first_errored_line (mock)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const itemId = await getAnyItem(page);
    const sites = await getSites(page);
    if (!itemId || sites.length < 2) {
      test.skip(true, 'No item or two sites available on the stand');
      return;
    }
    const runId = generateRunId();
    const lineCount = 10;
    const created = await apiCreateDraft(
      page,
      movePayload(runId, sites[0].site_id, sites[1].site_id, [
        ...Array.from({ length: lineCount }, () => ({ item_id: itemId, qty: '1' })),
      ]),
    );
    if (!created) {
      test.skip(true, 'Could not create MOVE draft via API');
      return;
    }
    const dto = await apiGetOperation(page, created.id);
    if ((dto?.lines ?? []).length < 3) {
      test.skip(true, 'Draft has fewer than 3 persisted lines');
      return;
    }

    // Error on the 3rd line only. Use the ids AFTER the save-step PATCH (which
    // recreates lines) so the envelope maps to the re-bound draft rows.
    const captured = await installLineIdCapture(page, created.id);
    await page.route(`**${BFF}/operations/${created.id}/submit`, route => {
      const ids = captured.get();
      const lineIds = ids.length >= 3 ? [ids[2]] : [];
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify(makeInsufficientStockEnvelope(lineIds)) });
    });

    await openOperationsPage(page);
    await openDraftInModal(page, runId);
    await submitInModal(page);

    const erroredRow = page.locator('.modal-overlay tbody tr.row--has-error');
    await expect(erroredRow).toHaveCount(1);
    await expect(erroredRow.locator('.col-num')).toHaveText('3');

    // Focus lands on the qty input of the first errored line.
    const qtyInput = erroredRow.locator('.qty-input');
    await expect(qtyInput).toBeFocused();

    // The row is scrolled into the visible modal body.
    const inputBox = await qtyInput.boundingBox();
    const bodyBox = await page.locator('.modal-body').boundingBox();
    expect(inputBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    expect(inputBox!.y).toBeGreaterThanOrEqual(bodyBox!.y - 1);
    expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(bodyBox!.y + bodyBox!.height + 1);
  });
});
