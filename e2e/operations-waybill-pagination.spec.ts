import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { loginAsRoot } from './helpers/login';
import { installNetworkGuard } from './helpers/network-guard';

/**
 * TZ V3.1I Stage I7 — UI automation for waybill PDF pagination.
 *
 * The Django BFF serves PDF as `Content-Type: application/pdf` inline, so the
 * browser's built-in PDF viewer exposes no DOM to Playwright. This test
 * (rev. 2 of warning #11 in the architecture review) verifies the PDF at the
 * HTTP boundary:
 *
 *   1. status 200
 *   2. content-type: application/pdf
 *   3. cache header `X-Document-Pdf-Cache` = hit|miss
 *   4. body size between 5KB and 500KB
 *   5. pdftotext extraction contains the expected waybill fragments
 *      (Накладная №, Кладовщик, Грузоотправитель, Грузополучатель, Основание,
 *       and Лист X из Y for multi-page operations)
 *
 * The Angular "Накладная" button is `[data-testid="operation-action-pdf"]`
 * (see `src/app/features/operations/components/operations-table/operations-table.component.ts:104`).
 * It posts to `/bff/api/v1/documents/operations/<id>/waybill/open` and receives
 * `{ pdf_url: "/documents/<doc_id>/pdf/" }` which is then opened via
 * `window.open`. We intercept the BFF response, read `pdf_url`, and fetch
 * the PDF directly via Playwright's APIRequestContext.
 *
 * The test is flexible about the source operation:
 *   - If `OPERATION_ID` env var is set, we filter the drafts tab by that id
 *     and require all content assertions (incl. the multi-page "Лист X из Y").
 *   - Otherwise we use the first available draft/submitted operation that
 *     exposes the PDF button. The "Лист X из Y" assertion is skipped in that
 *     case because single-page drafts do not render the sheet counter
 *     (per `waybill_pdf.html:209` `{% if total_pages > 1 %}`).
 *   - If no draft/submitted operations are present, the test is skipped
 *     with a clear reason.
 */

const PDF_SIZE_MIN_BYTES = 5 * 1024;
const PDF_SIZE_MAX_BYTES = 500 * 1024;
const WAYBILL_OPEN_PATH = '/bff/api/v1/documents/operations/';
const WAYBILL_OPEN_SUFFIX = '/waybill/open';

test.describe('Waybill PDF (TZ V3.1I I7)', () => {
  test('serves PDF with correct content-type and pagination text', async ({ page }) => {
    installNetworkGuard(page);
    await loginAsRoot(page);
    await page.goto('/operations/', { waitUntil: 'load' });

    // The PDF endpoint requires Django session auth. Use page.context().request
    // so the Django session cookie from the page is reused — Playwright's bare
    // `request` fixture creates a fresh APIRequestContext with no cookies.
    const request = page.context().request;

    // Switch to the drafts tab so the PDF button is most likely enabled.
    const draftsTab = page.locator('[data-testid="operations-tab-drafts"]');
    if (await draftsTab.isVisible().catch(() => false)) {
      await draftsTab.click();
      await expect(page.locator('[data-testid="operations-loading-state"]')).toHaveCount(0, { timeout: 10000 });
    }

    const envOperationId = process.env.OPERATION_ID?.trim();

    // Resolve which row to click. If OPERATION_ID is set, pick the matching row;
    // otherwise pick the first row that has an enabled PDF button.
    let pdfButton = page.locator('[data-testid="operation-action-pdf"]:not([disabled])').first();

    if (envOperationId) {
      const numberLink = page.locator('[data-testid="operation-number-link"]', { hasText: envOperationId }).first();
      if (!(await numberLink.isVisible().catch(() => false))) {
        test.skip(true, `OPERATION_ID=${envOperationId} не найден в drafts на стенде`);
        return;
      }
      const row = numberLink.locator('xpath=ancestor::tr[1]');
      pdfButton = row.locator('[data-testid="operation-action-pdf"]');
      if (await pdfButton.isDisabled().catch(() => true)) {
        test.skip(true, `OPERATION_ID=${envOperationId} найден, но накладная недоступна (статус не draft/submitted)`);
        return;
      }
    }

    if (!(await pdfButton.isVisible().catch(() => false))) {
      test.skip(true, 'Нет draft/submitted операций с доступной накладной на стенде');
      return;
    }

    // Angular opens a popup (`window.open('', '_blank')`) before the BFF POST.
    // We don't navigate the popup; we capture the BFF response directly and
    // close any popup that was spawned.
    const popupPromise = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);

    const openResponsePromise = page.waitForResponse(
      response => {
        if (response.request().method() !== 'POST' || response.status() !== 200) return false;
        const url = response.url();
        return url.includes(WAYBILL_OPEN_PATH) && url.includes(WAYBILL_OPEN_SUFFIX);
      },
      { timeout: 30000 },
    );

    await pdfButton.click();
    const openResponse = await openResponsePromise;

    let openBody: any;
    try {
      openBody = await openResponse.json();
    } catch (err) {
      throw new Error(`BFF waybill/open вернул не-JSON: ${(err as Error).message}`);
    }

    const pdfUrl = openBody?.data?.pdf_url;
    expect(pdfUrl, 'BFF должен вернуть pdf_url в data.pdf_url').toBeTruthy();
    expect(typeof pdfUrl).toBe('string');
    expect(pdfUrl).toMatch(/^\/documents\/[^/]+\/pdf\/?$/);

    // Close popup if it was created (it may have navigated to the PDF inline).
    const popup = await popupPromise;
    if (popup && !popup.isClosed()) {
      await popup.close({ runBeforeUnload: false }).catch(() => undefined);
    }

    // 1) HTTP boundary checks.
    const pdfResponse = await request.get(pdfUrl!);
    expect(pdfResponse.status(), `PDF ${pdfUrl} должен вернуть 200`).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    expect(pdfResponse.headers()['x-document-pdf-cache']).toMatch(/^(hit|miss)$/);

    // 2) Body size sanity.
    const pdfBytes = await pdfResponse.body();
    expect(pdfBytes.length, 'PDF не должен быть пустым').toBeGreaterThan(0);
    expect(pdfBytes.length, 'PDF должен быть > 5KB').toBeGreaterThan(PDF_SIZE_MIN_BYTES);
    expect(pdfBytes.length, 'PDF должен быть < 500KB').toBeLessThan(PDF_SIZE_MAX_BYTES);

    // PDF magic header check (%PDF-).
    const header = pdfBytes.subarray(0, 5).toString('ascii');
    expect(header, 'PDF должен начинаться с %PDF-').toBe('%PDF-');

    // 3) pdftotext extraction and content asserts.
    const tmpPath = path.join('/tmp', `waybill-e2e-${Date.now()}-${process.pid}.pdf`);
    fs.writeFileSync(tmpPath, pdfBytes);
    let text: string;
    try {
      text = execSync(`pdftotext -layout ${tmpPath} -`, { encoding: 'utf-8', maxBuffer: 4 * 1024 * 1024 });
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore cleanup errors
      }
    }

    // Заголовок "Накладная № <display_number>".
    expect(text, 'PDF должен содержать "Накладная № <номер>"').toMatch(/Накладная №\s+\S+/);

    // Реквизиты шапки (только на 1й странице — `is_first` в шаблоне).
    expect(text, 'PDF должен содержать "Грузоотправитель:"').toMatch(/Грузоотправитель:/);
    expect(text, 'PDF должен содержать "Грузополучатель:"').toMatch(/Грузополучатель:/);
    expect(text, 'PDF должен содержать "Основание:"').toMatch(/Основание:/);

    // Подпись — на каждой странице (per I1.2 signature-block).
    expect(text, 'PDF должен содержать "Кладовщик:"').toMatch(/Кладовщик:/);

    // "Лист X из Y" — шаблон рендерит счётчик только при total_pages > 1
    // (waybill_pdf.html:209). Однолистовые черновики не имеют этой строки,
    // поэтому ассерт строгий только при наличии OPERATION_ID (multi-page fixture).
    if (envOperationId) {
      expect(text, 'Многостраничная накладная должна содержать "Лист X из Y"').toMatch(/Лист \d+ из \d+/);
    } else {
      // Best-effort: либо "Лист X из Y" (multi-page), либо 1-page draft.
      // Не ассертим жёстко, чтобы тест не ломался на однолистовых черновиках.
      test.info().annotations.push({
        type: 'note',
        description: 'OPERATION_ID не задан; ассерт "Лист X из Y" опционален (рендерится только при total_pages > 1).',
      });
    }
  });
});
