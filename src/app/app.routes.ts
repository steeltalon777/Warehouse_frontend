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
    path: '**',
    redirectTo: 'nomenclature',
  },
];
