import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { IssueObjectCategoriesService } from '../../../../core/services/issue-object-categories.service';
import { IssueRepositoryTreeNode } from '../../../../core/models/issue-objects.models';
import { RepositorySelectionService } from '../../services/repository-selection.service';

interface TreeViewNode {
  node: IssueRepositoryTreeNode;
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
}

@Component({
  selector: 'app-repository-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tree-panel">
      <div class="tree-toolbar">
        <div class="search-box">
          <input
            type="text"
            class="wh-form-input input search-input"
            [ngModel]="selection.searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Поиск по категории, объекту или комментарию..."
          />
        </div>
        <div class="toolbar-buttons">
          <button class="wh-btn wh-btn--primary btn btn-primary" (click)="onCreateObject()">+ Объект выдачи</button>
          <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCreateCategory()">+ Категория выдачи</button>
        </div>
        <div class="toolbar-controls">
          <button class="wh-btn-icon btn-icon" title="Развернуть всё" (click)="expandAll()">⤓</button>
          <button class="wh-btn-icon btn-icon" title="Свернуть всё" (click)="collapseAll()">⤒</button>
        </div>
      </div>

      <div class="tree-body">
        @if (service.treeLoading()) {
          <div class="wh-state wh-state--loading loading-state">
            <div class="spinner"></div>
            <span>Загрузка...</span>
          </div>
        } @else if (service.error(); as err) {
          <div class="wh-state wh-state--error error-state">{{ err }}</div>
        } @else {
          <ul class="tree-list" role="tree">
            @for (item of visibleNodes(); track item.node.id) {
              <li class="tree-item"
                [class.tree-item--category]="item.node.type === 'category'"
                [class.tree-item--object]="item.node.type === 'object'"
                [class.tree-item--inactive]="!item.node.is_active"
                [class.tree-item--selected]="isSelected(item.node)"
                role="treeitem"
                [attr.aria-expanded]="item.node.type === 'category' ? item.expanded : null"
                [attr.aria-selected]="isSelected(item.node)">
                <div class="tree-row" [style.padding-left.px]="item.depth * 16 + 4">
                  @if (item.node.type === 'category') {
                    <button class="tree-toggle" (click)="toggleCategory(item.node.id)" [attr.aria-label]="item.expanded ? 'Свернуть' : 'Развернуть'">
                      {{ item.expanded ? '▾' : '▸' }}
                    </button>
                  } @else {
                    <span class="tree-toggle-spacer"></span>
                  }
                  <button class="tree-label" (click)="onNodeClick(item.node)" [title]="nodeTooltip(item.node)">
                    <span class="node-icon" [class.node-icon--category]="item.node.type === 'category'" [class.node-icon--object]="item.node.type === 'object'">
                      {{ item.node.type === 'category' ? '▦' : '◎' }}
                    </span>
                    <span class="node-name">{{ item.node.name }}</span>
                    @if (item.node.type === 'object' && item.node.comment) {
                      <span class="node-comment-hint" [title]="item.node.comment">«{{ item.node.comment }}»</span>
                    }
                    @if (!item.node.is_active) {
                      <span class="inactive-tag">неактивен</span>
                    }
                  </button>
                </div>
              </li>
            } @empty {
              <li class="tree-empty">Нет данных</li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .tree-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #FFFFFF; border-right: 1px solid #E2E8F0; }

    .tree-toolbar { flex-shrink: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #E2E8F0; }
    .search-box { width: 100%; }
    .search-input { width: 100%; height: 32px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; box-sizing: border-box; }
    .search-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }

    .toolbar-buttons { display: flex; gap: 6px; }
    .toolbar-controls { display: flex; gap: 4px; }

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 32px; padding: 0 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
    .btn-icon { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #E2E8F0; border-radius: 6px; background: #FFFFFF; color: #64748B; cursor: pointer; font-size: 14px; }
    .btn-icon:hover:not(:disabled) { background: #F1F5F9; color: #374151; border-color: #CBD5E1; }

    .tree-body { flex: 1; overflow-y: auto; padding: 4px 0; min-height: 0; }
    .tree-list { list-style: none; margin: 0; padding: 0; }
    .tree-list--nested { padding: 0; }

    .tree-item { font-size: 13px; color: #1F2937; }
    .tree-item--inactive .node-name { opacity: 0.55; font-style: italic; }
    .tree-item--selected > .tree-row .tree-label { background: #DBEAFE; color: #1E3A8A; }
    .tree-item--selected > .tree-row .tree-label .node-name { font-weight: 600; }

    .tree-row { display: flex; align-items: center; gap: 2px; padding-right: 8px; }
    .tree-toggle { width: 20px; height: 24px; border: none; background: transparent; cursor: pointer; color: #64748B; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; }
    .tree-toggle:hover { background: #F1F5F9; color: #334155; }
    .tree-toggle-spacer { display: inline-block; width: 20px; }

    .tree-label { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: none; background: transparent; text-align: left; cursor: pointer; border-radius: 4px; font-size: 13px; font-family: inherit; color: inherit; }
    .tree-label:hover:not(:disabled) { background: #F1F5F9; }

    .node-icon { font-size: 12px; color: #64748B; }
    .node-icon--category { color: #6366F1; }
    .node-icon--object { color: #0EA5E9; }

    .node-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .node-comment-hint { color: #94A3B8; font-size: 11px; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
    .inactive-tag { margin-left: 4px; padding: 1px 6px; background: #FEE2E2; color: #991B1B; border-radius: 4px; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }

    .tree-empty { padding: 24px 16px; text-align: center; color: #94A3B8; font-size: 13px; }

    .loading-state, .error-state { display: flex; align-items: center; justify-content: center; gap: 8px; color: #64748B; font-size: 13px; padding: 24px; }
    .spinner { width: 20px; height: 20px; border: 2px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class RepositoryTreeComponent implements OnInit {
  readonly service = inject(IssueObjectsService);
  readonly categoriesService = inject(IssueObjectCategoriesService);
  readonly selection = inject(RepositorySelectionService);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private expanded = signal<Set<string>>(new Set<string>());

  private readonly filteredTree = computed(() => {
    const tree = this.service.tree();
    const q = this.selection.searchQuery().trim().toLowerCase();
    if (!q) return tree;
    return this.filterNodes(tree, q);
  });

  readonly visibleNodes = computed<TreeViewNode[]>(() => {
    const tree = this.filteredTree();
    const expanded = this.expanded();
    const result: TreeViewNode[] = [];
    this.walk(tree, 0, expanded, result);
    return result;
  });

  ngOnInit(): void {
    void this.service.loadTree({ include_inactive: false, include_deleted: false });
  }

  onSearchChange(value: string): void {
    this.selection.setSearch(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.service.loadTree({ search: value || undefined, include_inactive: false, include_deleted: false });
    }, 300);
  }

  onCreateObject(): void {
    this.selection.requestCreateObject();
  }

  onCreateCategory(): void {
    this.selection.requestCreateCategory();
  }

  toggleCategory(id: string): void {
    const next = new Set(this.expanded());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expanded.set(next);
  }

  expandAll(): void {
    const next = new Set<string>();
    const visit = (nodes: IssueRepositoryTreeNode[]): void => {
      for (const n of nodes) {
        if (n.type === 'category' && n.children && n.children.length) {
          next.add(n.id);
          visit(n.children);
        }
      }
    };
    visit(this.service.tree());
    this.expanded.set(next);
  }

  collapseAll(): void {
    this.expanded.set(new Set<string>());
  }

  onNodeClick(node: IssueRepositoryTreeNode): void {
    if (node.type === 'category') {
      this.selection.selectCategory(node.id);
    } else {
      this.selection.selectObject(node.id);
    }
  }

  isSelected(node: IssueRepositoryTreeNode): boolean {
    if (node.type === 'category') {
      return this.selection.selectedCategoryId() === node.id;
    }
    return this.selection.selectedObjectId() === node.id;
  }

  nodeTooltip(node: IssueRepositoryTreeNode): string {
    if (node.type === 'object' && node.comment) {
      return `${node.name}\n${node.comment}`;
    }
    return node.name;
  }

  private filterNodes(nodes: IssueRepositoryTreeNode[], q: string): IssueRepositoryTreeNode[] {
    const result: IssueRepositoryTreeNode[] = [];
    for (const node of nodes) {
      if (node.type === 'category') {
        const filteredChildren = node.children ? this.filterNodes(node.children, q) : [];
        const selfMatch = node.name.toLowerCase().includes(q);
        if (selfMatch || filteredChildren.length) {
          result.push({ ...node, children: filteredChildren });
        }
      } else {
        const nameMatch = node.name.toLowerCase().includes(q);
        const commentMatch = node.comment ? node.comment.toLowerCase().includes(q) : false;
        if (nameMatch || commentMatch) {
          result.push(node);
        }
      }
    }
    return result;
  }

  private walk(nodes: IssueRepositoryTreeNode[], depth: number, expanded: Set<string>, out: TreeViewNode[]): void {
    for (const node of nodes) {
      const isExpanded = expanded.has(node.id);
      const hasChildren = node.type === 'category' && !!node.children && node.children.length > 0;
      out.push({ node, depth, expanded: isExpanded, hasChildren });
      if (node.type === 'category' && isExpanded && node.children) {
        this.walk(node.children, depth + 1, expanded, out);
      }
    }
  }
}
