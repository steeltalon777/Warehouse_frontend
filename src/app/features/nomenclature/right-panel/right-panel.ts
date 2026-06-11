import { Component, computed, inject, input, output } from '@angular/core';
import { CatalogTreeNodeVm, Category, Item, Unit } from '../../../core/models/nomenclature.models';
import { ItemEditFormComponent } from '../item-edit-form/item-edit-form';
import { CategoryEditFormComponent } from '../category-edit-form/category-edit-form';
import { UnitEditFormComponent } from '../unit-edit-form/unit-edit-form';
import { NomenclatureService } from '../../../core/services/nomenclature.service';

@Component({
  selector: 'app-right-panel',
  standalone: true,
  imports: [ItemEditFormComponent, CategoryEditFormComponent, UnitEditFormComponent],
  template: `
    <div class="wh-panel right-panel" [class.empty]="!selectedNode() && !createModeEntity()">
      @if (createModeEntity(); as cm) {
        <div class="panel-content">
          <div class="panel-header">
            <span class="wh-badge panel-badge" [class.badge-unit]="cm.type === 'unit'" [class.badge-category]="cm.type === 'category'" [class.badge-item]="cm.type === 'item'">
              @switch (cm.type) {
                @case ('category') {создание категории}
                @case ('item') {создание ТМЦ}
                @case ('unit') {создание ед. изм.}
              }
            </span>
            <h3 class="panel-title">Новый элемент</h3>
          </div>
          <div class="panel-body">
            @switch (cm.type) {
              @case ('category') {
                <app-category-edit-form
                  [category]="$any(null)"
                  [categories]="categories()"
                  (saveDraft)="saveDraft.emit($event)"
                  (resetDraft)="resetDraft.emit()"
                  (deactivate)="deactivate.emit($event)"
                  (delete)="delete.emit($event)"
                />
              }
              @case ('item') {
                <app-item-edit-form
                  [item]="$any(null)"
                  [units]="units()"
                  [categories]="categories()"
                  (saveDraft)="saveDraft.emit($event)"
                  (resetDraft)="resetDraft.emit()"
                  (deactivate)="deactivate.emit($event)"
                  (delete)="delete.emit($event)"
                />
              }
              @case ('unit') {
                <app-unit-edit-form
                  [unit]="null"
                  [units]="units()"
                  (saveDraft)="saveDraft.emit($event)"
                  (resetDraft)="resetDraft.emit()"
                  (deactivate)="deactivate.emit($event)"
                  (delete)="delete.emit($event)"
                />
              }
            }
          </div>
        </div>
      } @else if (nomenService.selectedEntity(); as sel) {
        <div class="panel-content">
          @if (sel.type === 'unit') {
            @if (resolvedUnit(); as unitData) {
              <div class="panel-header">
                <span class="wh-badge panel-badge badge-unit">ед. изм.</span>
                <h3 class="panel-title">{{ unitData.name }}</h3>
                <p class="panel-subtitle">Символ: <code class="code">{{ unitData.symbol }}</code></p>
              </div>
              <div class="panel-body">
                <p class="placeholder-text">
                  Редактирование единицы измерения. Правки попадут в локальный batch.
                </p>
                <app-unit-edit-form
                  [unit]="unitData"
                  [units]="units()"
                  (saveDraft)="saveDraft.emit($event)"
                  (resetDraft)="resetDraft.emit()"
                  (deactivate)="deactivate.emit($event)"
                  (delete)="delete.emit($event)"
                />
              </div>
            }
          } @else if (sel.type === 'item') {
            @if (selectedItem(); as item) {
              <div class="panel-header">
                <span class="wh-badge panel-badge badge-item">выбрана ТМЦ</span>
                <h3 class="panel-title">{{ item.name }}</h3>
                @if (item.sku) {
                  <p class="panel-subtitle">Артикул: <code class="code">{{ item.sku }}</code></p>
                }
              </div>
              <div class="panel-body">
                <p class="placeholder-text">
                  Полное редактирование выбранного элемента. Правки попадут в локальный batch.
                </p>
                <app-item-edit-form
                  [item]="item"
                  [units]="units()"
                  [categories]="categories()"
                  (saveDraft)="saveDraft.emit($event)"
                  (resetDraft)="resetDraft.emit()"
                  (deactivate)="deactivate.emit($event)"
                  (delete)="delete.emit($event)"
                  (mergeRequest)="mergeRequest.emit($event)"
                />
              </div>
            }
          } @else {
            @if (selectedCategory(); as cat) {
              <div class="panel-header">
                <span class="wh-badge panel-badge badge-category">выбрана категория</span>
                <h3 class="panel-title">{{ cat.name }}</h3>
                @if (cat.code) {
                  <p class="panel-subtitle">Код: {{ cat.code }}</p>
                }
              </div>
              <div class="panel-body">
                <p class="placeholder-text">
                  Полное редактирование выбранной категории. Правки попадут в локальный batch.
                </p>
                <app-category-edit-form
                  [category]="cat"
                  [categories]="categories()"
                  (saveDraft)="saveDraft.emit($event)"
                  (resetDraft)="resetDraft.emit()"
                  (deactivate)="deactivate.emit($event)"
                  (delete)="delete.emit($event)"
                  (mergeRequest)="mergeRequest.emit($event)"
                />
              </div>
            }
          }
        </div>
      } @else {
        <div class="wh-empty empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M20 7L12 12L4 7M12 21L12 12M4 7V17L12 22L20 17V7L12 2L4 7Z" stroke="#E5E7EB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 12L11 14L15 10" stroke="#E5E7EB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
          </svg>
          <h3 class="empty-title">Выберите категорию, ТМЦ или единицу измерения</h3>
          <p class="empty-desc">
            После выбора элемента здесь появится форма редактирования.
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .right-panel {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .right-panel.empty {
      align-items: center;
      justify-content: center;
    }

    .panel-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
      padding: 24px 32px 16px;
      border-bottom: 1px solid #F3F4F6;
      flex-shrink: 0;
    }
    .panel-badge {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 10px;
      border-radius: 11px;
      display: inline-block;
      margin-bottom: 8px;
    }
    .badge-item {
      background: #DBEAFE;
      color: #1D4ED8;
    }
    .badge-category {
      background: #EEF2FF;
      color: #4338CA;
    }
    .badge-unit {
      background: #F0FDF4;
      color: #15803D;
    }
    .panel-title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0;
      line-height: 1.3;
    }
    .panel-subtitle {
      font-size: 13px;
      color: #6B7280;
      margin: 4px 0 0;
    }
    .code {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 12px;
      color: #6B7280;
      background: #F3F4F6;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 32px 24px;
    }
    .placeholder-text {
      font-size: 13px;
      color: #6B7280;
      margin: 0 0 20px;
      line-height: 1.5;
    }

    .empty-state {
      text-align: center;
      padding: 40px 24px;
    }
    .empty-title {
      font-size: 16px;
      font-weight: 500;
      color: #6B7280;
      margin: 12px 0 4px;
    }
    .empty-desc {
      font-size: 13px;
      color: #9CA3AF;
      line-height: 1.5;
      margin: 0;
    }
  `]
})
export class RightPanelComponent {
  readonly nomenService = inject(NomenclatureService);

  readonly selectedNode = input<CatalogTreeNodeVm | null>(null);
  readonly selectedItem = input<Item | null>(null);
  readonly selectedCategory = input<Category | null>(null);
  readonly selectedUnit = input<Unit | null>(null);
  readonly units = input<Unit[]>([]);
  readonly categories = input<Category[]>([]);
  readonly createModeEntity = input<{ type: 'category' | 'item' | 'unit'; entity: unknown } | null>(null);

  readonly saveDraft = output<{ id: string; payload: Record<string, unknown> }>();
  readonly resetDraft = output<void>();
  readonly deactivate = output<string>();
  readonly delete = output<string>();
  readonly mergeRequest = output<string>();

  /** Resolve unit from selectedEntity (service) by node id, works even when inputs lag */
  readonly resolvedUnit = computed(() => {
    const sel = this.nomenService.selectedEntity();
    if (!sel || sel.type !== 'unit') return null;
    return this.nomenService.allUnits().find(u => u.id === sel.id) ?? null;
  });

}
