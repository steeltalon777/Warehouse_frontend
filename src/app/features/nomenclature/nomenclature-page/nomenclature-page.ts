import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { NomenclatureService } from '../../../core/services/nomenclature.service';
import { CatalogChangeBufferService } from '../../../core/services/catalog-change-buffer.service';
import { AuthContextService } from '../../../core/services/auth-context.service';
import { PageHeaderComponent } from '../page-header/page-header';
import { SearchInputComponent } from '../search-input/search-input';
import { ActionButtonsComponent } from '../action-buttons/action-buttons';
import { CatalogTreeComponent } from '../catalog-tree/catalog-tree';
import { RightPanelComponent } from '../right-panel/right-panel';
import { PendingChangesBarComponent } from '../pending-changes-bar/pending-changes-bar';
import { MergeItemModalComponent } from '../merge-item-modal/merge-item-modal';
import { MergeCategoryModalComponent } from '../merge-category-modal/merge-category-modal';
import { Category, Item } from '../../../core/models/nomenclature.models';

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
    MergeItemModalComponent,
    MergeCategoryModalComponent,
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
            <div class="tabs">
              <button
                class="tab-btn"
                [class.active]="activeTab() === 'catalog'"
                (click)="onTabChange('catalog')"
              >
                Категории и ТМЦ
              </button>
              <button
                class="tab-btn"
                [class.active]="activeTab() === 'units'"
                (click)="onTabChange('units')"
              >
                Единицы измерения
              </button>
            </div>
            <app-search-input
              [value]="searchQuery()"
              (valueChange)="onSearchChange($event)"
            />
            <app-action-buttons
              [mode]="activeTab()"
              (createCategory)="onCreateCategory()"
              (createItem)="onCreateItem()"
              (createUnit)="onCreateUnit()"
              (expandAll)="onExpandAll()"
            />
            <div class="tree-wrapper">
              <app-catalog-tree
                [nodes]="currentTreeNodes()"
                [visibleCount]="currentVisibleCount()"
                [title]="activeTab() === 'catalog' ? 'Категории и ТМЦ' : 'Единицы измерения'"
                [subtitle]="activeTab() === 'catalog' ? 'Дерево с inline-редактированием' : 'Список единиц измерения'"
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
              [selectedUnit]="selectedUnit()"
              [units]="units()"
              [categories]="categories()"
              [createModeEntity]="createModeEntity()"
              (saveDraft)="onSaveDraft($event)"
              (resetDraft)="onResetDraft()"
              (deactivate)="onDeactivate($event)"
              (delete)="onDelete($event)"
              (mergeRequest)="onMergeRequest($event)"
            />
          </div>
        </div>
      }

      @if (mergeItemSource()) {
        <app-merge-item-modal
          [sourceItem]="mergeItemSource()!"
          (mergeComplete)="onItemMergeComplete()"
          (cancel)="mergeItemSource.set(null)"
        />
      }
      @if (mergeCategorySource()) {
        <app-merge-category-modal
          [sourceCategory]="mergeCategorySource()!"
          [allCategories]="categories()"
          (mergeComplete)="onCategoryMergeComplete()"
          (cancel)="mergeCategorySource.set(null)"
        />
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
      min-height: 0;
    }
    .tree-wrapper {
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
      border-bottom: 1px solid #E5E7EB;
      padding-bottom: 0;
    }
    .tab-btn {
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      color: #6B7280;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }
    .tab-btn:hover { color: #374151; }
    .tab-btn.active {
      color: #2563EB;
      border-bottom-color: #2563EB;
    }

    .right-panel-wrapper {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      overflow: hidden;
      min-height: 0;
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
  private readonly authContextService = inject(AuthContextService);

  ngOnInit(): void {
    this.authContextService.load();
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
  readonly units = this.service.allUnits;
  readonly categories = this.service.allCategories;

  readonly selectedItem = computed(() => this.service.getSelectedItem());
  readonly selectedCategory = computed(() => this.service.getSelectedCategory());
  readonly selectedUnit = computed(() => this.service.selectedUnit());
  readonly pendingCount = computed(() => this.changeBuffer.count());
  readonly applyDisabled = computed(() => this.changeBuffer.isEmpty());

  readonly activeTab = signal<'catalog' | 'units'>('catalog');
  readonly currentTreeNodes = computed(() =>
    this.activeTab() === 'catalog' ? this.service.unifiedTree() : this.service.unitListNodes()
  );
  readonly currentVisibleCount = computed(() =>
    this.activeTab() === 'catalog' ? this.service.visibleNodeCount() : this.service.unitListNodes().length
  );

  readonly createModeEntity = signal<{ type: 'category' | 'item' | 'unit'; entity: unknown } | null>(null);

  // Merge modal state
  readonly mergeItemSource = signal<Item | null>(null);
  readonly mergeCategorySource = signal<Category | null>(null);

  onSearchChange(query: string): void {
    this.service.setSearch(query);
  }

  onTabChange(tab: 'catalog' | 'units'): void {
    this.activeTab.set(tab);
    this.service.clearSelection();
    this.createModeEntity.set(null);
    this.service.setSearch('');
  }

  onSelectNode(node: { id: string; type: string }): void {
    this.createModeEntity.set(null);
    this.service.selectNode(node as any);
  }

  onToggleExpand(id: string): void {
    this.service.toggleExpand(id);
  }

  onExpandAll(): void {
    if (this.activeTab() === 'catalog') {
      this.service.expandAll();
    }
  }

  onCreateCategory(): void {
    this.service.clearSelection();
    this.createModeEntity.set({ type: 'category', entity: null });
  }

  onCreateItem(): void {
    this.service.clearSelection();
    this.createModeEntity.set({ type: 'item', entity: null });
  }

  onCreateUnit(): void {
    this.service.clearSelection();
    this.createModeEntity.set({ type: 'unit', entity: null });
  }

  onSaveDraft(event: { id: string; payload: Record<string, unknown> }): void {
    const cm = this.createModeEntity();
    if (cm && event.id === '__new__') {
      const tmpId = `tmp-${cm.type}-${Date.now()}`;
      this.changeBuffer.addChange({
        localId: `${cm.type}-${tmpId}`,
        entityType: cm.type,
        action: 'create',
        payload: event.payload,
      });
      this.createModeEntity.set(null);
      return;
    }

    const sel = this.service.selectedEntity();
    if (!sel) return;

    this.changeBuffer.addChange({
      localId: `${sel.type}-${event.id}`,
      entityType: sel.type,
      entityId: event.id,
      action: 'update',
      payload: event.payload,
    });
  }

  onResetDraft(): void {
    // Form reset handled internally by the form component
  }

  onDeactivate(id: string): void {
    const cm = this.createModeEntity();
    if (cm) return;

    const sel = this.service.selectedEntity();
    if (!sel) return;

    this.changeBuffer.addChange({
      localId: `${sel.type}-${id}-deactivate`,
      entityType: sel.type,
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

    const count = changes.length;
    const msg = count === 1
      ? 'Применить 1 изменение? Это действие нельзя отменить.'
      : `Применить ${count} изменений? Это действие нельзя отменить.`;
    if (!confirm(msg)) return;

    try {
      await this.service.applyBatch(changes);
      this.changeBuffer.clearAll();
      this.createModeEntity.set(null);
    } catch (err: any) {
      console.error('Batch apply failed:', err);
    }
  }

  onDelete(id: string): void {
    const cm = this.createModeEntity();
    if (cm) {
      this.createModeEntity.set(null);
      return;
    }

    const sel = this.service.selectedEntity();
    if (!sel) return;

    this.changeBuffer.addChange({
      localId: `${sel.type}-${id}-delete`,
      entityType: sel.type,
      entityId: id,
      action: 'delete',
      payload: {},
    });

    this.service.clearSelection();
  }

  onMergeRequest(id: string): void {
    const sel = this.service.selectedEntity();
    if (!sel) return;

    if (sel.type === 'item') {
      const item = this.service.getSelectedItem();
      if (item) this.mergeItemSource.set(item);
    } else if (sel.type === 'category') {
      const cat = this.service.getSelectedCategory();
      if (cat) this.mergeCategorySource.set(cat);
    }
  }

  async onItemMergeComplete(): Promise<void> {
    this.mergeItemSource.set(null);
    this.service.clearSelection();
    await this.service.loadBootstrap();
  }

  async onCategoryMergeComplete(): Promise<void> {
    this.mergeCategorySource.set(null);
    this.service.clearSelection();
    await this.service.loadBootstrap();
  }
}
