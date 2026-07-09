import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthContextService, hasCatalogManagementAccess } from '../services/auth-context.service';

export const catalogWriteGuard: CanActivateFn = async () => {
  const auth = inject(AuthContextService);
  const router = inject(Router);

  // Ensure auth context is loaded before checking role.
  // load() is called elsewhere (e.g. OperationsService constructor) but
  // may not have completed by the time the guard runs on direct navigation.
  if (!auth.authContext()) {
    await auth.load();
  }

  if (hasCatalogManagementAccess(auth.authContext())) return true;
  return router.createUrlTree(['/catalog']);
};
