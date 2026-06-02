import { Injectable, signal } from '@angular/core';
import { BffApiService } from '../api/bff-api.service';
import { firstValueFrom } from 'rxjs';

export interface AuthContext {
  userId: string;
  role: string;
  defaultSiteId: string | null;
}

interface AuthMeResponse {
  user_id?: string;
  role?: string;
  default_site_id?: string | number | null;
  user?: {
    id?: string;
    role?: string;
    is_root?: boolean;
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

  constructor(private bff: BffApiService) {}

  async load(): Promise<void> {
    try {
      const data = await firstValueFrom(this.bff.getData<AuthMeResponse>('/auth/me'));
      const user = data.user ?? data.data?.user;
      const device = data.device ?? data.data?.device;
      const defaultSiteId = data.default_site_id
        ?? user?.default_site_id
        ?? device?.site_id
        ?? null;
      this.authContext.set({
        userId: data.user_id ?? user?.id ?? '',
        role: data.role ?? user?.role ?? (user?.is_root ? 'root' : 'observer'),
        defaultSiteId: defaultSiteId == null ? null : String(defaultSiteId),
      });
    } catch {
      // Blocker: BFF auth endpoint not implemented yet.
      // Fallback to a minimal mock so UI can continue development.
      this.authContext.set({
        userId: 'mock-user',
        role: 'root',
        defaultSiteId: null,
      });
    }
  }
}
