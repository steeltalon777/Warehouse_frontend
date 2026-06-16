import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
        [canWrite]="canWriteCatalog()"
        [title]="catalogMode() === 'readonly' ? 'Каталог' : 'Номенклатура'"
        [subtitle]="catalogMode() === 'readonly' ? 'Просмотр категорий, ТМЦ, единиц измерения и ключевых слов' : 'Категории, ТМЦ, SKU, единицы измерения и ключевые слова. Изменения копятся локально и применяются батчем.'"
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
              [canWrite]="canWriteCatalog()"
              (createCategory)="onCreateCategory()"
              (createItem)="onCreateItem()"
              (createUnit)="onCreateUnit()"
              (expandAll)="onExpandAll()"
              (collapseAll)="onCollapseAll()"
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
            @if (canWriteCatalog()) {
              <app-pending-changes-bar
                [count]="pendingCount()"
                [isSaving]="isSaving()"
                (reset)="onResetAll()"
                (apply)="onApplyAll()"
              />
            }
          </div>

          <!-- Right panel: form or empty state -->
          <div class="wh-panel right-panel-wrapper">
            <app-right-panel
              [canWrite]="canWriteCatalog()"
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

      @if (mergeItemModal()) {
        <app-merge-item-modal
          [sourceItem]="selectedItem()!"
          (cancel)="mergeItemModal.set(null)"
          (mergeComplete)="mergeItemModal.set(null)"
        />
      }

      @if (mergeCategoryModal()) {
        <app-merge-category-modal
          [sourceCategory]="selectedCategory()!"
          (cancel)="mergeCategoryModal.set(null)"
          (mergeComplete)="mergeCategoryModal.set(null)"
        />
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .wh-page { height: 100%; display: flex; flex-direction: column; }
    .wh-workspace {
      flex: 1;
      display: flex;
      gap: 0;
      min-height: 0;
    }
    .left-panel {
      width: 420px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #E5E7EB;
      background: #F9FAFB;
    }
    .right-panel-wrapper {
      flex: 1;
      min-width: 0;
      background: #FFFFFF;
    }
    .tabs {
      display: flex;
      border-bottom: 1px solid #E5E7EB;
      background: #FFFFFF;
      padding: 0 16px;
    }
    .tab-btn {
      border: 0;
      background: transparent;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 500;
      color: #6B7280;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .tab-btn.active {
      color: #2563EB;
      border-bottom-color: #2563EB;
    }
    .tree-wrapper {
      flex: 1;
      min-height: 0;
    }
    .loading-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px;
      color: #6B7280;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #E5E7EB;
      border-top-color: #2563EB;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-banner {
      padding: 16px;
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FECACA;
      border-radius: 8px;
      margin: 16px;
    }
  `]
})
export class NomenclaturePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(NomenclatureService);
  private readonly changeBuffer = inject(CatalogChangeBufferService);
  private readonly auth = inject(AuthContextService);

  readonly catalogMode = signal<'readonly' | 'editable'>('editable');
  readonly canWriteCatalog = computed(() => {
    const role = this.auth.authContext()?.role;
    return role === 'root' || role === 'chief_storekeeper';
  });

  readonly activeTab = signal<'catalog' | 'units'>('catalog');
  readonly createModeEntity = signal<{ type: 'category' | 'item' | 'unit'; entity: null } | null>(null);
  readonly mergeItemModal = signal<Item | null>(null);
  readonly mergeCategoryModal = signal<Category | null>(null);

  readonly isLoading = this.service.isLoading;
  readonly error = this.service.error;
  readonly isSaving = this.service.isSaving;

  readonly searchQuery = this.service.searchQuery;

  readonly currentTreeNodes = computed(() => {
    return this.activeTab() === 'catalog' ? this.service.unifiedTree() : this.service.unitListNodes();
  });

  readonly currentVisibleCount = computed(() => {
    return this.activeTab() === 'catalog' ? this.service.visibleNodeCount() : this.service.unitListNodes().length;
  });

  readonly selectedNode = this.service.selectedNode;
  readonly selectedItem = computed(() => {
    const sel = this.service.selectedEntity();
    if (sel?.type !== 'item') return null;
    return this.service.allItems().find(i => i.id === sel.id) ?? null;
  });
  readonly selectedCategory = computed(() => {
    const sel = this.service.selectedEntity();
    if (sel?.type !== 'category') return null;
    return this.service.findCategoryById(sel.id) ?? null;
  });
  readonly selectedUnit = computed(() => {
    const sel = this.service.selectedEntity();
    if (sel?.type !== 'unit') return null;
    return this.service.units().find(u => u.id === sel.id) ?? null;
  });

  readonly units = this.service.allUnits;
  readonly categories = this.service.allCategories;

  readonly pendingCount = computed(() => this.changeBuffer.changes().length);
  readonly applyDisabled = computed(() => this.pendingCount() === 0);

  ngOnInit(): void {
    this.service.loadBootstrap();

    const mode = this.route.snapshot.data['catalogMode'] as string | undefined;
    if (mode === 'readonly') {
      this.catalogMode.set('readonly');
      this.changeBuffer.clearAll();
    }
  }

  onSearchChange(value: string): void {
    this.service.setSearch(value);
  }

  onTabChange(tab: 'catalog' | 'units'): void {
    this.activeTab.set(tab);
    this.service.clearSelection();
    this.createModeEntity.set(null);
    this.service.setSearch('');
  }

  onSelectNode(node: { id: string; type: string }): void {
    this.createModeEntity.set(null);

    // When searching and clicking a category: keep search, force-show the category
    if (this.searchQuery().trim() && node.type === 'category') {
      this.service.forceShowCategory(node.id);
      this.service.selectNode(node as any);
      return;
    }

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

  onCollapseAll(): void {
    this.service.collapseAll();
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
      payload: {},
    });
  }

  onDelete(id: string): void {
    const cm = this.createModeEntity();
    if (cm) return;

    const sel = this.service.selectedEntity();
    if (!sel) return;

    this.changeBuffer.addChange({
      localId: `${sel.type}-${id}-delete`,
      entityType: sel.type,
      entityId: id,
      action: 'delete',
      payload: {},
    });
  }

  async onApplyAll(): Promise<void> {
    const changes = this.changeBuffer.changes();
    if (changes.length === 0) return;

    const count = changes.length;
    const confirmMsg = count === 1
      ? 'Применить 1 изменение? Это действие нельзя отменить.'
      : `Применить ${count} изменений? Это действие нельзя отменить.`;

    if (!confirm(confirmMsg)) return;

    try {
      await this.service.applyBatch(changes);
      this.changeBuffer.clearAll();
    } catch {
      // error already set in service
    }
  }

  onResetAll(): void {
    this.changeBuffer.clearAll();
  }

  onMergeRequest(id: string): void {
    const sel = this.service.selectedEntity();
    if (!sel) return;

    if (sel.type === 'item') {
      const item = this.service.allItems().find(i => i.id === sel.id);
      if (item) this.mergeItemModal.set(item);
    } else if (sel.type === 'category') {
      const cat = this.service.findCategoryById(sel.id);
      if (cat) this.mergeCategoryModal.set(cat);
    }
  }
}
