import { Injectable, signal, computed } from '@angular/core';
import { Category, Item, Unit, CatalogTreeNodeVm, CatalogPendingChange, CatalogBatchChange, CatalogBatchRequest, CatalogBatchResponse } from '../models/nomenclature.models';
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

interface BootstrapLoadOptions {
  cacheBust?: boolean;
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
  readonly forceVisibleIds = signal<Set<string>>(new Set());
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
        const hashtagsArr = change.payload['hashtags'];
        const hashtags: string[] | undefined = Array.isArray(hashtagsArr) && hashtagsArr.length > 0
          ? (hashtagsArr as string[])
          : undefined;
        
        const newNode: CatalogTreeNodeVm = {
          id: change.localId,
          type: 'item',
          name,
          sku: (change.payload['sku'] as string) || undefined,
          hashtags,
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

    const forceIds = this.forceVisibleIds();
    if (forceIds.size === 0) {
      return this.filterTree(tree, query);
    }

    // Merge: search results + force-visible nodes from unfiltered tree
    const filtered = this.filterTree(tree, query);
    const resultMap = new Map<string, CatalogTreeNodeVm>();

    // Collect all nodes from filtered results into map
    const collectNodes = (nodes: CatalogTreeNodeVm[]) => {
      for (const node of nodes) {
        resultMap.set(node.id, node);
        if (node.children) collectNodes(node.children);
      }
    };
    collectNodes(filtered);

    // Determine which forceIds are "deepest" (not a parent of another forced node)
    const deepestIds = new Set(forceIds);
    for (const id of forceIds) {
      const node = this.findNodeInTree(tree, id);
      if (node?.parentId && forceIds.has(node.parentId)) {
        deepestIds.delete(node.parentId);
      }
    }

    // Add force-visible nodes
    for (const forceId of forceIds) {
      const node = this.findNodeInTree(tree, forceId);
      if (!node) continue;

      if (deepestIds.has(forceId)) {
        // Deepest node: full children, expanded
        if (resultMap.has(forceId)) {
          resultMap.set(forceId, { ...resultMap.get(forceId)!, expanded: true });
        } else {
          resultMap.set(forceId, { ...node, expanded: true });
        }
      } else {
        // Ancestor: only forced children
        const forcedChildIds = new Set(
          [...forceIds].filter(id => {
            const n = this.findNodeInTree(tree, id);
            return n?.parentId === forceId;
          })
        );
        const filteredChildren = (node.children || []).filter(c => forcedChildIds.has(c.id));

        if (resultMap.has(forceId)) {
          const existing = resultMap.get(forceId)!;
          const mergedChildren = [...(existing.children || [])];
          for (const fc of filteredChildren) {
            if (!mergedChildren.some(c => c.id === fc.id)) {
              mergedChildren.push(fc);
            }
          }
          resultMap.set(forceId, { ...existing, expanded: true, children: mergedChildren });
        } else {
          resultMap.set(forceId, { ...node, expanded: true, children: filteredChildren });
        }
      }
    }

    // For deepest forced categories, add their sibling items as children
    const flatAll = this.collectFlat(tree);
    for (const forceId of deepestIds) {
      const catNode = resultMap.get(forceId);
      if (!catNode || catNode.type !== 'category') continue;

      const catItems = flatAll.filter(n => n.type === 'item' && n.parentId === forceId);
      if (catItems.length === 0) continue;

      for (const itemNode of catItems) {
        if (!resultMap.has(itemNode.id)) {
          resultMap.set(itemNode.id, itemNode);
        }
      }

      const existingChildren = catNode.children || [];
      const mergedChildren = [...existingChildren];
      for (const itemNode of catItems) {
        if (!mergedChildren.some(c => c.id === itemNode.id)) {
          mergedChildren.push(itemNode);
        }
      }
      resultMap.set(forceId, { ...catNode, children: mergedChildren });
    }

    // Fix children references to point to resultMap versions
    for (const [id, node] of resultMap) {
      if (node.children?.length) {
        resultMap.set(id, {
          ...node,
          children: node.children.map(c => resultMap.get(c.id) ?? c),
        });
      }
    }

    // Return root nodes (nodes with no parent in resultMap)
    const roots: CatalogTreeNodeVm[] = [];
    for (const node of resultMap.values()) {
      if (!node.parentId || !resultMap.has(node.parentId)) {
        roots.push(node);
      }
    }

    return roots;
  });

  readonly visibleNodeCount = computed(() => {
    return this.countVisible(this.unifiedTree());
  });

  /** Flat list of unit nodes for the separate "Units" tab */
  readonly unitListNodes = computed<CatalogTreeNodeVm[]>(() => {
    const selected = this.selectedEntity();
    const result: CatalogTreeNodeVm[] = [];

    for (const u of this.units()) {
      const unitPending = this.changeBuffer.getChangeForEntity(u.id, 'unit');
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
        pendingAction: unitPending?.action,
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

  async loadBootstrap(options?: BootstrapLoadOptions): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const cacheBustSuffix = options?.cacheBust ? `?_=${Date.now()}` : '';
      const data = await firstValueFrom(this.api.getData<BootstrapPayload>(`/bootstrap/${cacheBustSuffix}`));
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
    if (!query) {
      this.forceVisibleIds.set(new Set());
    }
  }

  forceShowCategory(categoryId: string): void {
    const cats = this.categories();
    const newIds = new Set<string>();
    let current: string | null = categoryId;

    while (current) {
      newIds.add(current);
      const cat = this.findCategoryById(current, cats);
      current = cat?.parent_id ?? null;
    }

    this.forceVisibleIds.set(newIds);
  }

  clearForceVisible(): void {
    this.forceVisibleIds.set(new Set());
  }

  // ─── Helpers: tree traversal ────────────────────────────────

  private collectFlat(nodes: CatalogTreeNodeVm[]): CatalogTreeNodeVm[] {
    const result: CatalogTreeNodeVm[] = [];
    for (const n of nodes) {
      result.push(n);
      if (n.children) {
        result.push(...this.collectFlat(n.children));
      }
    }
    return result;
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
      if (!cat.is_active && !buffer.hasPending(cat.id, 'category')) continue;
      const catPending = buffer.getChangeForEntity(cat.id, 'category');
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
        pendingAction: catPending?.action,
        children: cat.children
          ? this.buildTree(cat.children, items, level + 1, expanded, selected, buffer)
          : undefined,
      };
      result.push(node);

      const catItems = itemMap.get(cat.id) ?? [];
      for (const item of catItems) {
        if (!item.is_active && !buffer.hasPending(item.id, 'item')) continue;
        const itemPending = buffer.getChangeForEntity(item.id, 'item');
        result.push({
          id: item.id,
          type: 'item',
          name: item.name,
          sku: item.sku || undefined,
          hashtags: item.hashtags?.length ? item.hashtags : undefined,
          parentId: cat.id,
          categoryId: item.category_id,
          unitId: item.unit_id,
          isActive: item.is_active,
          level: level + 1,
          expanded: false,
          selected: selected?.type === 'item' && selected.id === item.id,
          dirty: buffer.hasPending(item.id, 'item'),
          pendingAction: itemPending?.action,
        });
      }
    }

    return result;
  }

  private buildItemMap(items: Item[]): Map<string, Item[]> {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const categoryId = item.category_id ?? '';
      const list = map.get(categoryId) ?? [];
      list.push(item);
      map.set(categoryId, list);
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
    if (node.hashtags?.some(tag => tag.toLowerCase().includes(query))) return true;
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
      cat.items_count = items.filter(i => !!i.category_id && childIds.has(i.category_id)).length;
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
      item.category_name = item.category_id ? (catNameMap[item.category_id] ?? '') : '';
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

  private hasEntityInState(entityType: string, entityId: number): boolean {
    const entityIdString = String(entityId);
    if (entityType === 'category') {
      return this.findCategoryById(entityIdString, this.categories()) !== null;
    }

    if (entityType === 'item') {
      return this.allItems().some(item => item.id === entityIdString);
    }

    if (entityType === 'unit') {
      return this.units().some(unit => unit.id === entityIdString);
    }

    return true;
  }

  private materializeCreatedRecords(
    changes: CatalogPendingChange[],
    response?: CatalogBatchResponse | null,
  ): void {
    const records = response?.records ?? [];
    if (records.length === 0) {
      return;
    }

      const successfulCreates = records.filter(record => (
        record.action === 'create' && record.status === 'applied' && record.entity_id != null
      ));
    if (successfulCreates.length === 0) {
      return;
    }

    const changeMap = new Map(changes.map(change => [`${change.entityType}:${change.localId}`, change]));
    const createdIdMap = new Map(successfulCreates.map(record => [record.local_id, String(record.entity_id!)]));

    let categories = this.categories().map(category => this.cloneCategory(category));
    let items = [...this.allItems()];
    let units = [...this.units()];
    let changed = false;

    for (const record of successfulCreates) {
      if (this.hasEntityInState(record.entity_type, record.entity_id!)) {
        continue;
      }

      const change = changeMap.get(`${record.entity_type}:${record.local_id}`);
      if (!change) {
        continue;
      }

      const entityId = String(record.entity_id);

      if (record.entity_type === 'unit') {
        units = [
          ...units,
          {
            id: entityId,
            name: String(change.payload['name'] ?? ''),
            symbol: String(change.payload['symbol'] ?? ''),
            sort_order: change.payload['sort_order'] != null ? Number(change.payload['sort_order']) : 0,
            is_active: change.payload['is_active'] !== false,
          },
        ];
        changed = true;
        continue;
      }

      if (record.entity_type === 'category') {
        const resolvedParentId = this.resolveCreatedReference(change.payload['parent_local_id'], change.payload['parent_id'], createdIdMap);
        categories = this.insertCategoryIntoTree(categories, {
          id: entityId,
          name: String(change.payload['name'] ?? ''),
          code: String(change.payload['code'] ?? ''),
          parent_id: resolvedParentId,
          sort_order: change.payload['sort_order'] != null ? Number(change.payload['sort_order']) : 0,
          is_active: change.payload['is_active'] !== false,
          children_count: 0,
          items_count: 0,
          children: [],
        });
        changed = true;
        continue;
      }

      if (record.entity_type === 'item') {
        const resolvedCategoryId = this.resolveCreatedReference(change.payload['category_local_id'], change.payload['category_id'], createdIdMap);
        const resolvedUnitId = this.resolveCreatedReference(change.payload['unit_local_id'], change.payload['unit_id'], createdIdMap) ?? '';
        items = [
          ...items,
          {
            id: entityId,
            name: String(change.payload['name'] ?? ''),
            sku: change.payload['sku'] ? String(change.payload['sku']) : '',
            category_id: resolvedCategoryId,
            category_name: null,
            unit_id: resolvedUnitId,
            unit_symbol: units.find(unit => unit.id === resolvedUnitId)?.symbol ?? '',
            is_active: change.payload['is_active'] !== false,
            hashtags: Array.isArray(change.payload['hashtags']) ? change.payload['hashtags'] as string[] : [],
          },
        ];
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    this.computeItemCounts(categories, items);
    this.enrichItemsWithCategoryName(categories, items);
    this.categories.set(categories);
    this.allItems.set(items);
    this.units.set(units);
  }

  private resolveCreatedReference(
    localRef: unknown,
    persistedRef: unknown,
    createdIdMap: Map<string, string>,
  ): string | null {
    if (localRef != null) {
      return createdIdMap.get(String(localRef)) ?? String(localRef);
    }
    if (persistedRef == null || persistedRef === '') {
      return null;
    }
    return String(persistedRef);
  }

  private cloneCategory(category: Category): Category {
    return {
      ...category,
      children: category.children?.map(child => this.cloneCategory(child)) ?? [],
    };
  }

  private insertCategoryIntoTree(categories: Category[], categoryToInsert: Category): Category[] {
    if (!categoryToInsert.parent_id) {
      return [...categories, categoryToInsert];
    }

    const tryInsert = (nodes: Category[]): boolean => {
      for (const node of nodes) {
        if (node.id === categoryToInsert.parent_id) {
          node.children = [...(node.children ?? []), categoryToInsert];
          node.children_count = node.children.length;
          return true;
        }
        if (node.children?.length && tryInsert(node.children)) {
          return true;
        }
      }
      return false;
    };

    if (tryInsert(categories)) {
      return categories;
    }

    return [...categories, categoryToInsert];
  }

  private async reloadBootstrapAfterBatch(
    changes: CatalogPendingChange[],
    response?: CatalogBatchResponse | null,
  ): Promise<void> {
    await this.loadBootstrap({ cacheBust: true });
    this.forceVisibleIds.set(new Set());
    this.materializeCreatedRecords(changes, response);

    const records = response?.records ?? [];

    const missingCreatedRecords = records.filter(record => (
      record.action === 'create'
      && record.status === 'applied'
      && record.entity_id != null
      && !this.hasEntityInState(record.entity_type, record.entity_id)
    ));

    if (missingCreatedRecords.length === 0) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
    await this.loadBootstrap({ cacheBust: true });
  }

  // ─── Batch apply ─────────────────────────────────────────────

  async applyBatch(changes: CatalogPendingChange[]): Promise<void> {
    if (changes.length === 0) return;
    if (this.changeBuffer.disabled()) {
      this.error.set('Cannot apply changes in readonly mode');
      return;
    }
    this.isSaving.set(true);
    this.error.set(null);

    try {
      const batchChanges: CatalogBatchChange[] = changes.map(c => ({
        local_id: c.localId,
        entity_type: c.entityType as 'unit' | 'category' | 'item',
        action: c.action as 'create' | 'update' | 'deactivate' | 'delete' | 'merge',
        entity_id: c.entityId,
        payload: c.payload,
      }));

      const batchRequest: CatalogBatchRequest = {
        client_batch_id: `catalog-ui-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 8)}`,
        mode: 'atomic',
        changes: batchChanges,
      };

      const response = await firstValueFrom(this.bff.postData<CatalogBatchResponse>('/catalog/admin/batch', batchRequest));
      await this.reloadBootstrapAfterBatch(changes, response);
    } catch (err: any) {
      this.error.set(err?.message || 'Batch apply failed');
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }
}
