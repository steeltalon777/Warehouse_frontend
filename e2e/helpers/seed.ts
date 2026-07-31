import { Page } from '@playwright/test';

export interface SeedOperationResult {
  operationId: string;
  runId: string;
  number?: string;
}

export function generateRunId(): string {
  return `E2E_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function createReceiveDraftViaUI(
  page: Page,
  siteName: string,
  itemQuery: string,
  qty: string
): Promise<SeedOperationResult> {
  // TODO: implement via UI once selectors are stable
  throw new Error('createReceiveDraftViaUI not yet implemented');
}

// ─── BFF seed helpers ───

interface SiteDto {
  site_id: string | number;
  name: string;
}

interface ItemDto {
  id: string | number;
  name: string;
  sku?: string | null;
  is_active?: boolean;
}

async function _tryJson<T>(response: any): Promise<T | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getFirstSite(page: Page): Promise<SiteDto | null> {
  const response = await page.request.get('/bff/api/v1/catalog/sites', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const payload = await _tryJson<Record<string, unknown>>(response);
  if (!payload) return null;
  const sites: SiteDto[] = (payload?.data as any)?.sites ?? (payload?.data as any) ?? [];
  return sites.find(s => s.name?.toLowerCase().includes('base')) || sites[0] || null;
}

async function getFirstItem(page: Page): Promise<ItemDto | null> {
  const response = await page.request.get('/bff/api/v1/catalog/items?limit=20', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const payload = await _tryJson<Record<string, unknown>>(response);
  if (!payload) return null;
  const items: ItemDto[] = (payload?.data as any)?.items ?? (payload?.data as any) ?? [];
  return items.find(i => i.is_active !== false) || items[0] || null;
}

export async function getActiveItems(page: Page, limit: number = 10): Promise<ItemDto[]> {
  const response = await page.request.get(`/bff/api/v1/catalog/items?limit=${limit}`, { failOnStatusCode: false });
  if (!response.ok()) return [];
  const payload = await _tryJson<Record<string, unknown>>(response);
  if (!payload) return [];
  const items: ItemDto[] = (payload?.data as any)?.items ?? (payload?.data as any) ?? [];
  return items.filter(i => i.is_active !== false);
}

interface BalanceRow {
  site_id: number;
  item_id: number;
  qty: string;
  item_name: string;
}

async function getItemWithStockAtSite(page: Page, siteId: string | number): Promise<ItemDto | null> {
  const response = await page.request.get(`/bff/api/v1/balances?site_id=${siteId}&limit=20`, { failOnStatusCode: false });
  if (!response.ok()) return null;
  const payload = await _tryJson<Record<string, unknown>>(response);
  if (!payload) return null;
  const rows: BalanceRow[] = (payload?.data as any)?.items ?? (payload?.data as any) ?? [];
  const row = rows.find(r => parseFloat(r.qty) > 0);
  if (!row) return null;
  return { id: row.item_id, name: row.item_name };
}

async function getTwoSites(page: Page): Promise<[SiteDto, SiteDto] | null> {
  const response = await page.request.get('/bff/api/v1/catalog/sites', { failOnStatusCode: false });
  if (!response.ok()) return null;
  const payload = await _tryJson<Record<string, unknown>>(response);
  if (!payload) return null;
  const sites: SiteDto[] = (payload?.data as any)?.sites ?? (payload?.data as any) ?? [];
  if (sites.length < 2) return null;
  return [sites[0], sites[1]];
}

async function getCsrfToken(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const csrfCookie = cookies.find(c => c.name === 'csrftoken');
  return csrfCookie?.value ?? null;
}

async function createOperation(
  page: Page,
  payload: Record<string, unknown>
): Promise<string | null> {
  const csrf = await getCsrfToken(page);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRFToken'] = csrf;
  // SyncServer requires a non-empty client_request_id. Keep caller override support.
  const body = {
    ...payload,
    client_request_id: payload.client_request_id ?? crypto.randomUUID(),
  };
  const response = await page.request.post('/bff/api/v1/operations', {
    data: body,
    headers,
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const text = await response.text().catch(() => '');
    console.warn('createOperation failed', response.status(), text);
    return null;
  }
  const responseBody = await response.json();
  return responseBody?.data?.id ?? responseBody?.data?.operation_id ?? null;
}

async function getOperationNumber(page: Page, operationId: string): Promise<string | null> {
  const response = await page.request.get(`/bff/api/v1/operations/${operationId}`, { failOnStatusCode: false });
  if (!response.ok()) return null;
  const body = await response.json();
  return body?.data?.number ?? body?.data?.display_number ?? null;
}

async function updateOperation(
  page: Page,
  operationId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const csrf = await getCsrfToken(page);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRFToken'] = csrf;
  const response = await page.request.patch(`/bff/api/v1/operations/${operationId}`, {
    data: payload,
    headers,
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const text = await response.text().catch(() => '');
    console.warn('updateOperation failed', response.status(), text);
    return false;
  }
  return true;
}

async function submitOperation(
  page: Page,
  operationId: string
): Promise<boolean> {
  const csrf = await getCsrfToken(page);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-CSRFToken'] = csrf;
  const response = await page.request.post(`/bff/api/v1/operations/${operationId}/submit`, {
    data: { submit: true },
    headers,
    failOnStatusCode: false,
  });
  if (!response.ok()) {
    const text = await response.text().catch(() => '');
    console.warn('submitOperation failed', response.status(), text);
    return false;
  }
  return true;
}

export async function seedSubmittedReceiveOperation(
  page: Page,
  runId?: string
): Promise<SeedOperationResult | null> {
  const site = await getFirstSite(page);
  const item = await getFirstItem(page);
  if (!site || !item) {
    console.warn('seedSubmittedReceiveOperation: missing site or item');
    return null;
  }

  const id = await createOperation(page, {
    type: 'RECEIVE',
    site_id: site.site_id,
    comment: `E2E receive ${runId ?? generateRunId()}`,
    lines: [
      {
        line_number: 1,
        item_id: item.id,
        qty: '10',
      },
    ],
  });
  if (!id) return null;

  const submitted = await submitOperation(page, id);
  if (!submitted) return null;

  const number = await getOperationNumber(page, id);
  return { operationId: id, runId: runId ?? generateRunId(), number };
}

export async function seedSubmittedMoveOperation(
  page: Page,
  runId?: string
): Promise<SeedOperationResult | null> {
  const sites = await getTwoSites(page);
  if (!sites) {
    console.warn('seedSubmittedMoveOperation: missing sites');
    return null;
  }

  const [source, dest] = sites;
  const item = await getItemWithStockAtSite(page, source.site_id);
  if (!item) {
    console.warn('seedSubmittedMoveOperation: no item with stock at source site');
    return null;
  }

  const id = await createOperation(page, {
    type: 'MOVE',
    site_id: source.site_id,
    source_site_id: source.site_id,
    destination_site_id: dest.site_id,
    comment: `E2E move ${runId ?? generateRunId()}`,
    lines: [
      {
        line_number: 1,
        item_id: item.id,
        qty: '5',
      },
    ],
  });
  if (!id) return null;

  const submitted = await submitOperation(page, id);
  if (!submitted) return null;

  const number = await getOperationNumber(page, id);
  return { operationId: id, runId: runId ?? generateRunId(), number };
}

export async function seedSubmittedReceiveOperationWithLines(
  page: Page,
  lines: { itemId: string | number; qty: string }[],
  runId?: string
): Promise<SeedOperationResult | null> {
  const site = await getFirstSite(page);
  if (!site) {
    console.warn('seedSubmittedReceiveOperationWithLines: missing site');
    return null;
  }

  const id = await createOperation(page, {
    type: 'RECEIVE',
    site_id: site.site_id,
    comment: `E2E receive multi ${runId ?? generateRunId()}`,
    lines: lines.map((l, idx) => ({
      line_number: idx + 1,
      item_id: l.itemId,
      qty: l.qty,
    })),
  });
  if (!id) return null;

  const submitted = await submitOperation(page, id);
  if (!submitted) return null;

  const number = await getOperationNumber(page, id);
  return { operationId: id, runId: runId ?? generateRunId(), number };
}
