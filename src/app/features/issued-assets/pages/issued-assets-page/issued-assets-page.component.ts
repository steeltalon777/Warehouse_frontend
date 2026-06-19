import { Component, OnInit, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepositoryTreeComponent } from '../../components/repository-tree/repository-tree.component';
import { CategoryPanelComponent } from '../../components/category-panel/category-panel.component';
import { ObjectPanelComponent } from '../../components/object-panel/object-panel.component';
import { NewCategoryFormComponent } from '../../components/category-panel/new-category-form.component';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { OperationsService } from '../../../../core/services/operations.service';
import { RepositorySelectionService } from '../../services/repository-selection.service';

@Component({
  selector: 'app-issued-assets-page',
  standalone: true,
  imports: [CommonModule, RepositoryTreeComponent, CategoryPanelComponent, ObjectPanelComponent, NewCategoryFormComponent],
  template: `
    <div class="wh-page issued-assets-page" data-testid="issue-repository-page">
      <!-- Page Header -->
      <div class="wh-page-header page-header">
        <div class="header-info">
          <h1 class="page-title">Репозиторий выдачи</h1>
          <p class="page-subtitle">
            Управление выданным имуществом: категории, объекты выдачи и назначенная номенклатура.
          </p>
        </div>
      </div>

      <!-- Workspace stays inside the Django content area -->
      <div class="workspace">
        <div class="left-panel">
          <app-repository-tree />
        </div>
        <div class="right-panel">
          @if (showNewCategoryForm()) {
            <app-new-category-form />
          } @else if (showNewObjectForm()) {
            <!-- Object panel renders the new-object form internally -->
            <app-object-panel />
          } @else if (selection.selectedObjectId()) {
            <app-object-panel />
          } @else if (selection.selectedCategoryId()) {
            <app-category-panel />
          } @else {
            <div class="empty-state">
              <div class="empty-icon">▦</div>
              <h2 class="empty-title">Выберите категорию или объект</h2>
              <p class="empty-hint">
                В левой панели выберите узел дерева, чтобы увидеть детали. Используйте кнопки «+ Категория выдачи» и «+ Объект выдачи», чтобы создать новые.
              </p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    .issued-assets-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: #F1F5F9;
      overflow: hidden;
    }

    .page-header {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 20px;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
    }
    .header-info { min-width: 0; }
    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }
    .page-subtitle {
      font-size: 13px;
      color: #64748B;
      margin: 4px 0 0;
    }

    .workspace {
      flex: 1;
      display: flex;
      gap: 0;
      min-height: 0;
      overflow: hidden;
    }

    .left-panel {
      flex: 0 0 clamp(280px, 25%, 420px);
      max-width: 420px;
      min-width: 280px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: #FFFFFF;
      border-right: 1px solid #E2E8F0;
    }

    .right-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: #F8FAFC;
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 32px;
      text-align: center;
      color: #64748B;
    }
    .empty-icon { font-size: 56px; color: #CBD5E1; line-height: 1; }
    .empty-title { margin: 0; font-size: 18px; font-weight: 600; color: #334155; }
    .empty-hint { margin: 0; font-size: 13px; max-width: 380px; }
  `]
})
export class IssuedAssetsPageComponent implements OnInit, OnDestroy {
  readonly selection = inject(RepositorySelectionService);
  private readonly objectsService = inject(IssueObjectsService);
  private readonly operationsService = inject(OperationsService);

  readonly showNewCategoryForm = computed(() => this.selection.createFlag() === 'new-category');
  readonly showNewObjectForm = computed(() => this.selection.createFlag() === 'new-object');

  constructor() {
    effect(() => {
      const sites = this.operationsService.sites();
      if (!sites || sites.length === 0) {
        void this.operationsService.loadSites();
      }
    });
  }

  ngOnInit(): void {
    if (this.objectsService.tree().length === 0) {
      void this.objectsService.loadTree({ include_inactive: false, include_deleted: false });
    }
    if (!this.operationsService.sites() || this.operationsService.sites().length === 0) {
      void this.operationsService.loadSites();
    }
  }

  ngOnDestroy(): void {
    // selection state lives in the service; do not clear on page leave to allow
    // navigation back without losing the user's selection context.
  }
}
