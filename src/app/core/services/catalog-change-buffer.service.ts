import { Injectable, signal, computed } from '@angular/core';
import { CatalogPendingChange } from '../models/nomenclature.models';

@Injectable({
  providedIn: 'root'
})
export class CatalogChangeBufferService {
  private readonly STORAGE_KEY = 'catalog_pending_changes';

  private readonly _changes = signal<CatalogPendingChange[]>([]);
  private readonly _disabled = signal<boolean>(false);

  readonly changes = computed(() => this._changes());
  readonly count = computed(() => this._changes().length);
  readonly isEmpty = computed(() => this._changes().length === 0);
  readonly disabled = this._disabled.asReadonly();

  constructor() {
    const stored = this._loadFromStorage();
    if (stored.length > 0) {
      this._changes.set(stored);
    }
  }

  private _saveToStorage(): void {
    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._changes()));
    } catch {
      // Quota exceeded — silently ignore
    }
  }

  private _loadFromStorage(): CatalogPendingChange[] {
    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  setDisabled(value: boolean): void {
    this._disabled.set(value);
  }

  /** Add or replace a change by localId */
  addChange(change: CatalogPendingChange): void {
    if (this._disabled()) return;
    const current = this._changes();
    const idx = current.findIndex(c => c.localId === change.localId);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = change;
      this._changes.set(next);
    } else {
      this._changes.set([...current, change]);
    }
    this._saveToStorage();
  }

  /** Remove a single change by localId */
  removeChange(localId: string): void {
    this._changes.set(this._changes().filter(c => c.localId !== localId));
    this._saveToStorage();
  }

  /** Clear all pending changes */
  clearAll(): void {
    this._changes.set([]);
    this._saveToStorage();
  }

  /** Check if entity has a pending change */
  hasPending(entityId: string, entityType: string): boolean {
    return this._changes().some(
      c => c.entityId === entityId && c.entityType === entityType
    );
  }

  /** Get change for a specific entity */
  getChangeForEntity(entityId: string, entityType: string): CatalogPendingChange | null {
    return this._changes().find(
      c => c.entityId === entityId && c.entityType === entityType
    ) ?? null;
  }

  /** Check if entity has a pending delete change */
  hasPendingDelete(entityId: string, entityType: string): boolean {
    return this._changes().some(
      c => c.entityId === entityId && c.entityType === entityType && c.action === 'delete'
    );
  }

  /** Get all changes for an entity type */
  getChangesForType(entityType: string): CatalogPendingChange[] {
    return this._changes().filter(c => c.entityType === entityType);
  }

  /** Replace all changes (used after successful apply) */
  setChanges(changes: CatalogPendingChange[]): void {
    this._changes.set(changes);
    this._saveToStorage();
  }
}
