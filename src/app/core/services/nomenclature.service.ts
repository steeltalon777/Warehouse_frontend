import { Injectable, signal, computed } from '@angular/core';
import { Category, Item, Unit, CatalogTreeNodeVm, CatalogPendingChange, CatalogBatchChange, CatalogBatchRequest } from '../models/nomenclature.models';
import { CatalogChangeBufferService } from './catalog-change-buffer.service';
import { BffApiService } from '../api/bff-api.service';
import { ApiService } from '../api/api.service';
import { firstValueFrom } from 'rxjs';

export interface SelectedEntity {
  type: 'category' | 'item' | 'unit';
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

  /** Project pending create-unit changes as Unit objects so they appear in selects */
  readonly stagedUnits = computed<Unit[]>(() => {
    return this.changeBuffer.changes()
      .filter(c => c.entityType === 'unit' && c.action === 'create')
      .map(c => ({
        id: c.localId,
        name: (c.payload['name'] as string) || '',
        symbol: (c.payload['symbol'] as string) || '',
        sort_order: (c.payload['sort_order'] as number) ?? 0,
        is_active: (c.payload['is_active'] as boolean) ?? true,
      } as Unit));
  });

  /** Combined units: server + staged, for form selects */
  readonly allUnits = computed<Unit[]>(() => [...this.units(), ...this.stagedUnits()]);

  /** Project pending create-category changes so they can be selected before apply */
  readonly stagedCategories = computed<Category[]>(() => {
    return this.changeBuffer.changes()
      .filter(c => c.entityType === 'category' && c.action === 'create')
      .map(c => ({
        id: c.localId,
        name: String(c.payload['name'] ?? ''),
        code: String(c.payload['code'] ?? ''),
        parent_id: c.payload['parent_local_id'] != null
          ? String(c.payload['parent_local_id'])
          : c.payload['parent_id'] != null
            ? String(c.payload['parent_id'])
            : null,
        sort_order: c.payload['sort_order'] != null ? Number(c.payload['sort_order']) : 0,
        is_active: c.payload['is_active'] !== false,
        children_count: 0,
        items_count: 0,
        children: [],
      }));
  });

  /** Combined categories tree: server + staged, for form selects and staged edits */
  readonly allCategories = computed<Category[]>(() => {
    return this.mergeCategoriesWithStaged(this.categories(), this.stagedCategories());
  });

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

    // Inject pending create nodes from buffer
    const pendingCreates = this.changeBuffer.changes().filter(c => c.action === 'create');
    
    // Category creates
    for (const change of pendingCreates) {
      if (change.entityType === 'category') {
        const name = (change.payload['name'] as string) || 'Новая категория';
        
        const newNode: CatalogTreeNodeVm = {
          id: change.localId,
          type: 'category',
          name,
          isActive: (change.payload['is_active'] as boolean) ?? true,
          level: 0,
          expanded: false,
          selected: selected?.id === change.localId && selected?.type === 'category',
          dirty: true,
          pendingAction: 'create',
          children: undefined,
        };
        
        const parentId = (change.payload['parent_local_id'] as string | undefined)
          ?? (change.payload['parent_id'] as string | undefined);
        const parentIdx = parentId ? tree.findIndex(n => n.id === parentId && n.type === 'category') : -1;
        if (parentIdx >= 0) {
          tree.splice(parentIdx + 1, 0, newNode);
        } else {
          tree.push(newNode);
        }
      }
    }
    
    // Item creates
    for (const change of pendingCreates) {
      if (change.entityType === 'item') {
        const name = (change.payload['name'] as string) || 'Новый ТМЦ';
        const catLocalId = change.payload['category_local_id'] as string | undefined;
        const catId = change.payload['category_id'] as string | undefined;
        const parentId = catLocalId || catId || '';
        
        const newNode: CatalogTreeNodeVm = {
          id: change.localId,
          type: 'item',
          name,
          sku: (change.payload['sku'] as string) || undefined,
          parentId,
          isActive: (change.payload['is_active'] as boolean) ?? true,
          level: 1,
          expanded: false,
          selected: selected?.id === change.localId && selected?.type === 'item',
          dirty: true,
          pendingAction: 'create',
        };
        
        const parentIdx = parentId ? tree.findIndex(n => n.id === parentId && n.type === 'category') : -1;
        if (parentIdx >= 0) {
          tree.splice(parentIdx + 1, 0, newNode);
        } else {
          tree.push(newNode);
        }
      }
    }
    
    if (!query) return tree;
    return this.filterTree(tree, query);
  });

  readonly visibleNodeCount = computed(() => {
    return this.countVisible(this.unifiedTree());
  });

  /** Flat list of unit nodes for the separate "Units" tab */
  readonly unitListNodes = computed<CatalogTreeNodeVm[]>(() => {
    const selected = this.selectedEntity();
    const result: CatalogTreeNodeVm[] = [];

    for (const u of this.units()) {
      result.push({
        id: u.id,
        type: 'unit',
        name: `${u.name} (${u.symbol})`,
        meta: u.is_active ? undefined : 'неактивно',
        isActive: u.is_active,
        level: 0,
        expanded: false,
        selected: selected?.id === u.id && selected?.type === 'unit',
        dirty: this.changeBuffer.hasPending(u.id, 'unit'),
      });
    }

    for (const u of this.stagedUnits()) {
      result.push({
        id: u.id,
        type: 'unit',
        name: `${u.name} (${u.symbol})`,
        isActive: u.is_active,
        level: 0,
        expanded: false,
        selected: selected?.id === u.id && selected?.type === 'unit',
        dirty: true,
        pendingAction: 'create',
      });
    }

    return result;
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
    tree ??= this.allCategories();
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

  private mergeCategoriesWithStaged(baseCategories: Category[], stagedCategories: Category[]): Category[] {
    const cloneCategory = (category: Category): Category => ({
      ...category,
      children: category.children?.map(cloneCategory) ?? [],
    });

    const roots = baseCategories.map(cloneCategory);
    const categoryMap = new Map<string, Category>();

    const indexTree = (categories: Category[]) => {
      for (const category of categories) {
        categoryMap.set(category.id, category);
        if (category.children?.length) {
          indexTree(category.children);
        }
      }
    };

    indexTree(roots);

    for (const staged of stagedCategories) {
      const stagedClone: Category = {
        ...staged,
        children: [],
      };

      categoryMap.set(stagedClone.id, stagedClone);

      if (stagedClone.parent_id) {
        const parent = categoryMap.get(stagedClone.parent_id);
        if (parent) {
          parent.children = [...(parent.children ?? []), stagedClone];
          parent.children_count = parent.children.length;
          continue;
        }
      }

      roots.push(stagedClone);
    }

    return roots;
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

  // ─── Selected unit ───────────────────────────────────────────

  readonly selectedUnit = computed<Unit | null>(() => {
    const sel = this.selectedEntity();
    if (sel?.type !== 'unit') return null;
    return this.allUnits().find(u => u.id === sel.id) ?? null;
  });

  /** Helper: resolve unit by ID from allUnits — used by right-panel template as fallback */
  resolveUnitById(unitId: string): Unit | null {
    return this.allUnits().find(u => u.id === unitId) ?? null;
  }

  // ─── Batch apply ─────────────────────────────────────────────

  async applyBatch(changes: CatalogPendingChange[]): Promise<void> {
    if (changes.length === 0) return;
    this.isSaving.set(true);
    this.error.set(null);

    try {
      const batchChanges: CatalogBatchChange[] = changes.map(c => ({
        local_id: c.localId,
        entity_type: c.entityType as 'unit' | 'category' | 'item',
        action: c.action as 'create' | 'update' | 'deactivate' | 'delete',
        entity_id: c.entityId,
        payload: c.payload,
      }));

      const batchRequest: CatalogBatchRequest = {
        client_batch_id: `catalog-ui-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 8)}`,
        mode: 'atomic',
        changes: batchChanges,
      };

      await firstValueFrom(this.bff.post('/catalog/admin/batch', batchRequest));
      await this.loadBootstrap();
    } catch (err: any) {
      this.error.set(err?.message || 'Batch apply failed');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }
}
