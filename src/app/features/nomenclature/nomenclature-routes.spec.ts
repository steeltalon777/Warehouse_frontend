import { UrlSegment } from '@angular/router';
import { routes, catalogReadonlyMatcher } from '../../app.routes';
import { canWriteCatalogForMode } from '../../core/services/auth-context.service';
import { resolveCatalogMode } from './nomenclature-page/nomenclature-page';

describe('catalog routing and capability', () => {
  it('matches catalog root and compatibility paths in readonly mode', () => {
    const consumed = catalogReadonlyMatcher([
      new UrlSegment('catalog', {}),
      new UrlSegment('items', {}),
      new UrlSegment('legacy', {}),
    ]);
    const catalogRoute = routes.find(route => route.matcher === catalogReadonlyMatcher);

    expect(consumed?.consumed.map(segment => segment.path)).toEqual(['catalog', 'items', 'legacy']);
    expect(resolveCatalogMode(catalogRoute?.data as Record<string, unknown> | undefined)).toBe('readonly');
  });

  it('does not match reserved catalog ssr namespace', () => {
    const consumed = catalogReadonlyMatcher([
      new UrlSegment('catalog', {}),
      new UrlSegment('ssr', {}),
      new UrlSegment('items', {}),
    ]);

    expect(consumed).toBeNull();
  });

  it('does not match non-catalog paths', () => {
    const consumed = catalogReadonlyMatcher([new UrlSegment('nomenclature', {})]);

    expect(consumed).toBeNull();
    expect(resolveCatalogMode(undefined)).toBe('readonly');
  });

  it('requires editable mode and manager capability for catalog writes', () => {
    expect(canWriteCatalogForMode('editable', null)).toBe(false);
    expect(canWriteCatalogForMode('readonly', { role: 'root' })).toBe(false);
    expect(canWriteCatalogForMode('editable', { role: 'observer' })).toBe(false);
    expect(canWriteCatalogForMode('editable', { role: 'chief_storekeeper' })).toBe(true);
    expect(canWriteCatalogForMode('editable', { role: 'root', canManageCatalog: false })).toBe(false);
  });
});
