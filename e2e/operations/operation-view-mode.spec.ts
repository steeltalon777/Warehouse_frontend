/**
 * Stage 1 — Operation Modal UX cleanup E2E.
 *
 * Verifies the VIEW-only contract for conducted/cancelled operations and the
 * Stage 1 UX corrections (techlead corrections to
 * docs/TZ_OPERATION_MODAL_INLINE_TEMP_ITEM_SEARCH_REFRESH_v1.0.md):
 *  - submitted → title «Просмотр операции», no save/submit/remove, qty disabled;
 *  - cancelled → title «Операция отменена», no save/submit/remove;
 *  - «Создать ТМЦ» is offered only for RECEIVE operations;
 *  - temporary-item pills are gone (compact counter only).
 *
 * Run: npx playwright test e2e/operations/operation-view-mode.spec.ts
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
  return cookies.find(c => c.name === 'csrftoken')?.value ?? '';
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

async function getSites(page: Page): Promise<Array<{ site_id: string | number; name: string }>> {
  const res = await page.request.get(`${BFF}/catalog/sites`, { failOnStatusCode: false });
  if (!res.ok()) return [];
  const body = await res.json();
  return body?.data?.sites ?? [];
}

async function getAnyItem(page: Page): Promise<string | number | null> {
  const res = await page.request.get(`${BFF}/catalog/items?limit=10`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  return (body?.data?.items ?? [])[0]?.id ?? null;
}

interface TemporaryRefs {
  unitId: string | number;
  categoryId: string | number;
}

async function getTemporaryRefs(page: Page): Promise<TemporaryRefs | null> {
  const [unitsRes, categoriesRes] = await Promise.all([
    page.request.get(`${BFF}/catalog/units`, { failOnStatusCode: false }),
    page.request.get(`${BFF}/catalog/categories`, { failOnStatusCode: false }),
  ]);
  if (!unitsRes.ok() || !categoriesRes.ok()) return null;
  const unitsBody = await unitsRes.json();
  const categoriesBody = await categoriesRes.json();
  const units = unitsBody?.data?.units ?? unitsBody?.data ?? [];
  const categories = categoriesBody?.data?.categories ?? categoriesBody?.data ?? [];
  if (units.length === 0 || categories.length === 0) return null;
  return { unitId: units[0].id, categoryId: categories[0].id };
}

function receivePayload(
  runId: string,
  siteId: string | number,
  line: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: 'RECEIVE',
    site_id: siteId,
    notes: runId,
    client_request_id: crypto.randomUUID(),
    lines: [{ line_number: 1, qty: '5', ...line }],
  };
}

async function apiCreateDraft(
  page: Page,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const { ok, body } = await postJson(page, `${BFF}/operations`, payload);
  if (!ok) return null;
  return (body as any)?.data?.id ?? null;
}

async function apiSubmit(page: Page, id: string): Promise<boolean> {
  const { ok } = await postJson(page, `${BFF}/operations/${id}/submit`, { submit: true });
  return ok;
}

async function apiCancel(page: Page, id: string): Promise<boolean> {
  const { ok } = await postJson(page, `${BFF}/operations/${id}/cancel`, { cancel: true });
  return ok;
}

// ─── UI helpers ────────────────────────────────────────────────────────────

async function openOperationsPage(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
}

async function openRowModal(page: Page, runId: string): Promise<void> {
  const row = page.locator('[data-testid="operation-row"]', { hasText: runId }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator('.number-link').click();
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10000 });
}

test.describe('Stage 1 — Operation Modal view mode', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
  });

  test('submitted operation opens as read-only «Просмотр операции»', async ({ page }) => {
    const sites = await getSites(page);
    const itemId = await getAnyItem(page);
    if (sites.length === 0 || !itemId) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }

    const runId = generateRunId();
    const operationId = await apiCreateDraft(
      page,
      receivePayload(runId, sites[0].site_id, { item_id: itemId }),
    );
    if (!operationId || !(await apiSubmit(page, operationId))) {
      test.skip(true, 'Could not seed a submitted RECEIVE operation');
      return;
    }

    await openOperationsPage(page);
    await openRowModal(page, runId);

    const modal = page.locator('.modal-overlay');
    await expect(modal.locator('[data-design-id="modal-title"]')).toHaveText('Просмотр операции');

    // No mutation affordances.
    await expect(modal.locator('[data-design-id="save-draft-btn"]')).toHaveCount(0);
    await expect(modal.locator('[data-design-id="submit-btn"]')).toHaveCount(0);
    await expect(modal.locator('.remove-btn')).toHaveCount(0);

    // Domain fields are rendered as read-only values, not controls.
    await expect(modal.locator('select')).toHaveCount(0);
    await expect(modal.locator('textarea')).toHaveCount(0);
    await expect(modal.locator('input[type="datetime-local"]')).toHaveCount(0);

    // Qty is a real disabled control (Stage 1 requirement).
    const qty = modal.locator('.qty-input').first();
    await expect(qty).toBeDisabled();
  });

  test('cancelled operation opens as read-only «Операция отменена»', async ({ page }) => {
    const sites = await getSites(page);
    const itemId = await getAnyItem(page);
    if (sites.length === 0 || !itemId) {
      test.skip(true, 'No site/item available on the stand');
      return;
    }

    const runId = generateRunId();
    const operationId = await apiCreateDraft(
      page,
      receivePayload(runId, sites[0].site_id, { item_id: itemId }),
    );
    if (!operationId || !(await apiSubmit(page, operationId)) || !(await apiCancel(page, operationId))) {
      test.skip(true, 'Could not seed a cancelled RECEIVE operation');
      return;
    }

    await openOperationsPage(page);
    await openRowModal(page, runId);

    const modal = page.locator('.modal-overlay');
    await expect(modal.locator('[data-design-id="modal-title"]')).toHaveText('Операция отменена');
    await expect(modal.locator('[data-design-id="save-draft-btn"]')).toHaveCount(0);
    await expect(modal.locator('[data-design-id="submit-btn"]')).toHaveCount(0);
    await expect(modal.locator('.remove-btn')).toHaveCount(0);
    await expect(modal.locator('.qty-input').first()).toBeDisabled();
  });

  test('«Создать ТМЦ» is offered only for RECEIVE', async ({ page }) => {
    await openOperationsPage(page);
    await page.locator('[data-testid="operations-create-button"]').click();
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10000 });

    const modal = page.locator('.modal-overlay');
    const typeSelect = modal.locator('select').first();
    const createBtn = modal.locator('[data-design-id="item-create-btn"]');

    // Default create type is MOVE — inline ТМЦ creation must not be offered.
    await expect(createBtn).toHaveCount(0);

    for (const type of ['EXPENSE', 'ISSUE', 'WRITE_OFF'] as const) {
      await typeSelect.selectOption(type);
      await expect(createBtn).toHaveCount(0);
    }

    await typeSelect.selectOption('RECEIVE');
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeEnabled();
  });

  test('temporary-item pills are replaced by the compact counter', async ({ page }) => {
    const sites = await getSites(page);
    const refs = await getTemporaryRefs(page);
    if (sites.length === 0 || !refs) {
      test.skip(true, 'Stand has no site/unit/category fixture');
      return;
    }

    const runId = generateRunId();
    const operationId = await apiCreateDraft(
      page,
      receivePayload(runId, sites[0].site_id, {
        temporary_item: {
          client_key: 'k1',
          name: `Stage1 TMP ${Date.now()}`,
          unit_id: refs.unitId,
          category_id: refs.categoryId,
        },
      }),
    );
    if (!operationId) {
      test.skip(true, 'Could not seed a draft RECEIVE with a temporary line');
      return;
    }

    await openOperationsPage(page);
    await openRowModal(page, runId);

    const modal = page.locator('.modal-overlay');
    await expect(modal).not.toContainText('Временные позиции в операции');
    await expect(modal.locator('.inline-item-chip')).toHaveCount(0);

    const counter = modal.locator('[data-testid="inline-items-count"]');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveText('Новых позиций: 1');

    // The draft is still editable: remove stays available in draft mode.
    await expect(modal.locator('.remove-btn').first()).toBeVisible();
  });
});
