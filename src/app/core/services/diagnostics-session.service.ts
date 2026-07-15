import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

const SESSION_STORAGE_KEY = 'warehouse.session_id';

@Injectable({
  providedIn: 'root'
})
export class DiagnosticsSessionService {
  private readonly _sessionId: string;
  private readonly _tabId: string;

  lastServerRequestId: string | null = null;

  readonly frontendVersion: string;

  constructor() {
    this._sessionId = this.initSessionId();
    this._tabId = this.generateUuid();
    this.frontendVersion = this.resolveFrontendVersion();
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get tabId(): string {
    return this._tabId;
  }

  newRequestId(): string {
    return this.generateUuid();
  }

  newDraftId(): string {
    return this.generateUuid();
  }

  newIdempotencyKey(): string {
    return this.generateUuid();
  }

  private initSessionId(): string {
    if (typeof sessionStorage === 'undefined') {
      return this.generateUuid();
    }
    try {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) return existing;
      const fresh = this.generateUuid();
      sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);
      return fresh;
    } catch {
      return this.generateUuid();
    }
  }

  private resolveFrontendVersion(): string {
    const fromEnv = (environment as { frontendVersion?: unknown }).frontendVersion;
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
    return 'dev';
  }

  private generateUuid(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }
}
