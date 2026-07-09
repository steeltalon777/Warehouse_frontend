import { Injectable, computed, signal } from '@angular/core';
import { BffApiService } from '../api/bff-api.service';
import { firstValueFrom } from 'rxjs';

export interface AuthContext {
  userId: string;
  role: string;
  defaultSiteId: string | null;
  canManageCatalog?: boolean;
}

export type CatalogMode = 'readonly' | 'editable';

export function hasCatalogManagementAccess(
  authContext: Pick<AuthContext, 'role' | 'canManageCatalog'> | null | undefined
): boolean {
  if (typeof authContext?.canManageCatalog === 'boolean') {
    return authContext.canManageCatalog;
  }

  const role = authContext?.role;
  return role === 'root' || role === 'chief_storekeeper';
}

export function canWriteCatalogForMode(
  catalogMode: CatalogMode,
  authContext: Pick<AuthContext, 'role' | 'canManageCatalog'> | null | undefined
): boolean {
  return catalogMode === 'editable' && hasCatalogManagementAccess(authContext);
}

function parseExplicitCatalogPermission(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value == null) {
    return null;
  }

  return false;
}

interface AuthMeResponse {
  user_id?: string;
  role?: string;
  can_manage_catalog?: boolean | null | string | number;
  default_site_id?: string | number | null;
  user?: {
    id?: string;
    role?: string;
    is_root?: boolean;
    can_manage_catalog?: boolean | null | string | number;
    default_site_id?: string | number | null;
  };
  device?: {
    site_id?: string | number | null;
  };
  data?: {
    user?: {
      id?: string;
      role?: string;
      is_root?: boolean;
      can_manage_catalog?: boolean | null | string | number;
      default_site_id?: string | number | null;
    };
    device?: {
      site_id?: string | number | null;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthContextService {
  readonly authContext = signal<AuthContext | null>(null);
  readonly canManageCatalog = computed(() => hasCatalogManagementAccess(this.authContext()));
  private loadPromise: Promise<void> | null = null;

  constructor(private bff: BffApiService) {}

  async load(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const data = await firstValueFrom(this.bff.getData<AuthMeResponse>('/auth/me'));
        const user = data.user ?? data.data?.user;
        const device = data.device ?? data.data?.device;
        const explicitCatalogPermission = parseExplicitCatalogPermission(
          data.can_manage_catalog ?? user?.can_manage_catalog
        );
        const defaultSiteId = data.default_site_id
          ?? user?.default_site_id
          ?? device?.site_id
          ?? null;

        this.authContext.set({
          userId: data.user_id ?? user?.id ?? '',
          role: data.role ?? user?.role ?? (user?.is_root ? 'root' : 'observer'),
          defaultSiteId: defaultSiteId == null ? null : String(defaultSiteId),
          canManageCatalog: explicitCatalogPermission ?? undefined,
        });
      } catch {
        this.authContext.set(null);
      }
    })();

    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }
}
