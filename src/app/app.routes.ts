import { Routes } from '@angular/router';

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
    path: 'nomenclature',
    loadComponent: () => import('./features/nomenclature/nomenclature-page/nomenclature-page').then(m => m.NomenclaturePageComponent),
  },
  {
    path: 'operations',
    loadComponent: () => import('./features/operations/pages/operations-page/operations-page.component').then(m => m.OperationsPageComponent),
  },
  {
    path: 'temporary-items',
    loadComponent: () => import('./features/temporary-items/pages/temp-items-page.component').then(m => m.TempItemsPageComponent),
  },
  {
    path: 'issued-assets',
    loadComponent: () => import('./features/issued-assets/pages/issued-assets-page/issued-assets-page.component').then(m => m.IssuedAssetsPageComponent),
    children: [
      { path: '', redirectTo: 'property', pathMatch: 'full' },
      { path: 'property', loadComponent: () => import('./features/issued-assets/components/property-table/property-table.component').then(m => m.PropertyTableComponent) },
      { path: 'objects', loadComponent: () => import('./features/issued-assets/components/objects-table/objects-table.component').then(m => m.ObjectsTableComponent) },
      { path: 'objects/new', loadComponent: () => import('./features/issued-assets/components/object-form/object-form.component').then(m => m.ObjectFormComponent) },
      { path: 'objects/:id', loadComponent: () => import('./features/issued-assets/components/object-detail/object-detail.component').then(m => m.ObjectDetailComponent) },
      { path: 'objects/:id/edit', loadComponent: () => import('./features/issued-assets/components/object-form/object-form.component').then(m => m.ObjectFormComponent) },
    ],
  },
  {
    path: '**',
    redirectTo: 'nomenclature',
  },
];
