import { Component, input, output, signal, computed, effect, inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AuthContextService } from '../../../../core/services/auth-context.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OperationDraftVm,
  OperationType,
  OperationLineDraftVm,
  OperationInlineItemDraftVm,
  SiteDto,
  OPERATION_TYPE_LABELS,
} from '../../../../core/models/operations.models';
import { OperationsService } from '../../../../core/services/operations.service';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { DiagnosticsSessionService } from '../../../../core/services/diagnostics-session.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { BffApiService } from '../../../../core/api/bff-api.service';
import { ItemCacheSearchComponent } from '../item-cache-search/item-cache-search.component';
import { OperationLinesTableComponent } from './operation-lines-table.component';
import { InlineItemCreateModalComponent } from '../inline-item-create-modal/inline-item-create-modal.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { Item } from '../../../../core/models/nomenclature.models';
import { IssueObject, IssueObjectType, ISSUE_OBJECT_TYPE_LABELS } from '../../../../core/models/issue-objects.models';
import { snapshotDraft, isDraftClean } from './operation-draft-mappers';

let LOCAL_ID_COUNTER = 0;
function nextLocalId(): string {
  return `local-${++LOCAL_ID_COUNTER}`;
}

function currentDateTimeLocal(): string {
  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('-') + `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

@Component({
  selector: 'app-operation-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemCacheSearchComponent, OperationLinesTableComponent, InlineItemCreateModalComponent, ErrorAlertComponent],
  template: `
    <div class="wh-modal-overlay modal-overlay" [class.modal-overlay--pair]="isInlineModalOpen()">
      <div class="wh-modal modal-container">
        <div class="wh-modal__header modal-header">
          <div class="header-title-group">
            <h2>{{ isEdit() ? 'Редактирование операции' : 'Новая операция' }}</h2>
            @if (localDraft().id) {
              <div class="operation-uuid">
                <span class="uuid-text">{{ localDraft().id }}</span>
                <button class="btn-copy-uuid" (click)="copyUuid()" title="Копировать UUID">📋</button>
              </div>
            }
          </div>
          <button class="wh-btn-icon btn-close" aria-label="Закрыть" (click)="cancel.emit()">×</button>
        </div>

        <div class="wh-modal__body modal-body">
          <app-error-alert
            [message]="submitErrorLocal()"
            testId="operation-create-submit-error"
            (dismiss)="submitErrorLocal.set('')"
          />
          @if (submitMessage()) {
            <div
              class="submit-result-banner"
              [class.submit-result-banner--warning]="submitState() === 'outcome_unknown' || submitState() === 'retry_allowed' || submitState() === 'refresh_failed'"
              data-testid="operation-submit-result"
            >
              {{ submitMessage() }}
            </div>
          }
          <div class="modal-content-shell">
            <!-- First row: type + warehouse(s) -->
            <div class="form-row first-row">
              <!-- Operation type: 40% -->
              <div class="form-group form-group--type">
                <label>Тип операции</label>
                @if (!isReadonly()) {
                  <select class="wh-form-input input" [ngModel]="localDraft().type" (ngModelChange)="onTypeModelChange($event)" [disabled]="isReadonly() || isLockedFromAssetRow()">
                    @for (t of typeOptions; track t.key) {
                      <option [value]="t.key">{{ t.label }}</option>
                    }
                  </select>
                } @else {
                  <span class="readonly-value readonly-type">{{ typeLabelForDisplay() }}</span>
                }
              </div>

              <!-- Source warehouse: 30% for MOVE, 60% for others -->
              <div class="form-group" [class.form-group--move-source]="isMove()" [class.form-group--single-warehouse]="!isMove()">
                <label>{{ sourceLabel() }}</label>
                @if (!isReadonly()) {
                  <select class="wh-form-input input" [ngModel]="isMove() ? (localDraft().sourceSiteId ?? '') : (logicalWarehouseSiteId() ?? '')" (ngModelChange)="isMove() ? onSourceSiteChange($event) : onLogicalWarehouseSiteChange($event)" [disabled]="isReadonly()">
                    <option value="">—</option>
                    @for (site of sites(); track site.id) {
                      <option [value]="site.id">{{ site.name }}</option>
                    }
                  </select>
                } @else {
                  <span class="readonly-value">{{ sourceSiteName() }}</span>
                }
              </div>

              <!-- Destination warehouse: 30%, only for MOVE -->
              @if (isMove()) {
                <div class="form-group form-group--move-destination">
                  <label>Склад-получатель</label>
                  @if (!isReadonly()) {
                    <select class="wh-form-input input" [ngModel]="localDraft().destinationSiteId ?? ''" (ngModelChange)="onDestinationSiteChange($event)" [disabled]="isReadonly()">
                      <option value="">—</option>
                      @for (site of sites(); track site.id) {
                        <option [value]="site.id">{{ site.name }}</option>
                      }
                    </select>
                  } @else {
                    <span class="readonly-value">{{ destinationSiteName() }}</span>
                  }
                </div>
              }
            </div>

          <!-- Person name (EXPENSE only) -->
            @if (showPersonName()) {
              <div class="form-row">
                <label>ФИО получателя / выдачи</label>
                @if (!isReadonly()) {
                  <input type="text" class="wh-form-input input" [ngModel]="localDraft().personName" (ngModelChange)="onPersonNameChange($event)" placeholder="Фамилия Имя Отчество" />
                } @else {
                  <span class="readonly-value">{{ localDraft().personName }}</span>
                }
              </div>
            }

          <!-- Issue object search (ISSUE / ISSUE_RETURN / WRITE_OFF when object source) -->
            @if (showIssueObjectSearch()) {
              <div class="form-row">
                <label>Объект выдачи</label>
                @if (!isReadonly()) {
                  @if (localDraft().issueObjectName) {
                    <div class="issue-object-selected">
                      <span class="selected-label">{{ localDraft().issueObjectName }}</span>
                      @if (!isLockedFromAssetRow()) {
                        <button class="wh-btn-icon btn-icon-sm" (click)="clearIssueObject()" title="Изменить">✎</button>
                      }
                    </div>
                  } @else {
                    <div class="issue-object-search">
                      <input
                        type="text"
                        class="wh-form-input input"
                        [ngModel]="issueObjectSearchQuery()"
                        (ngModelChange)="onIssueObjectSearchChange($event)"
                        placeholder="Поиск объекта выдачи..."
                      />
                      @if (issueObjectSearchResults().length > 0) {
                        <div class="search-dropdown">
                          @for (obj of issueObjectSearchResults(); track obj.id) {
                            <button class="dropdown-item" (click)="selectIssueObject(obj)">
                              <span class="item-title">{{ obj.display_name }}</span>
                              <span class="item-subtitle">{{ objectTypeLabel(obj.object_type) }}{{ obj.code ? ' · ' + obj.code : '' }}</span>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                } @else {
                  <span class="readonly-value">{{ localDraft().issueObjectName || '—' }}</span>
                }
              </div>
            }

          <!-- WRITE_OFF source selector -->
            @if (showWriteOffSource() && !isLockedFromAssetRow()) {
              <div class="form-row">
                <label>Источник списания</label>
                @if (!isReadonly()) {
                  <div class="radio-group">
                    <label class="radio-item">
                      <input type="radio" name="writeOffSource" [value]="'warehouse'" [ngModel]="localDraft().writeOffSource" (ngModelChange)="onWriteOffSourceChange('warehouse')" />
                      <span>Со склада</span>
                    </label>
                    <label class="radio-item">
                      <input type="radio" name="writeOffSource" [value]="'object'" [ngModel]="localDraft().writeOffSource" (ngModelChange)="onWriteOffSourceChange('object')" />
                      <span>С объекта выдачи</span>
                    </label>
                  </div>
                } @else {
                  <span class="readonly-value">{{ writeOffSourceLabel() }}</span>
                }
              </div>
            }

          <!-- Comment row: full-width, 2 rows -->
            <div class="form-row effective-at-row">
              <label>Дата проведения</label>
              @if (!isReadonly()) {
                <input
                  type="datetime-local"
                  class="wh-form-input input effective-at-input"
                  [ngModel]="localDraft().effectiveAt"
                  (ngModelChange)="onEffectiveAtChange($event)"
                />
              } @else {
                <span class="readonly-value">{{ localDraft().effectiveAt }}</span>
              }
            </div>

            <div class="form-row">
              <label>Комментарий</label>
              @if (!isReadonly()) {
                <textarea class="wh-form-input input comment-area" rows="2" [ngModel]="localDraft().comment" (ngModelChange)="onCommentChange($event)" placeholder="Комментарий к операции..."></textarea>
              } @else {
                <span class="readonly-value">{{ localDraft().comment || '—' }}</span>
              }
            </div>

          <!-- Add TMC row: 80% search + 20% disabled button -->
            @if (!isReadonly()) {
              @if (!isObjectSourceFlow()) {
                <div class="form-row add-tmc-row">
                  <div class="tmc-search-wrapper">
                    <label>Добавить ТМЦ в операцию</label>
                    <app-item-cache-search
                      #itemSearch
                      [placeholder]="'Поиск ТМЦ для добавления: название, SKU или хештег...'"
                      [sourceSiteId]="relevantSiteId()"
                      (itemSelected)="onNewItemSelected($event)"
                    />
                    @if (inlineItemsForSearch().length > 0) {
                      <div class="inline-search-hint">
                        <span class="hint-label">Временные позиции в операции:</span>
                        @for (inline of inlineItemsForSearch(); track inline.clientKey) {
                          <button class="inline-item-chip" (click)="onInlineSearchSelected(inline)">
                            {{ inline.name }} ({{ inline.unitName }})
                          </button>
                        }
                      </div>
                    }
                  </div>
                  <button class="wh-btn wh-btn--secondary btn btn-tmc" title="Создать новую ТМЦ для операции" (click)="openInlineModal()">
                    Создать ТМЦ
                  </button>
                </div>
              } @else {
                <div class="form-row object-source-hint">
                  <div class="hint-card">
                    <span class="hint-icon" aria-hidden="true">ⓘ</span>
                    <span>Позиция зафиксирована за объектом выдачи. Дополнительные позиции добавлять нельзя — доступно только то, что уже назначено на «{{ localDraft().issueObjectName || 'объект' }}».</span>
                  </div>
                </div>
              }
            }

          <!-- Lines table component -->
            <div class="form-row lines-section">
              <div class="section-header">
                <h3>Позиции: {{ lines().length }}, Всего: {{ totalQuantity() }}</h3>
              </div>
              <app-operation-lines-table
                [lines]="lines()"
                [warehouseSiteId]="relevantSiteId()"
                [isBalanceRefreshing]="isBalanceRefreshing()"
                [operationType]="localDraft().type"
                [isObjectSourceFlow]="isObjectSourceFlow()"
                (quantityChange)="onQuantityChange($event.localId, $event.quantity)"
                (removeLine)="removeLine($event)"
              />
            </div>
          </div>
        </div>

        <div class="wh-modal__footer modal-footer">
          <!-- Validation summary -->
          @if (saveDisabledReason()) {
            <div class="validation-hint">{{ saveDisabledReason() }}</div>
          }

          <div class="footer-actions">
            @if (submitState() === 'outcome_unknown') {
              <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="resolveSubmit.emit(localDraft())">Проверить результат</button>
            }
            @if (submitState() === 'retry_allowed') {
              <button class="wh-btn wh-btn--success btn btn-submit" (click)="retrySubmit.emit(localDraft())">Повторить с тем же ключом</button>
            }
            @if (submitState() === 'refresh_failed') {
              <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="retryRefresh.emit()">Обновить список</button>
            }
            @if (isReadonly()) {
              @if (canRestoreOperation()) {
                <button class="wh-btn wh-btn--secondary btn btn-restore" (click)="onRestore()">
                  Восстановить как черновик
                </button>
              }
              @if (canDeleteCancelled()) {
                <button class="wh-btn wh-btn--danger btn btn-delete" (click)="onDelete()" [disabled]="isSaving()">Удалить</button>
              }
              @if (canCancelOperation()) {
                <button class="wh-btn wh-btn--danger btn btn-cancel-operation" (click)="onCancelOperation()" [disabled]="isSubmitting()">Отменить операцию</button>
              }
              <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="cancel.emit()">Закрыть</button>
            } @else {
              @if (isEdit()) {
                <button class="wh-btn wh-btn--danger btn btn-delete" (click)="onDelete()" [disabled]="isSaving()">Удалить черновик</button>
                @if (canCancelOperation()) {
                  <button class="wh-btn wh-btn--danger btn btn-cancel-operation" (click)="onCancelOperation()" [disabled]="isSubmitting()">Отменить операцию</button>
                }
                @if (canAcceptOperation()) {
                  <button class="wh-btn wh-btn--secondary btn btn-accept" (click)="onAcceptOperation()">Приёмка</button>
                }
              }
              <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="cancel.emit()">Отмена</button>
              <button class="wh-btn wh-btn--primary btn btn-primary" [disabled]="isSaving() || !!saveDisabledReason()" (click)="onSave()">Сохранить черновик</button>
              <button class="wh-btn wh-btn--success btn btn-submit" [disabled]="!canSubmitComputed() || isSubmitting()" [title]="submitDisabledReason()" (click)="onSubmit()">Подтвердить</button>
            }
          </div>
        </div>
      </div>
      @if (isInlineModalOpen()) {
        <div class="wh-modal modal-container modal-container--inline">
          <app-inline-item-create-modal
            (create)="onInlineItemCreated($event)"
            (cancel)="closeInlineModal()"
          />
        </div>
      }
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
      max-width: 900px;
      max-height: min(1024px, calc(100vh - 32px));
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-header {
      flex-shrink: 0;
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

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .modal-content-shell {
      width: 100%;
      max-width: 840px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .modal-footer {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-top: 1px solid #E2E8F0;
    }
    .footer-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-left: auto;
    }

    .form-row {
      width: 100%;
      margin-bottom: 12px;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .object-source-hint .hint-card {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 8px;
      color: #1E3A8A;
      font-size: 12px;
      line-height: 1.4;
    }
    .object-source-hint .hint-icon {
      font-size: 14px;
      color: #2563EB;
      line-height: 1.2;
    }
    .first-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      min-width: 0;
      box-sizing: border-box;
    }
    .form-group--type { flex: 0 0 calc(40% - 4.8px); }
    .form-group--move-source { flex: 0 0 calc(30% - 4px); }
    .form-group--move-destination { flex: 0 0 calc(30% - 4px); }
    .form-group--single-warehouse { flex: 0 0 calc(60% - 7.2px); }
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
    .input:disabled {
      background: #F8FAFC;
      color: #64748B;
      cursor: not-allowed;
    }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .effective-at-row { max-width: 280px; }
    textarea.input { height: auto; padding: 8px 10px; resize: vertical; }
    .comment-area { resize: vertical; }

    .add-tmc-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      width: 100%;
    }
    .tmc-search-wrapper {
      flex: 0 0 calc(80% - 9.6px);
      min-width: 0;
    }
    .btn-tmc {
      flex: 0 0 calc(20% - 2.4px);
      height: 36px;
      align-self: flex-end;
    }

    .lines-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 120px;
      margin-bottom: 0;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .section-header h3 { margin: 0; font-size: 14px; font-weight: 600; color: #374151; }

    .validation-hint {
      font-size: 12px;
      color: #F97316;
      flex: 1;
    }
    .submit-result-banner {
      margin-bottom: 12px;
      padding: 10px 12px;
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      border-radius: 8px;
      color: #047857;
      font-size: 13px;
    }
    .submit-result-banner--warning {
      background: #FFFBEB;
      border-color: #FDE68A;
      color: #92400E;
    }

    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px; height: 36px; padding: 0 14px;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
      border: 1px solid transparent; font-family: inherit;
      white-space: nowrap;
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
    .btn-submit { background: #059669; color: #FFFFFF; border-color: #059669; }
    .btn-submit:hover:not(:disabled) { background: #047857; }
    .btn-delete { background: #FFFFFF; border-color: #FCA5A5; color: #DC2626; }
    .btn-delete:hover:not(:disabled) { background: #FEF2F2; }
    .btn-cancel-operation { background: #FFFFFF; border-color: #FDBA74; color: #C2410C; }
    .btn-cancel-operation:hover:not(:disabled) { background: #FFF7ED; }
    .btn-accept { background: #FFFFFF; border-color: #A7F3D0; color: #047857; }
    .btn-accept:hover:not(:disabled) { background: #ECFDF5; }

    .issue-object-search { position: relative; }
    .search-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #FFFFFF;
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      max-height: 240px;
      overflow-y: auto;
      z-index: 10;
      margin-top: 4px;
    }
    .dropdown-item {
      display: flex;
      flex-direction: column;
      gap: 1px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }
    .dropdown-item:hover { background: #F8FAFC; }
    .dropdown-item + .dropdown-item { border-top: 1px solid #E2E8F0; }
    .item-title { font-size: 13px; font-weight: 500; color: #1F2937; }
    .item-subtitle { font-size: 11px; color: #94A3B8; }

    .issue-object-selected {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
    }
    .selected-label { font-size: 13px; font-weight: 500; color: #1F2937; flex: 1; }
    .btn-icon-sm {
      width: 20px; height: 20px;
      border: none; background: transparent;
      cursor: pointer; color: #94A3B8;
      font-size: 14px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .btn-icon-sm:hover { color: #3B82F6; }

    .header-title-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .operation-uuid {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #94A3B8;
      font-family: monospace;
    }
    .btn-copy-uuid {
      width: 20px; height: 20px;
      border: none; background: transparent;
      cursor: pointer; font-size: 13px;
      padding: 0; line-height: 1;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px;
    }
    .btn-copy-uuid:hover { background: #F1F5F9; }
    .btn-copy-uuid--copied { color: #059669; }
    .readonly-value {
      display: block;
      padding: 6px 0;
      font-size: 13px;
      color: #374151;
      line-height: 1.5;
    }
    .radio-group { display: flex; gap: 16px; }
    .radio-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151; cursor: pointer; }
    .radio-item input { margin: 0; }
  `]
})
export class OperationCreateModalComponent implements OnInit, OnDestroy {
  draft = input.required<OperationDraftVm | null>();
  sites = input.required<SiteDto[]>();
  isSaving = input<boolean>(false);
  isSubmitting = input<boolean>(false);
  submitError = input<string>('');
  submitState = input<string>('editing');
  submitMessage = input<string>('');
  save = output<OperationDraftVm>();
  submit = output<OperationDraftVm>();
  retrySubmit = output<OperationDraftVm>();
  resolveSubmit = output<OperationDraftVm>();
  retryRefresh = output<void>();
  cancel = output<void>();
  delete = output<OperationDraftVm>();
  cancelOperation = output<OperationDraftVm>();
  acceptOperation = output<OperationDraftVm>();

  @ViewChild('itemSearch') private itemSearch?: ItemCacheSearchComponent;

  private readonly service = inject(OperationsService);
  private readonly authContextService = inject(AuthContextService);
  private readonly issueObjectsService = inject(IssueObjectsService);
  private readonly diagnostics = inject(DiagnosticsSessionService);
  private readonly diag = inject(DiagnosticsService);
  private readonly bff = inject(BffApiService);

  readonly localDraft = signal<OperationDraftVm>({
    type: 'MOVE',
    status: 'draft',
    effectiveAt: currentDateTimeLocal(),
    lines: [],
  });

  readonly isEdit = computed(() => !!this.localDraft().id);
  readonly isLockedFromAssetRow = computed(() => !!this.localDraft().lockedFromAssetRow);
  readonly isReadonly = computed(() => {
    const status = this.localDraft().status;
    return status === 'submitted' || status === 'cancelled';
  });
  readonly hasPrefilledAssetLine = computed(() => !!this.localDraft().prefilledAssetLine);
  readonly isMove = computed(() => this.localDraft().type === 'MOVE');
  readonly isObjectSourceFlow = computed(() => {
    const d = this.localDraft();
    if (d.type === 'ISSUE_RETURN') return true;
    if (d.type === 'WRITE_OFF' && d.writeOffSource === 'object') return true;
    return false;
  });
  readonly lines = computed(() => {
    const draftLines = this.localDraft().lines;
    return draftLines.map(l => ({ ...l, error: this.lineAvailableQtyError(l) }));
  });

  readonly totalQuantity = computed(() => {
    return this.localDraft().lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
  });

  readonly savedOperationId = signal<string | null>(null);
  readonly submitErrorLocal = signal<string>('');

  readonly hasUnsavedChanges = computed(() => {
    const d = this.localDraft();
    if (!d.lastSavedSnapshot) return d.lines.length > 0;
    return !isDraftClean(d);
  });

  readonly isBalanceRefreshing = signal<boolean>(false);
  private balanceRefreshSeq = 0;

  readonly typeOptions = (Object.entries(OPERATION_TYPE_LABELS) as [OperationType, string][])
    .map(([key, label]) => ({ key, label }));

  readonly issueObjectSearchQuery = signal<string>('');
  readonly issueObjectSearchResults = signal<IssueObject[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly relevantSiteId = computed(() => {
    const d = this.localDraft();
    if (d.type === 'RECEIVE') return d.destinationSiteId ?? null;
    return d.sourceSiteId ?? null;
  });

  readonly logicalWarehouseSiteId = computed(() => {
    const d = this.localDraft();
    return d.type === 'RECEIVE' ? (d.destinationSiteId ?? null) : (d.sourceSiteId ?? null);
  });

  readonly showPersonName = computed(() => {
    return this.localDraft().type === 'EXPENSE';
  });

  readonly showIssueObjectSearch = computed(() => {
    const t = this.localDraft().type;
    if (t === 'ISSUE' || t === 'ISSUE_RETURN') return true;
    if (t === 'WRITE_OFF' && this.localDraft().writeOffSource === 'object') return true;
    return false;
  });

  readonly showWriteOffSource = computed(() => {
    return this.localDraft().type === 'WRITE_OFF' && !this.localDraft().writeOffSource;
  });

  readonly sourceLabel = computed(() => {
    const t = this.localDraft().type;
    if (t === 'MOVE') return 'Склад-источник';
    return 'Склад';
  });

  readonly saveDisabledReason = computed(() => {
    const d = this.localDraft();
    if (d.lines.length === 0) return 'Добавьте минимум одну позицию';
    if (d.lines.some(l => !l.itemId && !l.inlineItem)) return 'Укажите номенклатуру для всех позиций';
    if (d.lines.some(l => l.inlineItem && (!l.inlineItem.name || !l.inlineItem.unitId))) return 'Укажите название и единицу измерения для всех временных позиций';
    if (d.lines.some(l => l.quantity == null || l.quantity <= 0)) return 'Укажите количество для всех позиций';
    if (d.type === 'MOVE') {
      if (!d.sourceSiteId) return 'Укажите склад-источник';
      if (!d.destinationSiteId) return 'Укажите склад-получатель';
    } else if (d.type === 'RECEIVE') {
      if (!d.destinationSiteId) return 'Укажите склад';
    } else if (this.isObjectSourceFlow()) {
      // ISSUE_RETURN and object-source WRITE_OFF still require a target
      // warehouse site (site_id on the server) — the object is the logical
      // source for register math, but the physical return / write-off must
      // land on a real warehouse.
      if (!d.sourceSiteId) return 'Укажите склад-получатель';
    } else {
      if (!d.sourceSiteId) return 'Укажите склад';
    }
    if (d.type === 'WRITE_OFF' && !d.writeOffSource) return 'Укажите источник списания';
    if (d.type === 'WRITE_OFF' && d.writeOffSource === 'object' && !d.issueObjectId) return 'Укажите объект списания';
    if ((d.type === 'ISSUE' || d.type === 'ISSUE_RETURN') && !d.issueObjectId) return 'Укажите объект выдачи';
    for (const line of d.lines) {
      const lineErr = this.lineAvailableQtyError(line);
      if (lineErr) return lineErr;
    }
    return null;
  });

  readonly canSubmitComputed = computed(() => {
    if (this.saveDisabledReason()) return false;
    return true;
  });

  readonly submitDisabledReason = computed(() => {
    if (this.saveDisabledReason()) return this.saveDisabledReason() ?? '';
    return '';
  });

  readonly canCancelOperation = computed(() => {
    const d = this.localDraft();
    if (!d.id) return false;
    if (d.status === 'cancelled') return false;

    const auth = this.authContextService.authContext();
    const role = auth?.role ?? 'observer';
    if (role === 'observer') return false;

    if (role === 'root') return d.status === 'draft' || d.status === 'submitted';
    if (role === 'chief_storekeeper') return d.status === 'draft';
    if (role === 'storekeeper') return d.status === 'draft' && !!d.createdByUserId && d.createdByUserId === auth?.userId;
    return false;
  });

  readonly canAcceptOperation = computed(() => {
    const d = this.localDraft();
    if (!d.id) return false;
    if (d.type !== 'MOVE' && d.type !== 'RECEIVE') return false;
    return d.status === 'submitted' && (d.acceptanceState === 'pending' || d.acceptanceState === 'in_progress');
  });

  readonly typeLabelForDisplay = computed(() => {
    const type = this.localDraft().type;
    return OPERATION_TYPE_LABELS[type] || type;
  });

  readonly sourceSiteName = computed(() => {
    const id = this.localDraft().sourceSiteId;
    if (!id) return '—';
    const site = this.sites().find(s => s.id === id);
    return site?.name || `Склад #${id}`;
  });

  readonly destinationSiteName = computed(() => {
    const id = this.localDraft().destinationSiteId;
    if (!id) return '—';
    const site = this.sites().find(s => s.id === id);
    return site?.name || `Склад #${id}`;
  });

  readonly writeOffSourceLabel = computed(() => {
    const s = this.localDraft().writeOffSource;
    if (s === 'warehouse') return 'Со склада';
    if (s === 'object') return 'С объекта выдачи';
    return '—';
  });

  readonly canRestoreOperation = computed(() => {
    const d = this.localDraft();
    if (!d.id) return false;
    if (d.status !== 'cancelled') return false;
    const auth = this.authContextService.authContext();
    return auth?.role === 'root';
  });

  readonly canDeleteCancelled = computed(() => {
    const d = this.localDraft();
    if (!d.id) return false;
    if (d.status !== 'cancelled') return false;
    const auth = this.authContextService.authContext();
    const role = auth?.role ?? 'observer';
    if (role === 'root') return true;
    if (role === 'chief_storekeeper') return true;
    if (role === 'storekeeper') return !!d.createdByUserId && d.createdByUserId === auth?.userId;
    return false;
  });

  readonly restore = output<OperationDraftVm>();

  onRestore(): void {
    this.restore.emit(this.localDraft());
  }

  readonly isInlineModalOpen = signal(false);

  readonly inlineItemsForSearch = computed(() => {
    const seen = new Set<string>();
    const result: OperationInlineItemDraftVm[] = [];
    for (const line of this.localDraft().lines) {
      if (line.inlineItem && !seen.has(line.inlineItem.clientKey)) {
        seen.add(line.inlineItem.clientKey);
        result.push(line.inlineItem);
      }
    }
    return result;
  });

  openInlineModal(): void {
    this.isInlineModalOpen.set(true);
  }

  closeInlineModal(): void {
    this.isInlineModalOpen.set(false);
  }

  onInlineItemCreated(inlineItem: OperationInlineItemDraftVm): void {
    this.localDraft.update(d => ({
      ...d,
      lines: [
        ...d.lines,
        {
          localId: nextLocalId(),
          itemId: null,
          itemName: inlineItem.name,
          categoryName: inlineItem.categoryName || undefined,
          sku: inlineItem.sku,
          unitId: inlineItem.unitId,
          unitName: inlineItem.unitName,
          quantity: null,
          availableQuantity: null,
          sourceSiteQuantity: null,
          isTemporary: false,
          fromBalances: false,
          lineNumber: d.lines.length + 1,
          inlineItem,
        },
      ],
    }));
    this.closeInlineModal();
  }

  onInlineSearchSelected(inlineItem: OperationInlineItemDraftVm): void {
    this.localDraft.update(d => ({
      ...d,
      lines: [
        ...d.lines,
        {
          localId: nextLocalId(),
          itemId: null,
          itemName: inlineItem.name,
          categoryName: inlineItem.categoryName || undefined,
          sku: inlineItem.sku,
          unitId: inlineItem.unitId,
          unitName: inlineItem.unitName,
          quantity: null,
          availableQuantity: null,
          sourceSiteQuantity: null,
          isTemporary: false,
          fromBalances: false,
          lineNumber: d.lines.length + 1,
          inlineItem: {
            ...inlineItem,
            // reuse same clientKey so backend groups lines by client_key
          },
        },
      ],
    }));
  }

  private preferredSiteId(): string | null {
    const authSiteId = this.authContextService.authContext()?.defaultSiteId;
    if (authSiteId) return authSiteId;

    const availableSites = this.sites();
    if (availableSites.length === 1) return availableSites[0].id;

    return null;
  }

  private normalizeDraftForType(type: OperationType, draft: OperationDraftVm): OperationDraftVm {
    const preferredSiteId = this.preferredSiteId();

    if (type === 'RECEIVE') {
      return {
        ...draft,
        type,
        sourceSiteId: null,
        destinationSiteId: draft.destinationSiteId ?? preferredSiteId,
        writeOffSource: null,
      };
    }

    if (type === 'MOVE') {
      return {
        ...draft,
        type,
        sourceSiteId: draft.sourceSiteId ?? preferredSiteId,
        writeOffSource: null,
      };
    }

    return {
      ...draft,
      type,
      sourceSiteId: draft.sourceSiteId ?? preferredSiteId,
      destinationSiteId: null,
      writeOffSource: type === 'WRITE_OFF' ? draft.writeOffSource : null,
    };
  }

  private lineAvailableQtyError(line: OperationLineDraftVm): string | null {
    if (line.quantity == null || line.quantity <= 0) {
      return 'Количество должно быть больше 0';
    }
    const d = this.localDraft();
    const isObjectFlow = d.type === 'ISSUE_RETURN'
      || (d.type === 'WRITE_OFF' && d.writeOffSource === 'object');
    if (isObjectFlow) {
      // Object-source flows must use only the qty that was prefilled from the
      // assigned-asset row. If availableQuantity is missing or non-positive,
      // there is nothing to return / write off from this object.
      if (line.availableQuantity == null || line.availableQuantity <= 0) {
        return 'На объекте нет назначенного имущества для этой операции';
      }
      if (line.quantity > line.availableQuantity) {
        return `Количество не может превышать имеющееся на объекте (${line.availableQuantity})`;
      }
    }
    return null;
  }

  constructor() {
    effect(() => {
      this.submitErrorLocal.set(this.submitError());
    });

    effect(() => {
      const d = this.draft();
      if (d) {
        const normalized = this.normalizeDraftForType(d.type, { ...d, effectiveAt: d.effectiveAt ?? currentDateTimeLocal(), lines: [...d.lines] });
        // TZ C5 §5.3 / §11.3: ensure draftId + idempotencyKey exist for both
        // new drafts and legacy drafts loaded without them. When the draft is
        // bound to an existing server-side id (edit of saved operation), we
        // still need a draftId for the X-Client-Draft-Id header on subsequent
        // mutations; idempotencyKey is reused if present, otherwise generated
        // here for back-compat.
        if (!normalized.draftId) {
          normalized.draftId = this.diagnostics.newDraftId();
        }
        if (!normalized.idempotencyKey) {
          normalized.idempotencyKey = this.diagnostics.newIdempotencyKey();
        }
        this.localDraft.set(normalized);
        // Track saved operation ID and snapshot
        this.savedOperationId.set(d.id ?? null);
        // Diagnostics TZ Stage 3 WP-4: form_opened event
        this.diag.track('form_opened', {
          draft: { draftId: normalized.draftId, idempotencyKey: normalized.idempotencyKey, type: normalized.type },
        });
      }
    });

    effect(() => {
      const siteId = this.relevantSiteId();
      const isObjectSourceFlow = this.isObjectSourceFlow();
      const hasPrefilledAssetLine = this.hasPrefilledAssetLine();
      // For object-source flows (ISSUE_RETURN, WRITE_OFF from object), the
      // availableQuantity is the qty assigned to the issue object, not the
      // warehouse balance. Skip the warehouse balance refresh so prefilled
      // object qty is not overwritten.
      if (isObjectSourceFlow || hasPrefilledAssetLine) {
        this.isBalanceRefreshing.set(false);
        return;
      }
      if (siteId && siteId !== 'undefined' && siteId !== 'null') {
        const seq = ++this.balanceRefreshSeq;
        this.isBalanceRefreshing.set(true);
        this.service.loadBalances(siteId).then(() => {
          if (seq !== this.balanceRefreshSeq) return;
          if (this.relevantSiteId() === siteId) {
            this.refreshSourceQuantities();
          }
          this.isBalanceRefreshing.set(false);
        });
      } else {
        // Clear balances when no site selected
        this.service.balances.set([]);
        this.isBalanceRefreshing.set(false);
        const hasNonZeroStockHints = this.localDraft().lines.some(l => (l.availableQuantity ?? 0) !== 0 || (l.sourceSiteQuantity ?? 0) !== 0);
        if (!hasNonZeroStockHints) {
          return;
        }
        this.localDraft.update(state => ({
          ...state,
          lines: state.lines.map(l => ({
            ...l,
            availableQuantity: 0,
            sourceSiteQuantity: 0,
          })),
        }));
      }
    });
  }

  ngOnInit(): void {
  }

  private updateLineStockHint(line: OperationLineDraftVm): void {
    if (!line.itemId) return;
    // Do not overwrite object-assigned qty with warehouse balance for
    // object-source flows or prefilled-from-object lines.
    if (this.isObjectSourceFlow() || this.hasPrefilledAssetLine()) return;
    const siteId = this.relevantSiteId() || undefined;
    const qty = this.service.getBalanceForItem(line.itemId, siteId);
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l =>
        l.localId === line.localId ? { ...l, availableQuantity: qty } : l
      ),
    }));
  }

  private refreshSourceQuantities(): void {
    // Do not overwrite object-assigned qty for object-source flows.
    if (this.isObjectSourceFlow() || this.hasPrefilledAssetLine()) return;
    const siteId = this.relevantSiteId() || undefined;
    const balances = this.service.balances();
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l => {
        if (!l.itemId) return l;
        const qty = this.service.getBalanceForItem(l.itemId, siteId);
        const balanceRow = balances.find(b => String(b.item_id) === String(l.itemId));
        return {
          ...l,
          itemName: l.itemName || balanceRow?.item_name || '',
          unitName: l.unitName && l.unitName !== 'шт' ? l.unitName : (balanceRow?.unit_symbol || l.unitName),
          availableQuantity: qty,
          sourceSiteQuantity: qty,
        };
      }),
    }));
  }

  private shouldUseWarehouseBalances(): boolean {
    return !this.isObjectSourceFlow() && !this.hasPrefilledAssetLine();
  }

  private async refreshBeforePersist(): Promise<void> {
    if (!this.shouldUseWarehouseBalances()) return;
    const siteId = this.relevantSiteId();
    if (!siteId || siteId === 'undefined' || siteId === 'null') return;
    const seq = ++this.balanceRefreshSeq;
    this.isBalanceRefreshing.set(true);
    await this.service.loadBalances(siteId);
    if (seq === this.balanceRefreshSeq) {
      if (this.relevantSiteId() === siteId) {
        this.refreshSourceQuantities();
      }
      this.isBalanceRefreshing.set(false);
    }
  }

  onTypeModelChange(value: OperationType | null): void {
    if (!value) return;
    // Locked-from-row drafts must keep the type that was determined by the
    // assigned-asset row; otherwise the line/qty cap becomes meaningless.
    if (this.isLockedFromAssetRow()) return;
    this.localDraft.update(d => this.normalizeDraftForType(value, d));
  }

  onSourceSiteChange(value: string | null): void {
    this.localDraft.update(d => ({ ...d, sourceSiteId: value || null }));
  }

  onLogicalWarehouseSiteChange(value: string | null): void {
    this.localDraft.update(d => d.type === 'RECEIVE'
      ? { ...d, destinationSiteId: value || null }
      : { ...d, sourceSiteId: value || null }
    );
  }

  onDestinationSiteChange(value: string | null): void {
    this.localDraft.update(d => ({ ...d, destinationSiteId: value || null }));
  }

  onPersonNameChange(value: string): void {
    this.localDraft.update(d => ({ ...d, personName: value || undefined }));
  }

  onWriteOffSourceChange(source: 'warehouse' | 'object'): void {
    this.localDraft.update(d => ({
      ...d,
      writeOffSource: source,
      sourceSiteId: source === 'warehouse' ? (d.sourceSiteId ?? this.preferredSiteId()) : d.sourceSiteId,
    }));
  }

  onIssueObjectSearchChange(value: string): void {
    this.issueObjectSearchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(async () => {
      if (!value || value.length < 2) {
        this.issueObjectSearchResults.set([]);
        return;
      }
      try {
        await this.issueObjectsService.loadList({ search: value, page_size: 10, is_active: true });
        this.issueObjectSearchResults.set(this.issueObjectsService.items());
      } catch {
        this.issueObjectSearchResults.set([]);
      }
    }, 300);
  }

  selectIssueObject(obj: IssueObject): void {
    this.localDraft.update(d => ({ ...d, issueObjectId: obj.id, issueObjectName: obj.display_name }));
    this.issueObjectSearchQuery.set('');
    this.issueObjectSearchResults.set([]);
  }

  clearIssueObject(): void {
    // Locked-from-row drafts must keep the issue object that the row determined.
    if (this.isLockedFromAssetRow()) return;
    this.localDraft.update(d => ({ ...d, issueObjectId: null, issueObjectName: null }));
  }

  objectTypeLabel(type: string): string {
    return ISSUE_OBJECT_TYPE_LABELS[type as IssueObjectType] || type;
  }

  onEffectiveAtChange(value: string): void {
    this.localDraft.update(d => ({ ...d, effectiveAt: value || null }));
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
      lines: d.lines
        .filter(l => l.localId !== localId)
        .map((l, idx) => ({ ...l, lineNumber: idx + 1 })),
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
              categoryName: item.category_name ?? undefined,
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
    const isObjectFlow = this.isObjectSourceFlow() || this.localDraft().prefilledAssetLine === true;
    const availableQuantity = isObjectFlow
      ? null
      : this.service.getBalanceForItem(item.id, this.relevantSiteId() || undefined);
    this.localDraft.update(d => ({
      ...d,
      lines: [
        ...d.lines,
        {
          localId: nextLocalId(),
          itemId: item.id,
          itemName: item.name,
          categoryName: item.category_name ?? undefined,
          sku: item.sku,
          unitId: item.unit_id,
          unitName: item.unit_symbol,
          quantity: null,
          availableQuantity,
          sourceSiteQuantity: availableQuantity,
          isTemporary: false,
          fromBalances: false,
          lineNumber: d.lines.length + 1,
        },
      ],
    }));
    this.itemSearch?.reset();
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

  async onSave(): Promise<void> {
    if (this.saveDisabledReason()) return;
    await this.refreshBeforePersist();
    this.bff.setCurrentDraftId(this.localDraft().draftId ?? null);
    try {
      this.save.emit(this.localDraft());
    } finally {
      this.bff.setCurrentDraftId(null);
    }
  }

  onSaveComplete(savedId: string): void {
    this.savedOperationId.set(savedId);
  }

  async onSubmit(): Promise<void> {
    // Diagnostics TZ Stage 3 WP-4: validation_failed if canSubmit is false
    if (!this.canSubmitComputed()) {
      this.diag.track('validation_failed', {
        draft: this.localDraft(),
        reason: this.submitDisabledReason() || 'cannot submit',
      });
      return;
    }
    // Diagnostics: submit_clicked
    this.diag.track('submit_clicked', {
      draft: this.localDraft(),
      itemsCount: this.localDraft().lines.length,
    });
    await this.refreshBeforePersist();
    this.bff.setCurrentDraftId(this.localDraft().draftId ?? null);
    try {
      this.submit.emit(this.localDraft());
    } finally {
      this.bff.setCurrentDraftId(null);
    }
  }

  ngOnDestroy(): void {
    // Diagnostics TZ Stage 3 WP-4: form_closed
    this.diag.track('form_closed', {
      draft: this.localDraft(),
      hasUnsavedChanges: this.hasUnsavedChangesForDiagnostics(),
    });
  }

  private hasUnsavedChangesForDiagnostics(): boolean {
    const d = this.localDraft();
    if (!d.lastSavedSnapshot) return d.lines.length > 0;
    return d.lastSavedSnapshot !== JSON.stringify(d);
  }

  onDelete(): void {
    this.delete.emit(this.localDraft());
  }

  onCancelOperation(): void {
    this.cancelOperation.emit(this.localDraft());
  }

  onAcceptOperation(): void {
    this.acceptOperation.emit(this.localDraft());
  }

  async copyUuid(): Promise<void> {
    const id = this.localDraft().id;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = id;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }
}
