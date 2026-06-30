import { Component, input, output } from '@angular/core';
import { CatalogTreeNodeVm } from '../../../core/models/nomenclature.models';

@Component({
  selector: 'app-catalog-tree-node',
  standalone: true,
  template: `
    <div class="node-wrapper">
      <div
        class="tree-row"
        [class.selected]="node().selected"
        [class.dirty]="node().dirty"
        [class.inactive]="!node().isActive"
        [class.error]="node().error"
        [class.pending-delete]="node().pendingAction === 'delete'"
        [class.pending-merge]="node().pendingAction === 'merge'"
        [style.padding-left.px]="node().level * 16"
        (click)="select.emit(node())"
      >
        @if (node().type === 'category') {
          <button
            class="toggle-btn"
            [class.expanded]="node().expanded"
            [class.invisible]="!(node().children?.length)"
            (click)="onToggle($event)"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 1L7 5L3 9" stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        } @else {
          <span class="bullet"></span>
        }

        <div class="node-content">
          <span class="node-name">{{ node().name }}</span>
          @if (node().sku) {
            <span class="node-meta">SKU: {{ node().sku }}</span>
          }
          @if (node().meta) {
            <span class="node-meta">{{ node().meta }}</span>
          }
        </div>

        <div class="node-badges">
          @if (node().pendingAction === 'delete') {
            <span class="wh-badge badge badge-delete">удалено</span>
          }
          @if (node().pendingAction === 'merge') {
            <span class="wh-badge badge badge-merge">сливается</span>
          }
          @if (node().dirty && node().pendingAction !== 'delete' && node().pendingAction !== 'merge') {
            <span class="wh-badge badge badge-dirty">изменено</span>
          }
          @if (!node().isActive && node().pendingAction !== 'merge') {
            <span class="wh-badge badge badge-inactive">неактивно</span>
          }
          @if (node().error) {
            <span class="wh-badge badge badge-error">ошибка</span>
          }
        </div>
      </div>

      @if (node().expanded && (node().children?.length ?? 0) > 0) {
        <div class="children">
          @for (child of node().children; track child.id) {
            <app-catalog-tree-node
              [node]="child"
              (select)="select.emit($event)"
              (toggle)="toggle.emit($event)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .node-wrapper { user-select: none; }
    .tree-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.1s;
      min-height: 36px;
      border: 1px solid transparent;
      margin: 1px 0;
    }
    .tree-row:hover { background: #F9FAFB; }
    .tree-row.selected {
      background: #EFF6FF;
      border-color: #93C5FD;
    }
    .tree-row.selected .node-name { font-weight: 600; }
    .tree-row.dirty { background: #FFFBEB; }
    .tree-row.error {
      background: #FEF2F2;
      border-color: #FCA5A5;
    }
    .tree-row.inactive .node-name { color: #9CA3AF; }
    .tree-row.pending-delete {
      opacity: 0.5;
      text-decoration: line-through;
      background: #FEF2F2;
      border-color: #FECACA;
    }
    .tree-row.pending-delete .node-name { color: #991B1B; }
    .tree-row.pending-merge {
      background: #F0FDF4;
      border-color: #86EFAC;
    }
    .tree-row.pending-merge .node-name {
      color: #166534;
    }

    .toggle-btn {
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
      padding: 0;
      transition: transform 0.15s;
    }
    .toggle-btn:hover { background: #F3F4F6; }
    .toggle-btn.expanded { transform: rotate(90deg); }
    .toggle-btn.invisible { visibility: hidden; }

    .bullet {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bullet::before {
      content: '';
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #9CA3AF;
    }

    .node-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .node-name {
      font-size: 13px;
      color: #111827;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .node-meta {
      font-size: 11px;
      color: #6B7280;
    }

    .node-badges {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .badge-delete {
      background: #FEE2E2;
      color: #991B1B;
      font-size: 10px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .badge-merge {
      background: #DCFCE7;
      color: #166534;
      font-size: 10px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .children { padding-left: 4px; }
  `]
})
export class CatalogTreeNodeComponent {
  readonly node = input.required<CatalogTreeNodeVm>();
  readonly select = output<CatalogTreeNodeVm>();
  readonly toggle = output<CatalogTreeNodeVm>();

  onToggle(event: MouseEvent) {
    event.stopPropagation();
    this.toggle.emit(this.node());
  }
}
