import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthContextService } from '../services/auth-context.service';

export const catalogWriteGuard: CanActivateFn = () => {
  const auth = inject(AuthContextService);
  const router = inject(Router);
  const role = auth.authContext()?.role;
  if (role === 'root' || role === 'chief_storekeeper') return true;
  return router.createUrlTree(['/catalog']);
};
