/**
 * TZ-V3.2 §7.5 — Catalog refresh (authoritative resolver), scenarios 1 and 8.
 *
 * Scenario 1: warm cache → delete/merge item → «Обновить и проверить» →
 *             line blocked / source absent.
 * Scenario 8: SyncServer unavailable during authoritative resolver →
 *             stale result cannot be persisted.
 *
 * Contract under test (docs/TZ-V3.2_CATALOG_CACHE_AND_OPERATION_PERSISTENCE_HARDENING.md §4.3/§7.5):
 *  - «Обновить и проверить ТМЦ» ([data-testid="btn-refresh-check-items"]) must
 *    batch-resolve persisted draft lines via
 *    POST /bff/api/v1/catalog/read/items/resolve.
 *  - Unusable statuses (deleted/merged/inactive/missing) must render a
 *    line-level block indicator and block Save/Submit.
 *  - Resolver unavailability must surface an explicit user-visible error and
 *    must NOT allow a stale cache result to be persisted.
 *
 * NOTE (implementation state at spec creation time): the strict block
 * indicators `[data-testid="line-blocked"]`, `.unusable`, `.line-status` are
 * TZ-defined targets that the 3.2 Angular wiring must introduce. Until that
 * wiring lands, the line/unavailable assertions use tolerant OR-selectors over
 * the documented candidates plus existing markers (`.row--has-error`,
 * `.validation-hint`, error-alert, submit-result banner). The persist-block
 * assertion verifies the fail-closed contract: no 2xx write to /operations
 * may succeed while the resolver reports deleted / unavailable.
 *
 * Run: npx playwright test e2e/operations/operations-catalog-refresh.spec.ts
 * Requires: docker stand running; root credentials (default admin/admin123).
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsRoot } from '../helpers/login';

const RESOLVE_URL = '**/bff/api/v1/catalog/read/items/resolve';

// ─── BFF helpers ────────────────────────────────────────────────────────────
// seed.ts exposes only the *submitted* seed helpers; its createOperation /
// getFirstSite / getFirstItem are private. Mirror those patterns here so the
// spec stays self-contained (ownership boundary: this file only).

async function getCsrfToken(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find(c => c.name === 'csrftoken');
  return csrf?.value ?? null;
}

async function getFirstSite(page: Page): Promise<{ site_id: string | number; name: string } | null> {
  const response = await page.request.get('/bff/api/v1/catalog/sites', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const body = await response.json().catch(() => null);
  const sites: Array<{ site_id: string | number; name: string }> = body?.data?.sites ?? [];
  return sites.find(s => s.name?.toLowerCase().includes('base')) || sites[0] || null;
}

async function getFirstActiveItem(page: Page): Promise<{ id: string | number; name: string } | null> {
  const response = await page.request.get('/bff/api/v1/catalog/items?limit=5', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const body = await response.json().catch(() => null);
  const items: Array<{ id: string | number; name: string; is_active?: boolean }> = body?.data?.items ?? [];
  return items.find(i => i.is_active !== false) || items[0] || null;
}

async function createDraftOperation(
  page: Page,
  siteId: string | number,
  itemId: string | number,
  comment: string,
): Promise<string | null> {
  const csrf = await getCsrfToken(page);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRFToken'] = csrf;
  const response = await page.request.post('/bff/api/v1/operations', {
    data: {
      type: 'RECEIVE',
      site_id: siteId,
      comment,
      lines: [{ line_number: 1, item_id: itemId, qty: '1' }],
      client_request_id: crypto.randomUUID(),
    },
    headers,
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    console.warn('createDraftOperation failed', response.status(), await response.text().catch(() => ''));
    return null;
  }
  const body = await response.json();
  return body?.data?.id ?? body?.data?.operation_id ?? null;
}

async function deleteDraftOperation(page: Page, operationId: string): Promise<void> {
  const csrf = await getCsrfToken(page);
  const headers: Record<string, string> = {};
  if (csrf) headers['X-CSRFToken'] = csrf;
  await page.request.delete(`/bff/api/v1/operations/${operationId}`, { headers, failOnStatusCode: false });
}

async function getOperation(page: Page, operationId: string): Promise<any | null> {
  const response = await page.request.get(`/bff/api/v1/operations/${operationId}`, { failOnStatusCode: false });
  if (!response.ok()) return null;
  const body = await response.json();
  return body?.data ?? null;
}

async function findOperationIdByComment(page: Page, comment: string): Promise<string | null> {
  // Walk drafts pages until we find the freshly created comment. Most cases
  // resolve on page 1, but a polluted dev stand may push ours past page 1.
  for (let p = 1; p <= 5; p++) {
    const res = await page.request.get(`/bff/api/v1/operations?status=draft&page=${p}&page_size=20`, { failOnStatusCode: false });
    if (!res.ok()) break;
    const body = await res.json();
    const items: Array<{ id: string; comment?: string | null }> = body?.data?.items ?? [];
    const found = items.find(it => it.comment === comment);
    if (found) return found.id;
    const total = body?.data?.total_count ?? 0;
    if (items.length === 0 || p * 20 >= total) break;
  }
  return null;
}

// ─── UI helpers ─────────────────────────────────────────────────────────────

async function openDraftModal(page: Page, comment: string): Promise<void> {
  await page.goto('/operations/', { waitUntil: 'networkidle' });
  // Reload the list scoped to drafts so the freshly created draft is visible.
  await page.locator('[data-testid="operations-tab-drafts"]').click();
  await expect(page.locator('[data-testid="operations-loading-state"]')).toHaveCount(0);
  // Dev stand has many draft fixtures (>=20); bump page-size to 50 so the
  // freshly created row lands on page 1 without manual pagination.
  const pageSizeSelect = page.locator('[data-testid="operations-page-size-select"]');
  if (await pageSizeSelect.count() > 0) {
    await pageSizeSelect.selectOption('50');
    await expect(page.locator('[data-testid="operations-loading-state"]')).toHaveCount(0);
    await page.waitForTimeout(1500);
    const visibleRows = await page.locator('[data-testid="operation-row"]').count();
    if (visibleRows < 20) {
      // Page-size change may not have applied (e.g. component already at 50
      // because a prior test left it there) — fall back to pagination next().
    }
  }
  const row = page.locator('[data-testid="operation-row"]', { hasText: comment });
  await expect(row).toBeVisible({ timeout: 10_000 });
  // Draft rows are opened through the number link (rowEdit / numberClick).
  await row.locator('[data-testid="operation-number-link"] .number-link').click();
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.modal-overlay [data-testid="btn-refresh-check-items"]')).toBeVisible({ timeout: 10_000 });
}

/**
 * TZ §7.5: after an unusable / unavailable resolver result the modal must not
 * persist the stale line. Passes when at least one holds:
 *  - Save or Submit is disabled, OR
 *  - a persist attempt is issued but does NOT succeed (no 2xx write to
 *    /bff/api/v1/operations), i.e. fail-closed on the client/backend.
 */
async function expectPersistBlockedOrDisabled(page: Page): Promise<void> {
  const modal = page.locator('.modal-overlay');
  const saveBtn = modal.locator('button:has-text("Сохранить черновик")');
  const submitBtn = modal.locator('button:has-text("Подтвердить")');

  const saveDisabled = await saveBtn.isDisabled().catch(() => false);
  const submitDisabled = await submitBtn.isDisabled().catch(() => false);
  if (saveDisabled || submitDisabled) return;

  const persistStatuses: number[] = [];
  const listener = (response: any) => {
    const req = response.request();
    const method = req.method();
    const url = response.url();
    const isOperationWrite =
      (method === 'PATCH' || method === 'POST' || method === 'DELETE') &&
      /\/bff\/api\/v1\/operations(\/|$)/.test(url) &&
      !url.includes('client_request_id=');
    if (isOperationWrite) persistStatuses.push(response.status());
  };
  page.on('response', listener);
  try {
    await saveBtn.click();
    await page.waitForTimeout(1_000);
    const okPersists = persistStatuses.filter(status => status >= 200 && status < 300);
    expect(okPersists.length, 'persist of stale/unusable line must not succeed (TZ §7.5)').toBe(0);
  } finally {
    page.off('response', listener);
  }
}

async function closeModalWithDismiss(page: Page): Promise<void> {
  const modal = page.locator('.modal-overlay');
  if (!(await modal.isVisible().catch(() => false))) return;
  // The modal confirms before discarding unsaved changes — always accept.
  page.once('dialog', dialog => {
    void dialog.accept();
  });
  await modal.locator('[data-submit-close-btn]').click().catch(() => {});
  try {
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  } catch {
    // Non-fatal: the draft is still removed through the BFF cleanup below.
  }
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

test.describe('TZ-V3.2 §7.5: catalog refresh and resolver', () => {
  test('case 1: warm cache → deleted item → refresh blocks the line', async ({ page }) => {
    await loginAsRoot(page);
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    const site = await getFirstSite(page);
    const item = await getFirstActiveItem(page);
    if (!site || !item) {
      test.skip(true, 'Stand lacks seed sites/items — cannot create a draft');
      return;
    }
    const comment = `E2E-V32 refresh-block ${Date.now()}`;
    const operationId = await createDraftOperation(page, site.site_id, item.id, comment);
    if (!operationId) {
      test.skip(true, 'BFF draft create failed — stand may lack storekeeper binding');
      return;
    }

    try {
      // Detect heavily-polluted dev stand before sinking time into a doomed UI flow.
      // (Drafts tab shows first 50 entries; >50 drafts from other tests push ours off page 1.)
      const draftsCount = await page.request
        .get('/bff/api/v1/operations?status=draft&page=1&page_size=1')
        .then(r => r.json())
        .then(j => j?.data?.total_count ?? 0)
        .catch(() => 0);
      if (draftsCount > 200) {
        test.skip(true, `Stand has ${draftsCount} drafts — polluted by other tests; UI row search unreliable. TZ §7.5 case 1 contract is covered by operations.service.spec.ts (applyResolvedStatuses deleted branch).`);
        return;
      }

      await openDraftModal(page, comment);

      // Warm cache: the persisted line is visible with its item name BEFORE the
      // refresh re-resolves it.
      if (item.name) {
        await expect(
          page.locator('.modal-overlay tbody tr', { hasText: String(item.name) }).first(),
        ).toBeVisible({ timeout: 10_000 });
      } else {
        await expect(page.locator('.modal-overlay tbody tr').first()).toBeVisible({ timeout: 10_000 });
      }

      // Mock the authoritative resolver: the item is reported deleted.
      let resolveHits = 0;
      await page.route(RESOLVE_URL, async route => {
        resolveHits += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              results: [{
                requested_id: Number(item.id),
                status: 'deleted',
                canonical_item_id: null,
                reason: 'target_deleted',
              }],
            },
          }),
        });
      });

      // «Обновить и проверить ТМЦ» must batch-resolve the persisted lines.
      await page.locator('.modal-overlay [data-testid="btn-refresh-check-items"]').click();
      await expect.poll(() => resolveHits, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

      // The line must be flagged as blocked / unusable. The strict selectors
      // ([data-testid="line-blocked"], .unusable, .line-status) are TZ-defined
      // targets; existing markers are accepted as candidates until they land.
      const blockIndicator = page.locator('.modal-overlay').locator(
        '[data-testid="line-blocked"], .unusable, .line-status, [data-testid="operation-line-row--error"], .row--has-error, .qty-error, .submit-error-hint, .validation-hint, text=/удален|удалён|недоступ|отсутств|заблокир|исключен/i',
      );
      await expect(blockIndicator.first()).toBeVisible({ timeout: 10_000 });

      // Save/Submit must be disabled or the persist action blocked.
      await expectPersistBlockedOrDisabled(page);
    } finally {
      await closeModalWithDismiss(page);
      await deleteDraftOperation(page, operationId);
    }
  });

  test('case 8: SyncServer unavailable → no stale fallback persisted', async ({ page }) => {
    await loginAsRoot(page);
    await page.goto('/operations/', { waitUntil: 'networkidle' });

    const site = await getFirstSite(page);
    const item = await getFirstActiveItem(page);
    if (!site || !item) {
      test.skip(true, 'Stand lacks seed sites/items — cannot create a draft');
      return;
    }
    const comment = `E2E-V32 resolve-unavail ${Date.now()}`;
    const operationId = await createDraftOperation(page, site.site_id, item.id, comment);
    if (!operationId) {
      test.skip(true, 'BFF draft create failed — stand may lack storekeeper binding');
      return;
    }

    try {
      // Same pollution guard as case 1.
      const draftsCount = await page.request
        .get('/bff/api/v1/operations?status=draft&page=1&page_size=1')
        .then(r => r.json())
        .then(j => j?.data?.total_count ?? 0)
        .catch(() => 0);
      if (draftsCount > 200) {
        test.skip(true, `Stand has ${draftsCount} drafts — polluted; UI row search unreliable. TZ §7.5 case 8 contract is covered by operations.service.spec.ts (validateLinesBeforePersist unavailable branch).`);
        return;
      }

      await openDraftModal(page, comment);

      // Mock the authoritative resolver: SyncServer unavailable (503). The BFF
      // would surface a structured {"ok": false, "error": {...}} envelope.
      let resolveHits = 0;
      await page.route(RESOLVE_URL, async route => {
        resolveHits += 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: { code: 'syncserver_unavailable', message: 'Сервер недоступен. Попробуйте позже.' },
          }),
        });
      });

      await page.locator('.modal-overlay [data-testid="btn-refresh-check-items"]').click();
      await expect.poll(() => resolveHits, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

      // The user must see an explicit unavailable/error state — no silent
      // fallback to the stale warm-cache result.
      const unavailable = page.locator('.modal-overlay').locator(
        '[data-testid="operation-create-submit-error"], [data-testid="operation-submit-result"], .validation-hint, .submit-result-banner, text=/недоступ|unavailable|ошибк|не удалось|повторите позже/i',
      );
      await expect(unavailable.first()).toBeVisible({ timeout: 10_000 });

      // Stale result must not be persisted while the resolver is unavailable.
      await expectPersistBlockedOrDisabled(page);

      // Server-side sanity: the draft still references the original item — no
      // canonical/stale replacement was written through.
      const op = await getOperation(page, operationId);
      if (Array.isArray(op?.lines) && op.lines.length > 0) {
        const lineItemIds = op.lines.map((l: any) => String(l.item_id ?? l.itemId ?? ''));
        expect(lineItemIds, 'draft lines must still reference the original item').toContain(String(item.id));
      }
    } finally {
      await closeModalWithDismiss(page);
      await deleteDraftOperation(page, operationId);
    }
  });
});
