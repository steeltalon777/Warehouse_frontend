import { Injectable, signal } from '@angular/core';
import { BffApiService } from '../api/bff-api.service';
import { firstValueFrom } from 'rxjs';

export interface AuthContext {
  userId: string;
  role: string;
  defaultSiteId: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthContextService {
  readonly authContext = signal<AuthContext | null>(null);

  constructor(private bff: BffApiService) {}

  async load(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.bff.getData<{ user_id: string; role: string; default_site_id?: string | null }>('/auth/me')
      );
      this.authContext.set({
        userId: data.user_id,
        role: data.role,
        defaultSiteId: data.default_site_id ?? null,
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
