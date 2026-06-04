import { Component, input, output } from '@angular/core';
import { CatalogTreeNodeVm } from '../../../core/models/nomenclature.models';
import { CatalogTreeNodeComponent } from '../catalog-tree-node/catalog-tree-node';

@Component({
  selector: 'app-catalog-tree',
  standalone: true,
  imports: [CatalogTreeNodeComponent],
  template: `
    <div class="catalog-tree-panel">
      <div class="tree-header">
        <div>
          <h2 class="tree-title">{{ title() }}</h2>
          <p class="tree-subtitle">{{ subtitle() }}</p>
        </div>
        <span class="tree-count">{{ visibleCount() }} элементов</span>
      </div>
      <div class="tree-scroll">
        @for (node of nodes(); track node.id) {
          <app-catalog-tree-node
            [node]="node"
            (select)="select.emit($event)"
            (toggle)="toggle.emit($event)"
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
    :host { display: block; height: 100%; }
    .catalog-tree-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #FFFFFF;
      min-height: 0;
    }
    .tree-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 16px 16px 8px;
      flex-shrink: 0;
      gap: 8px;
    }
    .tree-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin: 0;
    }
    .tree-subtitle {
      font-size: 13px;
      color: #6B7280;
      margin: 2px 0 0;
    }
    .tree-count {
      font-size: 11px;
      color: #9CA3AF;
      flex-shrink: 0;
    }
    .tree-scroll {
      flex: 1;
      overflow-y: auto;
      padding: 4px 12px 16px;
    }
    .tree-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80px;
      color: #9CA3AF;
      font-size: 13px;
    }
  `]
})
export class CatalogTreeComponent {
  readonly nodes = input<CatalogTreeNodeVm[]>([]);
  readonly visibleCount = input<number>(0);
  readonly title = input<string>('Категории и ТМЦ');
  readonly subtitle = input<string>('Дерево с inline-редактированием');
  readonly select = output<CatalogTreeNodeVm>();
  readonly toggle = output<CatalogTreeNodeVm>();
}
