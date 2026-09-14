/**
 * Stage 2 — inline temporary-item editing E2E.
 *
 * Verifies the Stage 2 contract from
 * docs/TZ_OPERATION_MODAL_INLINE_TEMP_ITEM_SEARCH_REFRESH_v1.0.md:
 *  - catalog rows stay read-only; inline temporary rows get an editable name;
 *  - rename commits locally (Enter/blur) and persists via Save draft + reload;
 *  - full card edit updates the same line in place (same clientKey);
 *  - the renamed temporary item materializes with the corrected name on submit
 *    (ADR-0033 review flow);
 *  - two same-named inline lines keep distinct clientKeys in the BFF payload.
 *
 * Run: npx playwright test e2e/operations/temporary-inline-edit.spec.ts
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

async function getAnyItem(page: Page): Promise<{ id: string | number; name: string } | null> {
  const res = await page.request.get(`${BFF}/catalog/items?limit=10`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  const item = (body?.data?.items ?? [])[0];
  return item ? { id: item.id, name: item.name } : null;
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

async function apiCreateDraft(
  page: Page,
  payload: Record<string, unknown>,
): Promise<{ id: string; body: any } | null> {
  const { ok, body } = await postJson(page, `${BFF}/operations`, payload);
  if (!ok) return null;
  const id = (body as any)?.data?.id;
  return id ? { id, body } : null;
}

async function apiGetOperation(page: Page, id: string): Promise<any | null> {
  const res = await page.request.get(`${BFF}/operations/${id}`, { failOnStatusCode: false });
  if (!res.ok()) return null;
  const body = await res.json();
  return body?.data ?? null;
}

async function getReviewBody(page: Page, search: string): Promise<string> {
  const res = await page.request.get(
    `${BFF}/review-items?search=${encodeURIComponent(search)}&page_size=20`,
    { failOnStatusCode: false },
  );
  if (!res.ok()) return '';
  return JSON.stringify(await res.json());
}

function receivePayload(runId: string, siteId: string | number, lines: Record<string, unknown>[]): Record<string, unknown> {
  return {
    type: 'RECEIVE',
    site_id: siteId,
    notes: runId,
    client_request_id: crypto.randomUUID(),
    lines: lines.map((line, idx) => ({ line_number: idx + 1, ...line })),
  };
}

// ─── UI helpers ────────────────────────────────────────────────────────────

async function openOperationsPage(page: Page): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
}

async function openRowModal(page: Page, runId: string): Promise<void> {
  const row = page.locator('[data-testid="operation-row"]', { hasText: runId }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.locator('.number-link').click();
  await expect(page.locator('[data-design-id="operation-modal"]')).toBeVisible({ timeout: 10000 });
}

function operationModal(page: Page) {
  return page.locator('[data-design-id="operation-modal"]');
}

async function saveDraftAndWait(page: Page, operationId: string): Promise<void> {
  const saved = page.waitForResponse(
    r => r.url().includes(`/operations/${operationId}`) && r.request().method() === 'PATCH',
    { timeout: 15000 },
  );
  await operationModal(page).locator('[data-design-id="save-draft-btn"]').click();
  await saved;
}

// ─── Scenarios ─────────────────────────────────────────────────────────────

test.describe('Stage 2 — inline temporary-item editing', () => {
  test.beforeEach(async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
  });

  test('catalog row stays read-only; inline rename survives save and reload', async ({ page }) => {
    const sites = await getSites(page);
    const item = await getAnyItem(page);
    const refs = await getTemporaryRefs(page);
    if (sites.length === 0 || !item || !refs) {
      test.skip(true, 'Stand has no site/item/unit/category fixture');
      return;
    }

    const runId = generateRunId();
    const seededName = `Stage2 draft ${runId}`;
    const created = await apiCreateDraft(
      page,
      receivePayload(runId, sites[0].site_id, [
        { item_id: item.id, qty: '2' },
        {
          temporary_item: {
            client_key: 'k-stage2-rename',
            name: seededName,
            unit_id: refs.unitId,
            category_id: refs.categoryId,
          },
          qty: '3',
        },
      ]),
    );
    if (!created) {
      test.skip(true, 'Could not seed a draft RECEIVE with a temporary line');
      return;
    }

    await openOperationsPage(page);
    await openRowModal(page, runId);
    const modal = operationModal(page);

    // Catalog row: no inline editing.
    const catalogRow = modal.locator('app-operation-lines-table tr', { hasText: item.name }).first();
    await expect(catalogRow).toBeVisible();
    await expect(catalogRow.locator('.inline-name-input')).toHaveCount(0);
    await expect(catalogRow.locator('.item-meta-id')).toBeVisible();

    // Inline row: editable name with the seeded value.
    const nameInput = modal.locator('.inline-name-input');
    await expect(nameInput).toHaveCount(1);
    await expect(nameInput).toHaveValue(seededName);

    const renamedName = `${seededName} FIXED`;
    await nameInput.fill(renamedName);
    await nameInput.press('Enter');
    await expect(nameInput).toHaveValue(renamedName);

    await saveDraftAndWait(page, created.id);

    // Server payload is canonical: new name, same clientKey.
    const dto = await apiGetOperation(page, created.id);
    const tempLine = (dto?.lines ?? []).find((l: any) => l.temporary_draft_payload);
    expect(tempLine?.temporary_draft_payload?.name).toBe(renamedName);
    expect(tempLine?.temporary_draft_payload?.client_key).toBe('k-stage2-rename');

    // Reload → the renamed value is restored from the server payload.
    await modal.locator('[data-design-id="modal-close-btn"]').click();
    await openOperationsPage(page);
    await openRowModal(page, runId);
    await expect(operationModal(page).locator('.inline-name-input')).toHaveValue(renamedName);
  });

  test('full card edit updates the same line in place (clientKey preserved)', async ({ page }) => {
    const sites = await getSites(page);
    const refs = await getTemporaryRefs(page);
    if (sites.length === 0 || !refs) {
      test.skip(true, 'Stand has no site/unit/category fixture');
      return;
    }

    const runId = generateRunId();
    const seededName = `Stage2 card ${runId}`;
    const created = await apiCreateDraft(
      page,
      receivePayload(runId, sites[0].site_id, [
        {
          temporary_item: {
            client_key: 'k-stage2-card',
            name: seededName,
            unit_id: refs.unitId,
            category_id: refs.categoryId,
          },
          qty: '1',
        },
      ]),
    );
    if (!created) {
      test.skip(true, 'Could not seed a draft RECEIVE with a temporary line');
      return;
    }

    await openOperationsPage(page);
    await openRowModal(page, runId);
    const modal = operationModal(page);

    await modal.locator('[data-testid="inline-card-edit"]').click();
    const card = page.locator('.modal-container--inline');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('h2')).toHaveText('Редактирование ТМЦ');
    await expect(card.locator('[data-testid="inline-item-name"]')).toHaveValue(seededName);

    const cardName = `${seededName} CARD`;
    await card.locator('[data-testid="inline-item-name"]').fill(cardName);
    await card.locator('[data-testid="inline-item-description"]').fill(`описание ${runId}`);
    await card.locator('[data-testid="inline-item-save"]').click();
    await expect(card).toHaveCount(0);

    // The row shows the updated name and the line was updated, not duplicated.
    await expect(modal.locator('.inline-name-input')).toHaveValue(cardName);
    await expect(modal.locator('app-operation-lines-table tbody tr')).toHaveCount(1);

    await saveDraftAndWait(page, created.id);
    const dto = await apiGetOperation(page, created.id);
    expect(dto?.lines?.length).toBe(1);
    expect(dto?.lines?.[0]?.temporary_draft_payload?.name).toBe(cardName);
    expect(dto?.lines?.[0]?.temporary_draft_payload?.description).toBe(`описание ${runId}`);
    expect(dto?.lines?.[0]?.temporary_draft_payload?.client_key).toBe('k-stage2-card');
  });

  test('renamed temporary item materializes with the corrected name on submit', async ({ page }) => {
    const sites = await getSites(page);
    const refs = await getTemporaryRefs(page);
    if (sites.length === 0 || !refs) {
      test.skip(true, 'Stand has no site/unit/category fixture');
      return;
    }

    const runId = generateRunId();
    const seededName = `Stage2 submit ${runId}`;
    const correctedName = `Stage2 submit ${runId} FIXED`;
    const created = await apiCreateDraft(
      page,
      receivePayload(runId, sites[0].site_id, [
        {
          temporary_item: {
            client_key: 'k-stage2-submit',
            name: seededName,
            unit_id: refs.unitId,
            category_id: refs.categoryId,
          },
          qty: '1',
        },
      ]),
    );
    if (!created) {
      test.skip(true, 'Could not seed a draft RECEIVE with a temporary line');
      return;
    }

    await openOperationsPage(page);
    await openRowModal(page, runId);
    const modal = operationModal(page);
    const nameInput = modal.locator('.inline-name-input');
    await nameInput.fill(correctedName);
    await nameInput.press('Enter');

    const submitted = page.waitForResponse(
      r => r.url().includes(`/operations/${created.id}/submit`) && r.request().method() === 'POST',
      { timeout: 20000 },
    );
    await modal.locator('[data-design-id="submit-btn"]').click();
    await submitted;

    const dto = await apiGetOperation(page, created.id);
    expect(dto?.status).toBe('submitted');
    const line = dto?.lines?.[0];
    expect(line?.item_id).toBeTruthy();
    const lineName = String(line?.item_name ?? line?.item_name_snapshot ?? '');
    expect(lineName).toContain(correctedName);

    // ADR-0033 review flow receives the corrected name.
    const reviewBody = await getReviewBody(page, correctedName);
    expect(reviewBody).toContain(correctedName);
  });

  test('two same-named inline lines reach the backend with distinct clientKeys', async ({ page }) => {
    const sites = await getSites(page);
    if (sites.length === 0) {
      test.skip(true, 'No site available on the stand');
      return;
    }

    await openOperationsPage(page);
    await page.locator('[data-testid="operations-create-button"]').click();
    const modal = operationModal(page);
    await expect(modal).toBeVisible({ timeout: 10000 });

    await modal.locator('select').first().selectOption('RECEIVE');
    const siteSelect = modal.locator('select').nth(1);
    const siteValue = await siteSelect
      .locator('option[value]:not([value=""])')
      .first()
      .getAttribute('value');
    if (!siteValue) {
      test.skip(true, 'No warehouse option in the create modal');
      return;
    }
    await siteSelect.selectOption(siteValue);

    const sameName = `Stage2 dup key ${generateRunId()}`;
    for (let i = 0; i < 2; i++) {
      await modal.locator('[data-design-id="item-create-btn"]').click();
      const card = page.locator('.modal-container--inline');
      await expect(card).toBeVisible({ timeout: 5000 });
      await card.locator('[data-testid="inline-item-name"]').fill(sameName);
      await card.locator('[data-testid="inline-item-save"]').click();
      await expect(card).toHaveCount(0);
    }

    await expect(modal.locator('.inline-name-input')).toHaveCount(2);
    await expect(modal.locator('.inline-name-input').first()).toHaveValue(sameName);

    // Newly added lines start with an empty quantity — fill both so the draft
    // can be saved (quantity is a required draft field).
    await modal.locator('.qty-input').nth(0).fill('1');
    await modal.locator('.qty-input').nth(1).fill('2');

    const created = page.waitForResponse(
      r => r.url().includes('/operations') && r.request().method() === 'POST',
      { timeout: 15000 },
    );
    await modal.locator('[data-design-id="save-draft-btn"]').click();
    const response = await created;
    const body = await response.json();
    const operationId = body?.data?.id;
    expect(operationId).toBeTruthy();

    const dto = await apiGetOperation(page, operationId);
    const tempLines = (dto?.lines ?? []).filter((l: any) => l.temporary_draft_payload);
    expect(tempLines.length).toBe(2);
    const keys = tempLines.map((l: any) => l.temporary_draft_payload.client_key);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[0]).not.toBe(keys[1]);
    for (const line of tempLines) {
      expect(line.temporary_draft_payload.name).toBe(sameName);
    }
  });
});
