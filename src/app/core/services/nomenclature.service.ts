import { Injectable, signal, computed } from '@angular/core';
import { Category, Item, Unit, CatalogTreeNodeVm, CatalogPendingChange } from '../models/nomenclature.models';
import { CatalogChangeBufferService } from './catalog-change-buffer.service';
import { ApiService } from '../api/api.service';
import { BffApiService } from '../api/bff-api.service';
import { firstValueFrom } from 'rxjs';

export interface SelectedEntity {
  type: 'category' | 'item';
  id: string;
}

export interface BootstrapPayload {
  categories_tree: Record<string, unknown>;
  items: Record<string, unknown>[];
  units: Record<string, unknown>[];
  user: Record<string, unknown>;
  permissions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class NomenclatureService {
  // ─── Raw data ────────────────────────────────────────────────
  readonly categories = signal<Category[]>([]);
  readonly allItems = signal<Item[]>([]);
  readonly units = signal<Unit[]>([]);

  // ─── UI state ────────────────────────────────────────────────
  readonly selectedEntity = signal<SelectedEntity | null>(null);
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly searchQuery = signal<string>('');
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly isSaving = signal<boolean>(false);

  // ─── Unified tree (computed) ─────────────────────────────────
  readonly unifiedTree = computed(() => {
    const cats = this.categories();
    const items = this.allItems();
    const expanded = this.expandedIds();
    const selected = this.selectedEntity();
    const query = this.searchQuery().toLowerCase().trim();
    const buffer = this.changeBuffer;

    const tree = this.buildTree(cats, items, 0, expanded, selected, buffer);

    if (!query) return tree;
    return this.filterTree(tree, query);
  });

  readonly visibleNodeCount = computed(() => {
    return this.countVisible(this.unifiedTree());
  });

  readonly selectedNode = computed<CatalogTreeNodeVm | null>(() => {
    const sel = this.selectedEntity();
    if (!sel) return null;
    return this.findNodeInTree(this.unifiedTree(), sel.id);
  });

  constructor(
    private api: ApiService,
    private bff: BffApiService,
    private changeBuffer: CatalogChangeBufferService,
  ) {}

  // ─── Data loading ────────────────────────────────────────────

  async loadBootstrap(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const data = await firstValueFrom(this.api.getData<BootstrapPayload>('/bootstrap/'));
      const unitMap = this.buildUnitMap(data.units);
      const cats = this.toCategoryTree(data.categories_tree);
      const items = data.items.map(i => this.toItem(i, unitMap));
      this.computeItemCounts(cats, items);
      this.categories.set(cats);
      this.allItems.set(items);
      this.units.set(data.units.map(u => this.toUnit(u)));
      this.enrichItemsWithCategoryName(cats, items);
    } catch (err: any) {
      this.error.set(err?.message || 'Failed to load catalogue data');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ─── Selection ───────────────────────────────────────────────

  selectNode(node: CatalogTreeNodeVm): void {
    this.selectedEntity.set({ type: node.type, id: node.id });
  }

  clearSelection(): void {
    this.selectedEntity.set(null);
  }

  // ─── Expansion ───────────────────────────────────────────────

  toggleExpand(nodeId: string): void {
    const current = new Set(this.expandedIds());
    if (current.has(nodeId)) {
      current.delete(nodeId);
    } else {
      current.add(nodeId);
    }
    this.expandedIds.set(current);
  }

  expandAll(): void {
    const ids = new Set<string>();
    const collect = (nodes: CatalogTreeNodeVm[]) => {
      for (const n of nodes) {
        if (n.type === 'category' && n.children && n.children.length > 0) {
          ids.add(n.id);
          collect(n.children);
        }
      }
    };
    collect(this.unifiedTree());
    this.expandedIds.set(ids);
  }

  collapseAll(): void {
    this.expandedIds.set(new Set());
  }

  // ─── Search ──────────────────────────────────────────────────

  setSearch(query: string): void {
    this.searchQuery.set(query);
  }

  // ─── Helpers: tree building ──────────────────────────────────

  private buildTree(
    cats: Category[],
    items: Item[],
    level: number,
    expanded: Set<string>,
    selected: SelectedEntity | null,
    buffer: CatalogChangeBufferService
  ): CatalogTreeNodeVm[] {
    const result: CatalogTreeNodeVm[] = [];
    const itemMap = this.buildItemMap(items);

    for (const cat of cats) {
      const node: CatalogTreeNodeVm = {
        id: cat.id,
        type: 'category',
        name: cat.name,
        parentId: cat.parent_id,
        isActive: cat.is_active,
        level,
        expanded: expanded.has(cat.id),
        selected: selected?.type === 'category' && selected.id === cat.id,
        dirty: buffer.hasPending(cat.id, 'category'),
        children: cat.children
          ? this.buildTree(cat.children, items, level + 1, expanded, selected, buffer)
          : undefined,
      };
      result.push(node);

      const catItems = itemMap.get(cat.id) ?? [];
      for (const item of catItems) {
        result.push({
          id: item.id,
          type: 'item',
          name: item.name,
          sku: item.sku || undefined,
          parentId: cat.id,
          categoryId: item.category_id,
          unitId: item.unit_id,
          isActive: item.is_active,
          level: level + 1,
          expanded: false,
          selected: selected?.type === 'item' && selected.id === item.id,
          dirty: buffer.hasPending(item.id, 'item'),
        });
      }
    }

    return result;
  }

  private buildItemMap(items: Item[]): Map<string, Item[]> {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const list = map.get(item.category_id) ?? [];
      list.push(item);
      map.set(item.category_id, list);
    }
    return map;
  }

  private filterTree(nodes: CatalogTreeNodeVm[], query: string): CatalogTreeNodeVm[] {
    const result: CatalogTreeNodeVm[] = [];

    for (const node of nodes) {
      const matchesSelf = this.nodeMatchesQuery(node, query);

      if (node.type === 'category' && node.children) {
        const filteredChildren = this.filterTree(node.children, query);
        const hasMatchingDescendants = filteredChildren.length > 0;

        if (matchesSelf || hasMatchingDescendants) {
          result.push({
            ...node,
            expanded: true,
            children: matchesSelf ? node.children : filteredChildren,
          });
        }
      } else {
        if (matchesSelf) {
          result.push(node);
        }
      }
    }

    return result;
  }

  private nodeMatchesQuery(node: CatalogTreeNodeVm, query: string): boolean {
    if (node.name.toLowerCase().includes(query)) return true;
    if (node.sku?.toLowerCase().includes(query)) return true;
    return false;
  }

  private countVisible(nodes: CatalogTreeNodeVm[]): number {
    let count = 0;
    for (const n of nodes) {
      count++;
      if (n.type === 'category' && n.children) {
        count += this.countVisible(n.children);
      }
    }
    return count;
  }

  private findNodeInTree(nodes: CatalogTreeNodeVm[], id: string): CatalogTreeNodeVm | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = this.findNodeInTree(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  // ─── Getters for selected data ───────────────────────────────

  getSelectedItem(): Item | null {
    const sel = this.selectedEntity();
    if (sel?.type !== 'item') return null;
    return this.allItems().find(i => i.id === sel.id) ?? null;
  }

  getSelectedCategory(): Category | null {
    const sel = this.selectedEntity();
    if (sel?.type !== 'category') return null;
    return this.findCategoryById(sel.id);
  }

  findCategoryById(id: string, tree?: Category[]): Category | null {
    tree ??= this.categories();
    for (const cat of tree) {
      if (cat.id === id) return cat;
      if (cat.children) {
        const found = this.findCategoryById(id, cat.children);
        if (found) return found;
      }
    }
    return null;
  }

  // ─── Mapping helpers ─────────────────────────────────────────

  private buildUnitMap(rawUnits: Record<string, unknown>[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const u of rawUnits) {
      map[String(u['id'] ?? '')] = String(u['symbol'] ?? u['name'] ?? '');
    }
    return map;
  }

  private computeItemCounts(cats: Category[], items: Item[]): void {
    for (const cat of cats) {
      const childIds = this.collectChildIds(cat);
      cat.items_count = items.filter(i => childIds.has(i.category_id)).length;
      if (cat.children) {
        this.computeItemCounts(cat.children, items);
      }
    }
  }

  private collectChildIds(cat: Category): Set<string> {
    const ids = new Set<string>();
    ids.add(cat.id);
    if (cat.children) {
      for (const c of cat.children) {
        for (const id of this.collectChildIds(c)) {
          ids.add(id);
        }
      }
    }
    return ids;
  }

  private enrichItemsWithCategoryName(cats: Category[], items: Item[]): void {
    const catNameMap: Record<string, string> = {};
    const walk = (list: Category[]) => {
      for (const c of list) {
        catNameMap[c.id] = c.name;
        if (c.children) walk(c.children);
      }
    };
    walk(cats);
    for (const item of items) {
      item.category_name = catNameMap[item.category_id] ?? '';
    }
  }

  private toCategoryTree(raw: Record<string, unknown>): Category[] {
    const children = raw['children'] as Record<string, unknown>[] | undefined;
    if (!children) return [];
    return children.map(c => this.mapCategoryNode(c));
  }

  private mapCategoryNode(raw: Record<string, unknown>): Category {
    const childList = raw['children'] as Record<string, unknown>[] | undefined;
    const children = childList ? childList.map(c => this.mapCategoryNode(c)) : [];
    return {
      id: String(raw['id'] ?? ''),
      name: String(raw['name'] ?? ''),
      code: String(raw['code'] ?? ''),
      parent_id: raw['parent_id'] != null ? String(raw['parent_id']) : null,
      sort_order: raw['sort_order'] != null ? Number(raw['sort_order']) : 0,
      is_active: raw['is_active'] !== false,
      children_count: children.length,
      items_count: 0,
      children,
    };
  }

  private toItem(raw: Record<string, unknown>, unitMap: Record<string, string>): Item {
    const hashtagsArr = raw['hashtags'];
    return {
      id: String(raw['id'] ?? ''),
      name: String(raw['name'] ?? ''),
      sku: raw['sku'] ? String(raw['sku']) : '',
      category_id: String(raw['category_id'] ?? ''),
      category_name: '',
      unit_id: String(raw['unit_id'] ?? ''),
      unit_symbol: unitMap[String(raw['unit_id'] ?? '')] ?? '',
      is_active: raw['is_active'] !== false,
      hashtags: Array.isArray(hashtagsArr) ? (hashtagsArr as string[]) : [],
    };
  }

  private toUnit(raw: Record<string, unknown>): Unit {
    return {
      id: String(raw['id'] ?? ''),
      name: String(raw['name'] ?? ''),
      symbol: String(raw['symbol'] ?? ''),
      sort_order: raw['sort_order'] != null ? Number(raw['sort_order']) : 0,
      is_active: raw['is_active'] !== false,
    };
  }

  // ─── Batch apply ─────────────────────────────────────────────

  private _apiPath(entityType: string, entityId?: string): string {
    const plural = entityType === 'category' ? 'categories' : `${entityType}s`;
    const prefix = `/${plural}`;
    return entityId ? `${prefix}/${entityId}/` : `${prefix}/`;
  }

  async applyBatch(changes: CatalogPendingChange[]): Promise<void> {
    if (changes.length === 0) return;
    this.isSaving.set(true);
    this.error.set(null);

    try {
      for (const change of changes) {
        const path = this._apiPath(change.entityType, change.entityId);
        if (change.action === 'delete') {
          await firstValueFrom(this.api.delete(path));
        } else if (change.action === 'deactivate') {
          await firstValueFrom(
            this.api.patch(path, { is_active: false })
          );
        } else if (change.action === 'update') {
          await firstValueFrom(
            this.api.patch(path, change.payload)
          );
        } else if (change.action === 'create') {
          const createPath = this._apiPath(change.entityType);
          await firstValueFrom(this.api.post(createPath, change.payload));
        }
      }
      await this.loadBootstrap();
    } catch (err: any) {
      this.error.set(err?.message || 'Batch apply failed');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }
}
