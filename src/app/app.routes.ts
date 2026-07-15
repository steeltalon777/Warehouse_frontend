import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { catalogWriteGuard } from './core/guards/catalog-write.guard';
import { unsavedDraftGuard } from './core/guards/unsaved-draft.guard';

export function catalogReadonlyMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 0 || segments[0].path !== 'catalog') {
    return null;
  }

  if (segments[1]?.path === 'ssr') {
    return null;
  }

  return { consumed: segments };
}

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'nomenclature',
  },
  {
    path: 'nomenclature/operations',
    redirectTo: '/operations',
  },
  {
    matcher: catalogReadonlyMatcher,
    data: { catalogMode: 'readonly' },
    loadComponent: () => import('./features/nomenclature/nomenclature-page/nomenclature-page').then(m => m.NomenclaturePageComponent),
  },
  {
    path: 'nomenclature',
    data: { catalogMode: 'editable' },
    canActivate: [catalogWriteGuard],
    loadComponent: () => import('./features/nomenclature/nomenclature-page/nomenclature-page').then(m => m.NomenclaturePageComponent),
  },
  {
    path: 'operations',
    loadComponent: () => import('./features/operations/pages/operations-page/operations-page.component').then(m => m.OperationsPageComponent),
    canDeactivate: [unsavedDraftGuard],
  },
  {
    path: 'operations/:operationId/acceptance',
    loadComponent: () => import('./features/operations/pages/operation-acceptance-page/operation-acceptance-page.component').then(m => m.OperationAcceptancePageComponent),
  },
  {
    path: 'operations/pending-acceptance',
    loadComponent: () => import('./features/operations/pages/pending-acceptance-page/pending-acceptance-page.component').then(m => m.PendingAcceptancePageComponent),
  },
  {
    path: 'operations/lost-assets',
    loadComponent: () => import('./features/lost-assets/pages/lost-assets-page/lost-assets-page.component').then(m => m.LostAssetsPageComponent),
  },
  {
    path: 'operations/lost-assets/:operationLineId',
    loadComponent: () => import('./features/lost-assets/pages/lost-asset-detail-page/lost-asset-detail-page.component').then(m => m.LostAssetDetailPageComponent),
  },
  {
    path: 'temporary-items',
    loadComponent: () => import('./features/temporary-items/pages/temp-items-page.component').then(m => m.TempItemsPageComponent),
  },
  {
    path: 'issued-assets',
    loadComponent: () => import('./features/issued-assets/pages/issued-assets-page/issued-assets-page.component').then(m => m.IssuedAssetsPageComponent),
    children: [
      { path: 'property', redirectTo: '', pathMatch: 'full' },
      { path: 'objects', redirectTo: '', pathMatch: 'full' },
      { path: 'objects/new', redirectTo: '', pathMatch: 'full' },
      { path: 'objects/:id', redirectTo: '', pathMatch: 'full' },
      { path: 'objects/:id/edit', redirectTo: '', pathMatch: 'full' },
    ],
  },
  {
    path: '**',
    redirectTo: 'nomenclature',
  },
];
