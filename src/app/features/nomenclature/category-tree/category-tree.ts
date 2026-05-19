import { Component, input, output } from '@angular/core';
import { Category } from '../../../core/models/nomenclature.models';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  template: `
    <div class="tree-node-wrapper">
      <div
        class="tree-node"
        [class.selected]="category().id === selectedId()"
        (click)="onSelect()"
      >
        <button
          class="tree-toggle"
          [class.expanded]="expandedIds().has(category().id)"
          [class.invisible]="!category().children?.length"
          (click)="onToggle(); $event.stopPropagation()"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 1L7 5L3 9" stroke="#9CA3AF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="tree-node-name">{{ category().name }}</span>
        <span class="tree-node-count">{{ category().items_count }}</span>
      </div>
      @if (expandedIds().has(category().id) && (category().children?.length ?? 0) > 0) {
        <div class="tree-children">
          @for (child of category().children; track child.id) {
            <app-tree-node
              [category]="child"
              [selectedId]="selectedId()"
              [expandedIds]="expandedIds()"
              (selectCategory)="selectCategory.emit($event)"
              (toggleCategory)="toggleCategory.emit($event)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tree-node-wrapper { user-select: none; }
    .tree-node {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;
      min-height: 32px;
    }
    .tree-node:hover { background: #f9fafb; }
    .tree-node.selected {
      background: #eef2ff;
      color: #4338ca;
    }
    .tree-node.selected .tree-node-name { font-weight: 500; }
    .tree-toggle {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      border-radius: 4px;
      transition: transform 0.15s;
      padding: 0;
    }
    .tree-toggle:hover { background: #f3f4f6; }
    .tree-toggle.expanded { transform: rotate(90deg); }
    .tree-toggle.invisible { visibility: hidden; }
    .tree-node-name {
      flex: 1;
      font-size: 13px;
      color: #374151;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tree-node-count {
      font-size: 11px;
      color: #9ca3af;
      background: #f3f4f6;
      padding: 1px 6px;
      border-radius: 999px;
      flex-shrink: 0;
    }
    .tree-children {
      padding-left: 12px;
    }
  `]
})
export class TreeNodeComponent {
  readonly category = input.required<Category>();
  readonly selectedId = input<string | null>(null);
  readonly expandedIds = input<Set<string>>(new Set());
  readonly selectCategory = output<string>();
  readonly toggleCategory = output<string>();

  onSelect() { this.selectCategory.emit(this.category().id); }
  onToggle() { this.toggleCategory.emit(this.category().id); }
}

@Component({
  selector: 'app-category-tree',
  standalone: true,
  imports: [TreeNodeComponent],
  template: `
    <div class="tree-panel">
      <div class="tree-header">
        <h2 class="tree-title">Категории</h2>
        <span class="tree-count">{{ categories().length }} корневых</span>
      </div>
      <div class="tree-scroll">
        @for (cat of categories(); track cat.id) {
          <app-tree-node
            [category]="cat"
            [selectedId]="selectedCategoryId()"
            [expandedIds]="expandedIds()"
            (selectCategory)="selectCategory.emit($event)"
            (toggleCategory)="toggleExpand.emit($event)"
          />
        } @empty {
          <div class="tree-empty">
            <p>Нет категорий</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .tree-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border-right: 1px solid #f3f4f6;
    }
    .tree-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 16px 8px;
      flex-shrink: 0;
    }
    .tree-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tree-count {
      font-size: 11px;
      color: #9ca3af;
    }
    .tree-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 4px 8px 16px;
    }
    .tree-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80px;
      color: #9ca3af;
      font-size: 13px;
    }
  `]
})
export class CategoryTreeComponent {
  readonly categories = input<Category[]>([]);
  readonly selectedCategoryId = input<string | null>(null);
  readonly expandedIds = input<Set<string>>(new Set());
  readonly selectCategory = output<string>();
  readonly toggleExpand = output<string>();
}
