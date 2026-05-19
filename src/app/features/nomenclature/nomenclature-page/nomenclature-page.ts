import { Component, computed, inject, OnInit } from '@angular/core';
import { NomenclatureService } from '../../../core/services/nomenclature.service';
import { CatalogChangeBufferService } from '../../../core/services/catalog-change-buffer.service';
import { PageHeaderComponent } from '../page-header/page-header';
import { SearchInputComponent } from '../search-input/search-input';
import { ActionButtonsComponent } from '../action-buttons/action-buttons';
import { CatalogTreeComponent } from '../catalog-tree/catalog-tree';
import { RightPanelComponent } from '../right-panel/right-panel';
import { PendingChangesBarComponent } from '../pending-changes-bar/pending-changes-bar';

@Component({
  selector: 'app-nomenclature-page',
  standalone: true,
  imports: [
    PageHeaderComponent,
    SearchInputComponent,
    ActionButtonsComponent,
    CatalogTreeComponent,
    RightPanelComponent,
    PendingChangesBarComponent,
  ],
  template: `
    <div class="wh-page page">
      <!-- Page header -->
      <app-page-header
        [applyDisabled]="applyDisabled()"
        (applyAll)="onApplyAll()"
      />

      @if (isLoading()) {
        <div class="wh-state wh-state--loading loading-overlay">
          <div class="spinner"></div>
          <span>Загрузка данных...</span>
        </div>
      } @else if (error()) {
        <div class="wh-state wh-state--error error-banner">{{ error() }}</div>
      } @else {
        <div class="wh-workspace workspace">
          <!-- Left panel: tree -->
          <div class="wh-panel left-panel">
            <app-search-input
              [value]="searchQuery()"
              (valueChange)="onSearchChange($event)"
            />
            <app-action-buttons
              (expandAll)="onExpandAll()"
            />
            <div class="tree-wrapper">
              <app-catalog-tree
                [nodes]="unifiedTree()"
                [visibleCount]="visibleNodeCount()"
                (select)="onSelectNode($event)"
                (toggle)="onToggleExpand($event.id)"
              />
            </div>
            <app-pending-changes-bar
              [count]="pendingCount()"
              [isSaving]="isSaving()"
              (reset)="onResetAll()"
              (apply)="onApplyAll()"
            />
          </div>

          <!-- Right panel: form or empty state -->
          <div class="wh-panel right-panel-wrapper">
            <app-right-panel
              [selectedNode]="selectedNode()"
              [selectedItem]="selectedItem()"
              [selectedCategory]="selectedCategory()"
              [units]="units()"
              [categories]="categories()"
              (saveDraft)="onSaveDraft($event)"
              (resetDraft)="onResetDraft()"
              (deactivate)="onDeactivate($event)"
              (delete)="onDelete($event)"
            />
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .page {
      display: flex;
      flex-direction: column;
      flex: 1;
      background: #F3F4F6;
      min-height: 0;
    }

    .workspace {
      flex: 1;
      display: grid;
      grid-template-columns: 456px 1fr;
      gap: 16px;
      overflow: hidden;
      padding: 12px 16px 16px;
      min-height: 0;
    }

    .left-panel {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 20px 16px 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .tree-wrapper {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .right-panel-wrapper {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      overflow: hidden;
    }

    .loading-overlay {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #6B7280;
      font-size: 14px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #E5E7EB;
      border-top-color: #3B82F6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .error-banner {
      margin: 16px 24px;
      padding: 12px 16px;
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FECACA;
      border-radius: 8px;
      font-size: 14px;
    }

    @media (max-width: 1200px) {
      .workspace { grid-template-columns: 360px 1fr; }
    }
    @media (max-width: 900px) {
      .workspace { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
      .right-panel-wrapper { min-height: 300px; }
    }
  `]
})
export class NomenclaturePageComponent implements OnInit {
  private readonly service = inject(NomenclatureService);
  private readonly changeBuffer = inject(CatalogChangeBufferService);

  ngOnInit(): void {
    this.service.loadBootstrap();
  }

  // Signals
  readonly isLoading = this.service.isLoading;
  readonly error = this.service.error;
  readonly searchQuery = this.service.searchQuery;
  readonly unifiedTree = this.service.unifiedTree;
  readonly visibleNodeCount = this.service.visibleNodeCount;
  readonly selectedNode = this.service.selectedNode;
  readonly isSaving = this.service.isSaving;
  readonly units = this.service.units;
  readonly categories = this.service.categories;

  readonly selectedItem = computed(() => this.service.getSelectedItem());
  readonly selectedCategory = computed(() => this.service.getSelectedCategory());
  readonly pendingCount = computed(() => this.changeBuffer.count());
  readonly applyDisabled = computed(() => this.changeBuffer.isEmpty());

  onSearchChange(query: string): void {
    this.service.setSearch(query);
  }

  onSelectNode(node: { id: string; type: 'category' | 'item' }): void {
    this.service.selectNode(node as any);
  }

  onToggleExpand(id: string): void {
    this.service.toggleExpand(id);
  }

  onExpandAll(): void {
    this.service.expandAll();
  }

  onSaveDraft(event: { id: string; payload: Record<string, unknown> }): void {
    const node = this.selectedNode();
    if (!node) return;

    this.changeBuffer.addChange({
      localId: `${node.type}-${event.id}`,
      entityType: node.type,
      entityId: event.id,
      action: 'update',
      payload: event.payload,
    });
  }

  onResetDraft(): void {
    // Form reset handled internally by the form component
  }

  onDeactivate(id: string): void {
    const node = this.selectedNode();
    if (!node) return;

    this.changeBuffer.addChange({
      localId: `${node.type}-${id}-deactivate`,
      entityType: node.type,
      entityId: id,
      action: 'deactivate',
      payload: { is_active: false },
    });
  }

  onResetAll(): void {
    this.changeBuffer.clearAll();
  }

  async onApplyAll(): Promise<void> {
    const changes = this.changeBuffer.changes();
    if (changes.length === 0) return;

    try {
      await this.service.applyBatch(changes);
      this.changeBuffer.clearAll();
    } catch (err: any) {
      // Error is already set in service.error
      console.error('Batch apply failed:', err);
    }
  }

  onDelete(id: string): void {
    const node = this.selectedNode();
    if (!node) return;

    this.changeBuffer.addChange({
      localId: `${node.type}-${id}-delete`,
      entityType: node.type,
      entityId: id,
      action: 'delete',
      payload: {},
    });

    // Clear selection since the entity will be deleted
    this.service.clearSelection();
  }
}
