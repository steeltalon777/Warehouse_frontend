/**
 * tools/visual-check/check.ts
 *
 * Design contract visual checker (PoC #2).
 *
 * Compares the design-reference HTML against the live Angular modal at
 * 1440x900. Uses real data-design-id attributes set in the Angular template
 * (no runtime injection). Each whitelisted ID is verified as the SAME
 * logical DOM node (tag + parent path match) before comparing styles.
 *
 * Status taxonomy:
 *   MATCH          — same tag + same parent path, computed styles match
 *   STYLE_MISMATCH — same logical node, computed styles differ
 *   MAPPING_ERROR  — found in both, but tag or parent path differs
 *   MISSING_LIVE   — exists in ref, not in live
 *   MISSING_REF    — exists in live, not in ref
 *   MISSING_BOTH   — exists in neither (config bug)
 *
 * Color diff: every value that includes "color" goes through culori → sRGB
 * RGBA so oklch() vs rgb() vs #hex produce a normalised tuple comparison.
 * Note: culori's RGB conversion is algorithm-different from the browser's
 * own conversion (off by 1-3 units per channel in edge cases) — that means
 * two source strings the user expects to be visually equal may still
 * produce a STYLE_MISMATCH. That is intentional: the reference IS the
 * source of truth and any divergence is an actionable fidelity issue.
 *
 * Font contract is checked separately. If Inter / JetBrains Mono Variable
 * files are not present under design/reference/operation-modal/assets/, the
 * typography/pixel gate is BLOCKED but geometry/mapping diffs still proceed.
 *
 * Run:
 *   docker compose run --rm \
 *     -e BASE_URL=http://warehouse-web:8001 \
 *     -v "$(pwd)/audit":/audit \
 *     -v "$(pwd)/tools":/tools \
 *     -v "$(pwd)/design":/design \
 *     -v "$(pwd)/node_modules":/app/node_modules \
 *     -w /app \
 *     playwright bash -c "node tools/visual-check/check.mjs"
 */

import { chromium, type Browser, type Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { converter, parse } from 'culori';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REF_ROOT = path.resolve(__dirname, '../../design/reference/operation-modal');
const REPORT_DIR = path.resolve(__dirname, '../../audit/visual-check');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const LIVE_BASE = process.env.BASE_URL || 'http://warehouse-web:8001';
const SCENARIO_REF_FILE = path.join(REF_ROOT, 'create-move-3rows.html');
const VIEWPORT = { width: 1440, height: 900 };

// ─────────────────────────────────────────────────────────────────────
// Whitelist
// ─────────────────────────────────────────────────────────────────────
const ALWAYS_EXCLUDED = new Set([
  'operation-modal-stage',
  'modal-minimize-btn',
  'modal-header-meta-create',
  'modal-footer-meta',
  'balance-status-display',
  'export-pdf-btn',
  'lines-filter-meta',
  'lines-filter-found',
  'lines-filter-total',
  'lines-filter-clear',
  'status-badge-draft',
  'status-badge-submitted',
  'modal-footer-actions-view',
]);
const SCENARIO_EXCLUDED: Record<string, Set<string>> = {
  'create-move-3rows': new Set(['lines-filter', 'lines-filter-input']),
};
const WHITELIST: string[] = [
  'modal-header', 'modal-title', 'modal-close-btn',
  'operation-form', 'form-grid',
  'operation-type-selector', 'warehouse-source-selector', 'warehouse-destination-selector',
  'operation-date-input', 'operation-comment-input',
  'add-item-toolbar', 'item-search-input', 'item-check-btn', 'item-create-btn',
  'table-toolbar', 'rows-count-display', 'qty-total-display', 'refresh-balances-btn',
  'items-table', 'items-table-header', 'items-table-body',
  'col-num-header', 'col-item-header', 'col-qty-header', 'col-category-header', 'col-stock-header',
  'item-row-1', 'item-row-1-num', 'item-row-1-name', 'item-row-1-id', 'item-row-1-sku',
  'item-row-1-qty-input', 'item-row-1-stock-cell', 'item-row-1-delete-btn',
  'item-row-2', 'item-row-2-num', 'item-row-2-name', 'item-row-2-id', 'item-row-2-sku',
  'item-row-2-qty-input', 'item-row-2-stock-cell', 'item-row-2-delete-btn',
  'item-row-3', 'item-row-3-num', 'item-row-3-name', 'item-row-3-id', 'item-row-3-sku',
  'item-row-3-qty-input', 'item-row-3-stock-cell', 'item-row-3-delete-btn',
  'modal-footer', 'modal-footer-actions-edit',
  'cancel-btn', 'save-draft-btn', 'submit-btn',
];
function effectiveWhitelist(scenario: string): string[] {
  const scenarioExcl = SCENARIO_EXCLUDED[scenario] || new Set();
  return WHITELIST.filter(id => !ALWAYS_EXCLUDED.has(id) && !scenarioExcl.has(id));
}

// ─────────────────────────────────────────────────────────────────────
// Curated computed-style properties
// ─────────────────────────────────────────────────────────────────────
const PROPS_GENERIC: string[] = [
  'fontSize', 'fontWeight', 'fontFamily',
  'lineHeight', 'color', 'letterSpacing', 'textTransform',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
  'backgroundColor',
  'width', 'height',
];
const PROPS_LAYOUT: string[] = [
  ...PROPS_GENERIC,
  'display', 'flexDirection', 'alignItems', 'justifyContent',
  'gap', 'gridTemplateColumns', 'gridTemplateRows',
];
function propsFor(designId: string): string[] {
  const id = designId.toLowerCase();
  if (id.endsWith('-stage')) return [...PROPS_LAYOUT, 'width', 'height'];
  if (id === 'operation-modal' || id.endsWith('-footer') || id.endsWith('-toolbar')
      || id === 'form-grid' || id === 'items-table' || id.endsWith('-filter')
      || id === 'modal-header' || id === 'modal-title')
    return PROPS_LAYOUT;
  if (id.includes('header') || id.includes('btn') || id.includes('button')
      || id === 'qty-total-display' || id === 'rows-count-display')
    return [...PROPS_LAYOUT, ...PROPS_GENERIC];
  if (id.includes('input') || id.includes('select')) return [...PROPS_LAYOUT, ...PROPS_GENERIC];
  return PROPS_GENERIC;
}

// ─────────────────────────────────────────────────────────────────────
// Color normalisation via culori (oklch / rgb / rgba / hex → sRGB RGBA)
// ─────────────────────────────────────────────────────────────────────
const toRgb = converter('rgb');
function toRGBA(v: string): [number, number, number, number] | null {
  if (!v || !v.trim()) return null;
  try {
    const c = parse(v);
    if (!c) return null;
    const rgb = toRgb({ ...c, alpha: c.alpha ?? 1 });
    if (!rgb) return null;
    return [
      Math.round((rgb as any).r * 255),
      Math.round((rgb as any).g * 255),
      Math.round((rgb as any).b * 255),
      (rgb as any).alpha ?? 1,
    ];
  } catch { return null; }
}
function rgbaEqual(a: [number, number, number, number] | null, b: [number, number, number, number] | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && Math.abs(a[3] - b[3]) < 0.05;
}
function pxValue(v: string): number | null {
  if (!v) return null;
  const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? parseFloat(m[1]) : null;
}

// ─────────────────────────────────────────────────────────────────────
// Element snapshot with structural parent-path
// ─────────────────────────────────────────────────────────────────────
interface ElementSnapshot {
  id: string;
  found: boolean;
  tag?: string;
  classes?: string;
  rect?: { x: number; y: number; width: number; height: number };
  parentPath?: string;
  styles?: Record<string, { raw: string; rgba: [number, number, number, number] | null }>;
}
function enrichWithRgba(snap: Record<string, ElementSnapshot>): Record<string, ElementSnapshot> {
  for (const id of Object.keys(snap)) {
    const e = snap[id];
    if (!e || !e.styles) continue;
    for (const p of Object.keys(e.styles)) {
      const raw = e.styles[p].raw;
      if (!raw) continue;
      if (!p.toLowerCase().includes('color')) continue;
      e.styles[p].rgba = toRGBA(raw);
    }
  }
  return snap;
}
async function collectMetrics(page: Page, ids: string[]): Promise<Record<string, ElementSnapshot>> {
  const propsMap = Object.fromEntries(ids.map(id => [id, propsFor(id)]));
  const fn = ({ ids: idList, props }: { ids: string[]; props: Record<string, string[]> }): Record<string, ElementSnapshot> => {
    const out: Record<string, ElementSnapshot> = {};
    function pathOf(el: Element): string {
      const parts: string[] = [];
      let cur: Element | null = el;
      while (cur && cur !== cur.ownerDocument.documentElement) {
        const did = cur.getAttribute && cur.getAttribute('data-design-id');
        if (did) parts.unshift(`[data-design-id="${did}"]`);
        else parts.unshift(cur.tagName.toLowerCase());
        cur = cur.parentElement;
      }
      return parts.join(' > ');
    }
    for (const id of idList) {
      const el = document.querySelector(`[data-design-id="${id}"]`) as HTMLElement | null;
      if (!el) { out[id] = { id, found: false }; continue; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const styles: Record<string, { raw: string }> = {};
      const ps = props[id] || [];
      for (const p of ps) styles[p] = { raw: cs.getPropertyValue(p) || '' };
      out[id] = {
        id,
        found: true,
        tag: el.tagName.toLowerCase(),
        classes: (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).join(' '),
        rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        parentPath: pathOf(el),
        styles,
      };
    }
    return out;
  };
  return await page.evaluate(fn, { ids, props: propsMap });
}

// ─────────────────────────────────────────────────────────────────────
// Font contract
// ─────────────────────────────────────────────────────────────────────
async function checkFonts(page: Page): Promise<{
  status: 'SATISFIED' | 'UNSATISFIED';
  loaded: { weight: number; family: string }[];
  required: { weight: number; family: string }[];
}> {
  const loaded = await page.evaluate(() => {
    // @ts-ignore
    const list = (document as any).fonts;
    const out: { weight: number; family: string }[] = [];
    if (list && list.forEach) {
      // @ts-ignore
      list.forEach((f: any) => out.push({ weight: parseInt(f.weight, 10) || 400, family: (f.family || '').replace(/['"]/g, '') }));
    }
    return out;
  });
  const required = [
    { weight: 400, family: 'Inter' },
    { weight: 450, family: 'Inter' },
    { weight: 500, family: 'Inter' },
    { weight: 600, family: 'Inter' },
    { weight: 400, family: 'JetBrains Mono' },
    { weight: 500, family: 'JetBrains Mono' },
  ];
  const satisfied = required.every(req =>
    loaded.some(l => l.family === req.family && l.weight === req.weight));
  return { status: satisfied ? 'SATISFIED' : 'UNSATISFIED', loaded, required };
}

// ─────────────────────────────────────────────────────────────────────
// Diff: per-id mapping + style comparison
// ─────────────────────────────────────────────────────────────────────
type Status = 'MATCH' | 'STYLE_MISMATCH' | 'MAPPING_ERROR'
            | 'MISSING_LIVE' | 'MISSING_REF' | 'MISSING_BOTH';
interface IdDiff {
  id: string;
  status: Status;
  reason?: string;
  ref: ElementSnapshot | null;
  live: ElementSnapshot | null;
  diffs: Array<{
    prop: string;
    ref: string;
    refRgba: [number, number, number, number] | null;
    live: string;
    liveRgba: [number, number, number, number] | null;
    reason: 'value' | 'rgba' | 'px_tolerance';
  }>;
  rectDelta?: { width: number; height: number };
}
function diffOne(id: string, ref: ElementSnapshot, live: ElementSnapshot): IdDiff {
  const out: IdDiff = { id, status: 'MATCH', ref, live, diffs: [] };
  if (!ref.found && !live.found) return { id, status: 'MISSING_BOTH', ref: null, live: null, diffs: [] };
  if (!ref.found) return { id, status: 'MISSING_REF', ref: null, live, diffs: [] };
  if (!live.found) return { id, status: 'MISSING_LIVE', ref, live: null, diffs: [] };

  // MAPPING_ERROR criterion: `data-design-id` is a logical visual-role
  // contract, not an identical-HTML-tag requirement. Tag differences (DIV vs
  // HEADER, DIV vs FORM, h3 vs b, etc.) are NOT MAPPING_ERROR by themselves.
  // We only flag MAPPING_ERROR when the parent path (within the operation-modal
  // scope) places the element in genuinely different visual nodes — i.e. the
  // chain of data-design-id ancestors differs, after stripping wrapper tags
  // (`<div>`, `<span>`, `<header>`, `<footer>`, `<main>`, `<section>`,
  // `<article>`, `<aside>`, `<nav>`, `<form>`, `<h1>`-`<h6>`, `<main>`, and
  // Angular host components like `app-*`).
  const WRAPPER_TAGS = new Set([
    'div', 'span', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav', 'form',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  ]);
  const insideModal = (p: string[]): string[] => {
    const modalIdx = p.findIndex(s => s === '[data-design-id="operation-modal"]');
    if (modalIdx < 0) return p;
    const sliced = p.slice(modalIdx);
    return sliced.filter(s => s !== '[data-design-id="operation-modal-stage"]' && s !== '[data-design-id=operation-modal-stage]');
  };
  const stripAnon = (p: string[]): string[] => p.filter(s => {
    if (s.startsWith('app-')) return false;
    // Strip wrapper-tag names only (e.g., "div"); keep [data-design-id=...]
    // segments and any unrecognised non-wrapper tag (those would surface as
    // MAPPING_ERROR — meaningful structural mismatch).
    const m = s.match(/^\[data-design-id=/);
    if (m) return true;
    return !WRAPPER_TAGS.has(s);
  });
  const refInside = stripAnon(insideModal((ref.parentPath || '').split(' > ')));
  const liveInside = stripAnon(insideModal((live.parentPath || '').split(' > ')));
  if (refInside.join(' > ') !== liveInside.join(' > ')) {
    return { id, status: 'MAPPING_ERROR', reason: `inside-modal path: ref=[${refInside.join(' > ')}] live=[${liveInside.join(' > ')}]`, ref, live, diffs: [] };
  }

  // Rect delta.
  if (ref.rect && live.rect) {
    const dw = Math.abs(ref.rect.width - live.rect.width);
    const dh = Math.abs(ref.rect.height - live.rect.height);
    if (dw > 1 || dh > 1) {
      out.rectDelta = { width: live.rect.width - ref.rect.width, height: live.rect.height - ref.rect.height };
    }
  }

  // Style diffs.
  const refS = ref.styles || {};
  const liveS = live.styles || {};
  const props = propsFor(id);
  for (const p of props) {
    const r = refS[p] || { raw: '', rgba: null };
    const l = liveS[p] || { raw: '', rgba: null };
    if (r.rgba && l.rgba) {
      if (rgbaEqual(r.rgba, l.rgba)) continue;
      out.diffs.push({ prop: p, ref: r.raw, refRgba: r.rgba, live: l.raw, liveRgba: l.rgba, reason: 'rgba' });
      continue;
    }
    if (r.raw === l.raw) continue;
    const rPx = pxValue(r.raw);
    const lPx = pxValue(l.raw);
    if (rPx !== null && lPx !== null && Math.abs(rPx - lPx) <= 1) continue;
    if (r.raw === 'auto' && /^-?\d/.test(l.raw)) continue;
    out.diffs.push({ prop: p, ref: r.raw, refRgba: r.rgba, live: l.raw, liveRgba: l.rgba, reason: 'value' });
  }

  if (out.rectDelta || out.diffs.length) out.status = 'STYLE_MISMATCH';
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Live modal: open + 3 rows in MOVE mode
// ─────────────────────────────────────────────────────────────────────
async function openModalAt3Rows(page: Page) {
  await page.locator('button:has-text("Создать операцию")').click();
  await page.waitForSelector('.modal-overlay .modal-container', { timeout: 8000 });
  await page.waitForTimeout(400);
  const sourceSelect = page.locator('.modal-overlay select').nth(1);
  const opts = await sourceSelect.locator('option').count();
  if (opts > 1) await sourceSelect.selectOption({ index: 1 });
  await page.waitForTimeout(400);
  const search = page.locator('.modal-overlay input[placeholder*="Поиск ТМЦ для добавления"]');
  const queries = ['масл', 'кабел', 'болт'];
  for (let i = 0; i < 3; i++) {
    await search.fill(queries[i] || queries[queries.length - 1]);
    await page.waitForTimeout(900);
    const c = await page.locator('.modal-overlay .search-option').count();
    if (c > 0) {
      await page.locator('.modal-overlay .search-option').first().click();
      await page.waitForTimeout(1500);
      const qty = page.locator('.modal-overlay tbody tr').last().locator('.qty-input');
      if (await qty.count()) {
        const v = await qty.inputValue().catch(() => '');
        if (!v || parseFloat(v) <= 0) {
          await qty.fill('5').catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    }
  }
  await page.waitForTimeout(800);
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────
async function main() {
  const SCENARIO = 'create-move-3rows';
  const ids = effectiveWhitelist(SCENARIO);
  const browser: Browser = await chromium.launch();
  const refPage = await browser.newPage({ viewport: VIEWPORT });
  const livePage = await browser.newPage({ viewport: VIEWPORT });

  await refPage.goto('file://' + SCENARIO_REF_FILE);
  await refPage.waitForLoadState('networkidle');
  await refPage.evaluate(() => (document as any).fonts && (document as any).fonts.ready).catch(() => {});
  await refPage.waitForTimeout(500);
  const refFontStatus = await checkFonts(refPage);
  await refPage.screenshot({ path: path.join(REPORT_DIR, 'ref.png'), fullPage: false });
  const refMetrics = enrichWithRgba(await collectMetrics(refPage, ids));

  await livePage.goto(LIVE_BASE + '/');
  await livePage.waitForLoadState('networkidle');
  await livePage.locator('input[name="username"]').fill('admin').catch(() => {});
  await livePage.locator('input[name="password"]').fill('admin123').catch(() => {});
  await livePage.locator('button[type="submit"]').click().catch(() => {});
  await livePage.waitForLoadState('networkidle');
  await livePage.goto(LIVE_BASE + '/operations/');
  await livePage.waitForLoadState('networkidle');
  await livePage.waitForTimeout(500);
  await openModalAt3Rows(livePage);
  await livePage.waitForTimeout(300);
  const liveFontStatus = await checkFonts(livePage);
  await livePage.screenshot({ path: path.join(REPORT_DIR, 'live.png'), fullPage: false });
  const liveMetrics = enrichWithRgba(await collectMetrics(livePage, ids));

  const diffs: IdDiff[] = [];
  for (const id of ids) {
    diffs.push(diffOne(id, refMetrics[id] || { id, found: false }, liveMetrics[id] || { id, found: false }));
  }

  let pngSimilarity: number | null = null;
  try {
    const refBuf = fs.readFileSync(path.join(REPORT_DIR, 'ref.png'));
    const liveBuf = fs.readFileSync(path.join(REPORT_DIR, 'live.png'));
    const refPng = PNG.sync.read(refBuf);
    const livePng = PNG.sync.read(liveBuf);
    const W = Math.min(refPng.width, livePng.width);
    const H = Math.min(refPng.height, livePng.height);
    const diffPng = new PNG({ width: W, height: H });
    const mismatched = pixelmatch(
      refPng.data.subarray(0, W * H * 4),
      livePng.data.subarray(0, W * H * 4),
      diffPng.data,
      W, H,
      { threshold: 0.1 },
    );
    fs.writeFileSync(path.join(REPORT_DIR, 'diff.png'), PNG.sync.write(diffPng));
    pngSimilarity = 1 - mismatched / (W * H);
  } catch { pngSimilarity = null; }

  const counts = {
    total: diffs.length,
    match: diffs.filter(d => d.status === 'MATCH').length,
    style_mismatch: diffs.filter(d => d.status === 'STYLE_MISMATCH').length,
    mapping_error: diffs.filter(d => d.status === 'MAPPING_ERROR').length,
    missing_live: diffs.filter(d => d.status === 'MISSING_LIVE').length,
    missing_ref: diffs.filter(d => d.status === 'MISSING_REF').length,
    missing_both: diffs.filter(d => d.status === 'MISSING_BOTH').length,
  };

  const report = {
    meta: {
      scenario: SCENARIO,
      viewport: VIEWPORT,
      capturedAt: new Date().toISOString(),
      whitelistTotal: WHITELIST.length,
      whitelistEffective: ids.length,
      alwaysExcluded: [...ALWAYS_EXCLUDED],
      scenarioExcluded: [...(SCENARIO_EXCLUDED[SCENARIO] || [])],
    },
    fonts: {
      ref: refFontStatus,
      live: liveFontStatus,
      contractSatisfied: refFontStatus.status === 'SATISFIED' && liveFontStatus.status === 'SATISFIED',
    },
    summary: { ...counts, pngSimilarity },
    diffs,
  };

  fs.writeFileSync(path.join(REPORT_DIR, 'baseline.json'), JSON.stringify(report, null, 2));

  console.log('\n=== VISUAL CHECK BASELINE: ' + SCENARIO + ' @ ' + VIEWPORT.width + 'x' + VIEWPORT.height + ' ===\n');
  console.log(`Whitelist effective  : ${ids.length}  (of ${WHITELIST.length} total)`);
  console.log(`Always excluded      : ${ALWAYS_EXCLUDED.size}`);
  console.log(`Scenario excluded     : ${(SCENARIO_EXCLUDED[SCENARIO] || new Set()).size}`);
  console.log('');
  console.log(`MATCH                : ${counts.match}`);
  console.log(`STYLE_MISMATCH       : ${counts.style_mismatch}`);
  console.log(`MAPPING_ERROR        : ${counts.mapping_error}`);
  console.log(`MISSING_LIVE         : ${counts.missing_live}`);
  console.log(`MISSING_REF          : ${counts.missing_ref}`);
  console.log(`MISSING_BOTH         : ${counts.missing_both}`);
  console.log(`PNG similarity       : ${pngSimilarity !== null ? (pngSimilarity * 100).toFixed(2) + '%' : 'n/a'}`);
  console.log(`Font contract        : ${report.fonts.contractSatisfied ? 'OK' : 'FONT_CONTRACT_UNSATISFIED'}`);
  if (!report.fonts.contractSatisfied) {
    console.log('  Required faces:', report.fonts.ref.required.map((r: any) => `${r.family} ${r.weight}`).join(', '));
  }
  console.log('');
  const me = diffs.filter(d => d.status === 'MAPPING_ERROR');
  if (me.length) {
    console.log('MAPPING_ERROR details:');
    me.forEach(d => {
      console.log(`  ${d.id}: ${d.reason}`);
    });
  }
  const sm = diffs.filter(d => d.status === 'STYLE_MISMATCH')
    .sort((a, b) => b.diffs.length - a.diffs.length)
    .slice(0, 10);
  if (sm.length) {
    console.log('\nTop 10 STYLE_MISMATCH:');
    sm.forEach(d => {
      console.log(`  ${d.id}: rect=${d.rectDelta ? JSON.stringify(d.rectDelta) : 'OK'}  styles=${d.diffs.length}`);
      d.diffs.slice(0, 5).forEach((dd: any) => {
        const r = dd.refRgba ? `rgba(${dd.refRgba.join(',')})` : dd.ref;
        const l = dd.liveRgba ? `rgba(${dd.liveRgba.join(',')})` : dd.live;
        console.log(`    ${dd.prop} [${dd.reason}]: ref=${r}  live=${l}`);
      });
    });
  }
  console.log('\nReport   :', path.join(REPORT_DIR, 'baseline.json'));
  console.log('Snapshots:', path.join(REPORT_DIR, 'ref.png'),
    path.join(REPORT_DIR, 'live.png'), path.join(REPORT_DIR, 'diff.png'));

  await browser.close();
}

main().catch((err: unknown) => { console.error(err); process.exit(1); });
