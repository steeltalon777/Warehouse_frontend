/**
 * E2E: operation-cancel domain-error surface
 * (TZ-OPERATION_CANCEL_DOMAIN_ERRORS §10.7).
 *
 * Scenarios 1, 2, 5 run against the REAL stand: the operation is created and
 * submitted/deleted via the BFF API and the cancel reaches SyncServer, which
 * returns the problem envelope. Scenarios 3, 4, 6 create the operation via
 * the API too but intercept only the cancel endpoint so the envelope is fully
 * controlled (same pattern as submit-errors.spec.ts).
 *
 * Run: npx playwright test e2e/operations/operations-cancel.spec.ts
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

async function postJson(
  page: Page,
  url: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const csrf = await getCsrf(page);
  const res = await page.request.post(url, {
    data,
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRFToken': csrf } : {}) },
    failOnStatusCode: false,
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok(), status: res.status(), body };
}

interface CreatedOperation {
  id: string;
}

async function apiCreateDraft(
  page: Page,
  payload: Record<string, unknown>,
): Promise<CreatedOperation | null> {
  const { ok, body } = await postJson(page, `${BFF}/operations`, payload);
  if (!ok) return null;
  const id = (body as any)?.data?.id;
  if (!id) return null;
  return { id };
}

async function apiGetOperation(page: Page, id: string): Promise<Record<string, any> | null> {
  const res = await page.request.get(`${BFF}/operations/${id}`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  return body?.data ?? null;
}

async function apiSubmit(page: Page, id: string): Promise<boolean> {
  const { ok } = await postJson(page, `${BFF}/operations/${id}/submit`, { submit: true });
  return ok;
}

async function apiDelete(page: Page, id: string): Promise<boolean> {
  const csrf = await getCsrf(page);
  const res = await page.request.delete(`${BFF}/operations/${id}`, {
    headers: { ...(csrf ? { 'X-CSRFToken': csrf } : {}) },
    failOnStatusCode: false,
  });
  return res.ok();
}

interface SiteRef {
  site_id: string | number;
  name: string;
}

async function getSites(page: Page): Promise<SiteRef[]> {
  const res = await page.request.get(`${BFF}/catalog/sites`, { failOnStatusCode: false });
  if (!res.ok()) return [];
  const body = await res.json();
  return body?.data?.sites ?? [];
}

async function getAnyItem(page: Page): Promise<string | number | null> {
  const res = await page.request.get(`${BFF}/catalog/items?limit=10`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  const items: Array<{ id: string | number }> = body?.data?.items ?? [];
  return items[0]?.id ?? null;
}

/**
 * Any site + any item: enough for a RECEIVE, which needs no balance to be
 * created or submitted.
 */
async function findReceiveFixture(
  page: Page,
): Promise<{ siteId: string | number; itemId: string | number } | null> {
  const sites = await getSites(page);
  const itemId = await getAnyItem(page);
  if (sites.length === 0 || !itemId) return null;
  return { siteId: sites[0].site_id, itemId };
}

function receivePayload(
  runId: string,
  siteId: string | number,
  itemId: string | number,
  qty: string,
): Record<string, unknown> {
  return {
    type: 'RECEIVE',
    site_id: siteId,
    notes: `operations-cancel ${runId}`,
    client_request_id: crypto.randomUUID(),
    lines: [{ line_number: 1, item_id: itemId, qty }],
  };
}

// ─── UI helpers ────────────────────────────────────────────────────────────

async function openOperationsPage(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
}

async function rowByRunId(page: Page, runId: string) {
  return page.locator('[data-testid="operation-row"]', { hasText: runId }).first();
}

async function clickCancelWithDialog(
  page: Page,
  row: ReturnType<typeof rowByRunId>,
  accept: boolean,
): Promise<string | null> {
  const dialogPromise = new Promise<string | null>((resolve) => {
    page.once('dialog', async (dialog) => {
      const message = dialog.message();
      if (accept) await dialog.accept();
      else await dialog.dismiss();
      resolve(message);
    });
  });
  await row.locator('[data-testid="operation-action-cancel"]').click();
  return dialogPromise;
}

// ─── Mock envelopes (mirror of SyncServer cancel-flow, TZ §3.2/§5.3) ────────

function makeCancelRejectedEnvelope(lineIds: number[]): Record<string, unknown> {
  return {
    type: 'urn:warehouse:problem:operation-cancel-rejected',
    title: 'Операция не может быть отменена',
    status: 409,
    code: 'operation_cancel_rejected',
    detail:
      'Недостаточно товара: Кабель ВВГ — запрошено 2, на складе 0. Всего проблемных групп: 1.',
    instance: '/api/v1/operations/mock/cancel',
    errors: [
      {
        code: 'insufficient_stock',
        scope: 'line_group',
        operation_line_ids: lineIds,
        item: { id: 1001, name: 'Кабель ВВГ' },
        stock_site: { id: 1, name: 'Склад' },
        required_qty: '2',
        available_qty: '0',
      },
    ],
  };
}

/** Same envelope the real server emits for `role_not_permitted` (403). */
function makeRoleNotPermittedEnvelope(): Record<string, unknown> {
  return {
    type: 'urn:warehouse:problem:operation-cancel-rejected',
    title: 'Недостаточно прав',
    status: 403,
    code: 'role_not_permitted',
    detail: 'Недостаточно прав для проведения операции.',
    instance: '/api/v1/operations/mock/cancel',
    errors: [{ code: 'role_not_permitted', scope: 'operation' }],
  };
}

test.describe('Operation cancel domain-error surface (§10.7)', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
  });

  test('test_cancel_button_opens_confirm', async ({ page }) => {
    const fx = await findReceiveFixture(page);
    if (!fx) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(page, receivePayload(runId, fx.siteId, fx.itemId, '5'));
    if (!created) {
      test.skip(true, 'Could not create RECEIVE draft via API');
      return;
    }
    const submitted = await apiSubmit(page, created.id);
    if (!submitted) {
      test.skip(true, 'Could not submit the seeded operation');
      return;
    }

    await openOperationsPage(page);
    const row = await rowByRunId(page, runId);
    await expect(row).toBeVisible({ timeout: 10000 });

    const dialogMessage = await clickCancelWithDialog(page, row, false);
    expect(dialogMessage).toContain('Отменить операцию?');
  });

  test('test_cancel_happy_path_shows_success', async ({ page }) => {
    const fx = await findReceiveFixture(page);
    if (!fx) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(page, receivePayload(runId, fx.siteId, fx.itemId, '5'));
    if (!created) {
      test.skip(true, 'Could not create RECEIVE draft via API');
      return;
    }
    const submitted = await apiSubmit(page, created.id);
    if (!submitted) {
      test.skip(true, 'Could not submit the seeded operation');
      return;
    }

    await openOperationsPage(page);
    const row = await rowByRunId(page, runId);
    await expect(row).toBeVisible({ timeout: 10000 });

    await clickCancelWithDialog(page, row, true);

    // The operation becomes cancelled and the list is refreshed.
    await expect(row.locator('[data-testid="operation-status-cell"]')).toContainText('Отменена', {
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="operations-cancel-error-message"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="operations-error-message"]')).toHaveCount(0);
  });

  test('test_cancel_insufficient_stock_shows_russian_error', async ({ page }) => {
    const fx = await findReceiveFixture(page);
    if (!fx) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(page, receivePayload(runId, fx.siteId, fx.itemId, '5'));
    if (!created) {
      test.skip(true, 'Could not create RECEIVE draft via API');
      return;
    }
    const submitted = await apiSubmit(page, created.id);
    if (!submitted) {
      test.skip(true, 'Could not submit the seeded operation');
      return;
    }
    const dto = await apiGetOperation(page, created.id);
    const lineIds = (dto?.lines ?? []).map((l: any) => Number(l.id)).filter(Boolean);

    await page.route(`**${BFF}/operations/${created.id}/cancel`, route =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(makeCancelRejectedEnvelope(lineIds)),
      }),
    );

    await openOperationsPage(page);
    const row = await rowByRunId(page, runId);
    await expect(row).toBeVisible({ timeout: 10000 });

    await clickCancelWithDialog(page, row, true);

    // The banner shows the server's human-readable Russian detail, not the
    // legacy English «insufficient stock for ...» message.
    const banner = page.locator('[data-testid="operations-cancel-error-message"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText('Недостаточно товара: Кабель ВВГ');
    await expect(banner).not.toContainText('insufficient stock');
  });

  test('test_cancel_role_not_permitted_shows_403', async ({ page }) => {
    const fx = await findReceiveFixture(page);
    if (!fx) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(page, receivePayload(runId, fx.siteId, fx.itemId, '5'));
    if (!created) {
      test.skip(true, 'Could not create RECEIVE draft via API');
      return;
    }
    const submitted = await apiSubmit(page, created.id);
    if (!submitted) {
      test.skip(true, 'Could not submit the seeded operation');
      return;
    }

    // The real SyncServer 403 envelope for role_not_permitted is proxied
    // as-is by the Django BFF; its detail is «Недостаточно прав для
    // проведения операции.» (see operation_submit_errors.py).
    await page.route(`**${BFF}/operations/${created.id}/cancel`, route =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify(makeRoleNotPermittedEnvelope()),
      }),
    );

    await openOperationsPage(page);
    const row = await rowByRunId(page, runId);
    await expect(row).toBeVisible({ timeout: 10000 });

    await clickCancelWithDialog(page, row, true);

    const banner = page.locator('[data-testid="operations-cancel-error-message"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText('Недостаточно прав');
  });

  test('test_cancel_operation_not_found_shows_404', async ({ page }) => {
    const fx = await findReceiveFixture(page);
    if (!fx) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(page, receivePayload(runId, fx.siteId, fx.itemId, '5'));
    if (!created) {
      test.skip(true, 'Could not create RECEIVE draft via API');
      return;
    }

    await openOperationsPage(page);
    const row = await rowByRunId(page, runId);
    await expect(row).toBeVisible({ timeout: 10000 });

    // Delete the draft server-side; the rendered row stays stale, so the
    // cancel hits SyncServer with a missing operation → 404 envelope.
    const deleted = await apiDelete(page, created.id);
    if (!deleted) {
      test.skip(true, 'Could not delete the seeded draft via API');
      return;
    }

    await clickCancelWithDialog(page, row, true);

    const banner = page.locator('[data-testid="operations-cancel-error-message"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText('Операция не найдена.');
  });

  test('test_cancel_keeps_list_visible', async ({ page }) => {
    const fx = await findReceiveFixture(page);
    if (!fx) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }
    const runId = generateRunId();
    const created = await apiCreateDraft(page, receivePayload(runId, fx.siteId, fx.itemId, '5'));
    if (!created) {
      test.skip(true, 'Could not create RECEIVE draft via API');
      return;
    }
    const submitted = await apiSubmit(page, created.id);
    if (!submitted) {
      test.skip(true, 'Could not submit the seeded operation');
      return;
    }

    await page.route(`**${BFF}/operations/${created.id}/cancel`, route =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(makeCancelRejectedEnvelope([1])),
      }),
    );

    await openOperationsPage(page);
    const row = await rowByRunId(page, runId);
    await expect(row).toBeVisible({ timeout: 10000 });

    await clickCancelWithDialog(page, row, true);

    // A failed cancel must NOT replace the list with the banner: both the
    // banner and the table (with the operation still submitted) stay visible.
    await expect(page.locator('[data-testid="operations-cancel-error-message"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="operations-table"]')).toBeVisible();
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid="operation-status-cell"]')).not.toContainText('Отменена');
  });
});
