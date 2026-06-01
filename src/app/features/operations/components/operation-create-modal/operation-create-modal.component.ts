import { Component, input, output, signal, computed, effect, inject, OnInit } from '@angular/core';
import { AuthContextService } from '../../../../core/services/auth-context.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OperationDraftVm,
  OperationType,
  OperationLineDraftVm,
  SiteDto,
  OPERATION_TYPE_LABELS,
} from '../../../../core/models/operations.models';
import { OperationsService } from '../../../../core/services/operations.service';
import { ItemCacheSearchComponent } from '../item-cache-search/item-cache-search.component';
import { Item } from '../../../../core/models/nomenclature.models';

let LOCAL_ID_COUNTER = 0;
function nextLocalId(): string {
  return `local-${++LOCAL_ID_COUNTER}`;
}

@Component({
  selector: 'app-operation-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemCacheSearchComponent],
  template: `
    <div class="wh-modal-overlay modal-overlay" (click)="onOverlayClick($event)">
      <div class="wh-modal modal-container">
        <div class="wh-modal__header modal-header">
          <h2>{{ isEdit() ? 'Редактирование операции' : 'Новая операция' }}</h2>
          <button class="wh-btn-icon btn-close" aria-label="Закрыть" (click)="cancel.emit()">×</button>
        </div>

        <div class="wh-modal__body modal-body">
          <!-- Type selector -->
          <div class="form-row">
            <label>Тип операции</label>
              <select class="wh-form-input input" [value]="localDraft().type" (change)="onTypeChange($event)">
              @for (t of typeOptions; track t.key) {
                <option [value]="t.key">{{ t.label }}</option>
              }
            </select>
          </div>

          <!-- Sites -->
          <div class="form-row two-col">
            <div class="form-group">
              <label>{{ sourceLabel() }}</label>
              <select class="wh-form-input input" [ngModel]="localDraft().sourceSiteId" (ngModelChange)="onSourceSiteChange($event)">
                <option [ngValue]="null">—</option>
                @for (site of sites(); track site.id) {
                  <option [value]="site.id">{{ site.name }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label>{{ destinationLabel() }}</label>
              <select class="wh-form-input input" [ngModel]="localDraft().destinationSiteId" (ngModelChange)="onDestinationSiteChange($event)">
                <option [ngValue]="null">—</option>
                @for (site of sites(); track site.id) {
                  <option [value]="site.id">{{ site.name }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Person name -->
          @if (showPersonName()) {
            <div class="form-row">
              <label>ФИО получателя / выдачи</label>
              <input type="text" class="wh-form-input input" [ngModel]="localDraft().personName" (ngModelChange)="onPersonNameChange($event)" placeholder="Фамилия Имя Отчество" />
            </div>
          }

          <!-- Comment -->
          <div class="form-row">
            <label>Комментарий</label>
            <textarea class="wh-form-input input" rows="2" [ngModel]="localDraft().comment" (ngModelChange)="onCommentChange($event)" placeholder="Комментарий к операции..."></textarea>
          </div>

          <!-- Item search area -->
          <div class="add-item-search">
            <app-item-cache-search
              [placeholder]="'Поиск по названию, SKU или хештегу...'"
              [sourceSiteId]="localDraft().sourceSiteId ?? null"
              (itemSelected)="onNewItemSelected($event)"
            />
          </div>

          <!-- Lines table -->
          <div class="lines-section">
            <div class="section-header">
              <h3>Позиции ({{ lines().length }})</h3>
            </div>

            <table class="wh-table lines-table">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Количество</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (line of lines(); track line.localId) {
                  <tr [class.error-row]="line.error">
                    <td>
                      @if (line.itemId) {
                        <div class="item-selected">
                          <span class="item-name">{{ line.itemName }}</span>
                          @if (line.categoryName) {
                            <span class="item-category">{{ line.categoryName }}</span>
                          }
                          @if (line.sku) { <span class="item-sku">{{ line.sku }}</span> }
                          <button class="wh-btn-icon btn-icon-sm" (click)="editItemLine(line.localId)" title="Изменить" aria-label="Изменить номенклатуру">✎</button>
                          @if (line.isTemporary) {
                            <span class="temp-badge">временная</span>
                          }
                          <span class="item-unit">{{ line.unitName }}</span>
                        </div>
                      } @else {
                        <div class="inline-search-cell">
                          <app-item-cache-search
                            [placeholder]="'Начните вводить название...'"
                            [sourceSiteId]="localDraft().sourceSiteId ?? null"
                            (itemSelected)="onItemSelected(line.localId, $event)"
                          />
                        </div>
                      }
                    </td>
                    <td>
                      <div class="qty-cell">
                        <input
                          type="number"
                          class="wh-form-input input qty-input"
                          [ngModel]="line.quantity"
                          (ngModelChange)="onQuantityChange(line.localId, $event)"
                          min="0"
                          step="0.001"
                        />
                        @if (line.sourceSiteQuantity != null && line.itemId) {
                          <span class="source-stock-hint">из ({{ line.sourceSiteQuantity }})</span>
                        }
                      </div>
                    </td>
                    <td>
                      <button class="remove-btn" (click)="removeLine(line.localId)" title="Удалить" aria-label="Удалить позицию">×</button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="empty-lines">Начните поиск номенклатуры выше, чтобы добавить позиции</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="wh-modal__footer modal-footer">
          <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="cancel.emit()">Отмена</button>
          <button class="wh-btn wh-btn--primary btn btn-primary" [disabled]="isSaving()" (click)="onSave()">Сохранить черновик</button>
          <button class="wh-btn wh-btn--success btn btn-submit" [disabled]="!canSubmit() || isSubmitting()" (click)="onSubmit()">Подтвердить</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    .modal-container {
      background: #FFFFFF;
      border-radius: 12px;
      width: 100%;
      max-width: 760px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #E2E8F0;
    }
    .modal-header h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }
    .btn-close {
      width: 32px; height: 32px;
      border: none; background: transparent;
      font-size: 22px; color: #94A3B8;
      cursor: pointer; border-radius: 6px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .btn-close:hover { background: #F1F5F9; color: #374151; }

    .modal-body { flex: 1; overflow: auto; padding: 16px 20px; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid #E2E8F0;
    }

    .form-row { margin-bottom: 12px; }
    .form-row.two-col { display: flex; gap: 12px; }
    .form-group { flex: 1; }
    .form-row label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #64748B;
      margin-bottom: 4px;
    }

    .input {
      width: 100%;
      height: 36px;
      padding: 0 10px;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      font-size: 13px;
      font-family: inherit;
      background: #FFFFFF;
      color: #1F2937;
      box-sizing: border-box;
    }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    textarea.input { height: auto; padding: 8px 10px; resize: vertical; }

    .add-item-search { margin-bottom: 12px; }
    .lines-section { margin-top: 12px; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }
    .section-header h3 { margin: 0; font-size: 14px; font-weight: 600; color: #374151; }

    .lines-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .lines-table th, .lines-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #E2E8F0;
      text-align: left;
    }
    .lines-table th {
      font-weight: 600;
      color: #475569;
      background: #F8FAFC;
      font-size: 12px;
    }
    .lines-table .qty-input { width: 90px; }
    .lines-table .empty-lines {
      text-align: center;
      padding: 20px;
      color: #94A3B8;
      font-size: 13px;
    }
    .lines-table .error-row { background: #FEF2F2 !important; }
    .lines-table .error-row .input { border-color: #EF4444; }

    .item-selected {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .item-selected .item-name { font-weight: 500; color: #1F2937; }
    .item-selected .item-category { font-size: 11px; color: #64748B; font-weight: 400; }
    .item-selected .item-sku { font-size: 11px; color: #94A3B8; }
    .item-selected .item-unit { font-size: 11px; color: #6B7280; margin-left: 2px; }
    .inline-search-cell { min-width: 200px; }
    .qty-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .source-stock-hint {
      font-size: 11px;
      color: #6B7280;
      white-space: nowrap;
    }
    .remove-btn {
      width: 26px; height: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid #E2E8F0; border-radius: 6px;
      background: #FFFFFF; color: #64748B; cursor: pointer;
    }
    .remove-btn:hover { background: #FEE2E2; color: #991B1B; border-color: #FECACA; }
    .btn-icon-sm {
      width: 20px; height: 20px;
      border: none; background: transparent;
      cursor: pointer; color: #94A3B8;
      font-size: 14px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .btn-icon-sm:hover { color: #3B82F6; }
    .temp-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      background: #FEF9C3;
      color: #854D0E;
      font-size: 11px;
      font-weight: 500;
    }

    .stock-hint {
      font-size: 12px;
      font-weight: 500;
      color: #059669;
    }
    .stock-hint.low-stock { color: #DC2626; }
    .stock-hint.muted { color: #CBD5E1; }

    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px; height: 36px; padding: 0 14px;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
      border: 1px solid transparent; font-family: inherit;
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
    .btn-submit { background: #059669; color: #FFFFFF; border-color: #059669; }
    .btn-submit:hover:not(:disabled) { background: #047857; }


  `]
})
export class OperationCreateModalComponent implements OnInit {
  draft = input.required<OperationDraftVm | null>();
  sites = input.required<SiteDto[]>();
  isSaving = input<boolean>(false);
  isSubmitting = input<boolean>(false);
  save = output<OperationDraftVm>();
  submit = output<OperationDraftVm>();
  cancel = output<void>();

  private readonly service = inject(OperationsService);
  private readonly authContextService = inject(AuthContextService);

  readonly localDraft = signal<OperationDraftVm>({
    type: 'MOVE',
    status: 'draft',
    lines: [],
  });

  readonly isEdit = computed(() => !!this.localDraft().id);
  readonly lines = computed(() => this.localDraft().lines);

  readonly typeOptions = (Object.entries(OPERATION_TYPE_LABELS) as [OperationType, string][])
    .map(([key, label]) => ({ key, label }));

  readonly showPersonName = computed(() => {
    const t = this.localDraft().type;
    return t === 'ISSUE' || t === 'ISSUE_RETURN' || t === 'WRITE_OFF' || t === 'EXPENSE';
  });

  readonly sourceLabel = computed(() => {
    const t = this.localDraft().type;
    if (t === 'RECEIVE') return 'Поставщик / источник';
    if (t === 'MOVE') return 'Склад-отправитель';
    return 'Склад / участок';
  });

  readonly destinationLabel = computed(() => {
    const t = this.localDraft().type;
    if (t === 'EXPENSE' || t === 'WRITE_OFF' || t === 'ISSUE') return '—';
    if (t === 'MOVE') return 'Склад-получатель';
    return 'Склад-получатель';
  });

  readonly canSubmit = computed(() => {
    const d = this.localDraft();
    if (d.lines.length === 0) return false;
    if (d.lines.some(l => l.quantity == null || l.quantity <= 0)) return false;
    if (d.type === 'MOVE' && (!d.sourceSiteId || !d.destinationSiteId)) return false;
    return true;
  });

  constructor() {
    effect(() => {
      const d = this.draft();
      if (d) {
        const defaults: Partial<OperationDraftVm> = {};
        const defaultSiteId = this.authContextService.authContext()?.defaultSiteId;
        if (d.type === 'RECEIVE' && !d.destinationSiteId && defaultSiteId) {
          defaults.destinationSiteId = defaultSiteId;
        } else if (d.type === 'MOVE' && !d.sourceSiteId && defaultSiteId) {
          defaults.sourceSiteId = defaultSiteId;
        } else if ((d.type === 'EXPENSE' || d.type === 'WRITE_OFF' || d.type === 'ISSUE') && !d.sourceSiteId && defaultSiteId) {
          defaults.sourceSiteId = defaultSiteId;
        }
        this.localDraft.set({ ...d, lines: [...d.lines], ...defaults });
      }
    });

    effect(() => {
      const siteId = this.localDraft().sourceSiteId;
      if (siteId) {
        this.service.loadBalances(siteId);
      }
    });
  }

  ngOnInit(): void {
  }

  private updateLineStockHint(line: OperationLineDraftVm): void {
    if (!line.itemId) return;
    const d = this.localDraft();
    const siteId = d.sourceSiteId || undefined;
    const qty = this.service.getBalanceForItem(line.itemId, siteId);
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l =>
        l.localId === line.localId ? { ...l, availableQuantity: qty } : l
      ),
    }));
  }

  private refreshSourceQuantities(): void {
    const d = this.localDraft();
    const siteId = d.sourceSiteId || undefined;
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l => {
        if (!l.itemId) return l;
        const qty = this.service.getBalanceForItem(l.itemId, siteId);
        return { ...l, sourceSiteQuantity: qty, availableQuantity: qty };
      }),
    }));
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }

  onTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as OperationType;
    this.localDraft.update(d => ({ ...d, type: value }));
  }

  onSourceSiteChange(value: string | null): void {
    this.localDraft.update(d => ({ ...d, sourceSiteId: value }));
    this.refreshSourceQuantities();
  }

  onDestinationSiteChange(value: string | null): void {
    this.localDraft.update(d => ({ ...d, destinationSiteId: value }));
  }

  onPersonNameChange(value: string): void {
    this.localDraft.update(d => ({ ...d, personName: value || undefined }));
  }

  onCommentChange(value: string): void {
    this.localDraft.update(d => ({ ...d, comment: value || undefined }));
  }

  addLine(): void {
    this.localDraft.update(d => ({
      ...d,
      lines: [
        ...d.lines,
        {
          localId: nextLocalId(),
          itemName: '',
          unitName: 'шт',
          quantity: null,
          isTemporary: false,
          fromBalances: false,
        },
      ],
    }));
  }

  removeLine(localId: string): void {
    this.localDraft.update(d => ({
      ...d,
      lines: d.lines.filter(l => l.localId !== localId),
    }));
  }

  onItemSelected(localId: string, item: Item): void {
    this.localDraft.update(d => ({
      ...d,
      lines: d.lines.map(l =>
        l.localId === localId
          ? {
              ...l,
              itemId: item.id,
              itemName: item.name,
              categoryName: item.category_name,
              sku: item.sku,
              unitId: item.unit_id,
              unitName: item.unit_symbol,
            }
          : l
      ),
    }));
    const line = this.lines().find(l => l.localId === localId);
    if (line) {
      this.updateLineStockHint(line);
    }
  }

  onNewItemSelected(item: Item): void {
    this.localDraft.update(d => ({
      ...d,
      lines: [
        ...d.lines,
        {
          localId: nextLocalId(),
          itemId: item.id,
          itemName: item.name,
          categoryName: item.category_name,
          sku: item.sku,
          unitId: item.unit_id,
          unitName: item.unit_symbol,
          quantity: null,
          sourceSiteQuantity: item.source_site_qty ? parseFloat(item.source_site_qty) : null,
          isTemporary: false,
          fromBalances: false,
        },
      ],
    }));
  }

  editItemLine(localId: string): void {
    this.localDraft.update(d => ({
      ...d,
      lines: d.lines.map(l =>
        l.localId === localId
          ? { ...l, itemId: null, sku: null, unitId: null }
          : l
      ),
    }));
  }

  onQuantityChange(localId: string, value: number | null): void {
    this.localDraft.update(d => ({
      ...d,
      lines: d.lines.map(l =>
        l.localId === localId ? { ...l, quantity: value } : l
      ),
    }));
  }

  onSave(): void {
    this.save.emit(this.localDraft());
  }

  onSubmit(): void {
    this.submit.emit(this.localDraft());
  }
}
