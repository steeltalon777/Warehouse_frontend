import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthContextService } from '../services/auth-context.service';

export const catalogWriteGuard: CanActivateFn = async () => {
  const auth = inject(AuthContextService);
  const router = inject(Router);

  // Ensure auth context is loaded before checking role.
  // load() is called elsewhere (e.g. OperationsService constructor) but
  // may not have completed by the time the guard runs on direct navigation.
  if (!auth.authContext()) {
    await auth.load();
  }

  const role = auth.authContext()?.role;
  if (role === 'root' || role === 'chief_storekeeper') return true;
  return router.createUrlTree(['/catalog']);
};
