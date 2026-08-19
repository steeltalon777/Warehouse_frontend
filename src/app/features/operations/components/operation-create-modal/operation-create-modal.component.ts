import { Component, input, output, signal, computed, effect, inject, ChangeDetectorRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AuthContextService } from '../../../../core/services/auth-context.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  OperationDraftVm,
  OperationType,
  OperationLineDraftVm,
  OperationInlineItemDraftVm,
  SiteDto,
  BalanceDto,
  OperationSaveLineError,
  OPERATION_TYPE_LABELS,
  OPERATION_STATUS_LABELS,
} from '../../../../core/models/operations.models';
import { OperationsService } from '../../../../core/services/operations.service';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { DiagnosticsSessionService } from '../../../../core/services/diagnostics-session.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { DraftStorageService } from '../../../../core/services/draft-storage.service';
import { BffApiService } from '../../../../core/api/bff-api.service';
import { ItemCacheSearchComponent } from '../item-cache-search/item-cache-search.component';
import { OperationLinesTableComponent, LineSubmitErrorState } from './operation-lines-table.component';
import { InlineItemCreateModalComponent } from '../inline-item-create-modal/inline-item-create-modal.component';
import { ErrorAlertComponent } from '../../../../shared/components/error-alert/error-alert.component';
import { Item } from '../../../../core/models/nomenclature.models';
import { IssueObject, IssueObjectType, ISSUE_OBJECT_TYPE_LABELS } from '../../../../core/models/issue-objects.models';
import { snapshotDraft, isDraftClean } from './operation-draft-mappers';
import { SubmitErrorService } from '../../submit-error/submit-error.service';
import { buildSubmitToasts, collectUnknownSubmitErrors, formatSubmitStockHint } from './submit-error-toasts';
import { CatalogSearchService } from '../../../../core/services/catalog-search.service';

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
  providers: [SubmitErrorService],
  template: `
    <div class="wh-modal-overlay modal-overlay" [class.modal-overlay--pair]="isInlineModalOpen()">
      <div class="wh-modal modal-container" [attr.data-mode]="isReadonly() ? 'view' : 'edit'">
        <div class="modal-header">
          <div class="modal-header__title-group">
            <div class="modal-header__title-row">
              <h2>{{ isEdit() ? 'Редактирование операции' : 'Новая операция' }}</h2>
              @if (localDraft().displayNumber) {
                <span class="modal-header__num">№ {{ localDraft().displayNumber }}</span>
              }
              @if (statusBadgeLabel()) {
                <span class="status-badge" [class]="statusBadgeClass()">{{ statusBadgeLabel() }}</span>
              }
            </div>
            @if (localDraft().id) {
              <div class="operation-uuid">
                <span class="uuid-text">{{ localDraft().id }}</span>
                <button class="btn-copy-uuid" (click)="copyUuid()" title="Копировать UUID">📋</button>
              </div>
            }
          </div>
          <button class="icon-btn btn-close" aria-label="Закрыть" data-submit-close-btn (click)="onCancelClick()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="modal-banners">
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
          @if (refreshError(); as err) {
            <div
              class="refresh-error-banner"
              data-testid="refresh-check-error"
              role="alert">
              <strong>Не удалось проверить ТМЦ:</strong> {{ err.message }}
            </div>
          }
        </div>
        <div class="modal-form-grid">
            <!-- Form grid: type / warehouse(s) / date (TZ §11).
                 data-variant switches between 3-col default and 4-col MOVE.
                 DOM order of selects preserved (type, source[, destination]). -->
            <div class="form-grid" [attr.data-variant]="isMove() ? 'move' : 'default'">
              <!-- Operation type -->
              <div class="form-field">
                <label class="form-field__label">Тип операции</label>
                @if (!isReadonly()) {
                  <select class="control" [ngModel]="localDraft().type" (ngModelChange)="onTypeModelChange($event)" [disabled]="isReadonly() || isLockedFromAssetRow()">
                    @for (t of typeOptions; track t.key) {
                      <option [value]="t.key">{{ t.label }}</option>
                    }
                  </select>
                } @else {
                  <span class="readonly-value readonly-type">{{ typeLabelForDisplay() }}</span>
                }
              </div>

              <!-- Source warehouse -->
              <div class="form-field">
                <label class="form-field__label">{{ sourceLabel() }}</label>
                @if (!isReadonly()) {
                  <select class="control" [ngModel]="isMove() ? (localDraft().sourceSiteId ?? '') : (logicalWarehouseSiteId() ?? '')" (ngModelChange)="isMove() ? onSourceSiteChange($event) : onLogicalWarehouseSiteChange($event)" [disabled]="isReadonly()">
                    <option value="">—</option>
                    @for (site of sites(); track site.id) {
                      <option [value]="site.id">{{ site.name }}</option>
                    }
                  </select>
                } @else {
                  <span class="readonly-value">{{ sourceSiteName() }}</span>
                }
              </div>

              <!-- Destination warehouse: only for MOVE (3rd select in DOM order) -->
              @if (isMove()) {
                <div class="form-field">
                  <label class="form-field__label">Склад-получатель</label>
                  @if (!isReadonly()) {
                    <select class="control" [ngModel]="localDraft().destinationSiteId ?? ''" (ngModelChange)="onDestinationSiteChange($event)" [disabled]="isReadonly()">
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

              <!-- Date: integrated into the grid; type stays datetime-local (I7) -->
              <div class="form-field form-field--date">
                <label class="form-field__label">Дата проведения</label>
                @if (!isReadonly()) {
                  <input
                    type="datetime-local"
                    class="control"
                    [ngModel]="localDraft().effectiveAt"
                    (ngModelChange)="onEffectiveAtChange($event)"
                  />
                } @else {
                  <span class="readonly-value">{{ localDraft().effectiveAt }}</span>
                }
              </div>
            </div>

          <!-- Conditional full-width rows (TZ §11). -->
          @if (showPersonName()) {
            <div class="form-row form-row--full">
              <label class="form-row__label">ФИО получателя / выдачи</label>
              @if (!isReadonly()) {
                <input type="text" class="control" [ngModel]="localDraft().personName" (ngModelChange)="onPersonNameChange($event)" placeholder="Фамилия Имя Отчество" />
              } @else {
                <span class="readonly-value">{{ localDraft().personName }}</span>
              }
            </div>
          }

          @if (showIssueObjectSearch()) {
            <div class="form-row form-row--full">
              <label class="form-row__label">Объект выдачи</label>
              @if (!isReadonly()) {
                @if (localDraft().issueObjectName) {
                  <div class="issue-object-selected">
                    <span class="selected-label">{{ localDraft().issueObjectName }}</span>
                    @if (!isLockedFromAssetRow()) {
                      <button class="icon-btn btn-icon-sm" (click)="clearIssueObject()" title="Изменить">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        </svg>
                      </button>
                    }
                  </div>
                } @else {
                  <div class="issue-object-search">
                    <input
                      type="text"
                      class="control"
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

          @if (showWriteOffSource() && !isLockedFromAssetRow()) {
            <div class="form-row form-row--full">
              <label class="form-row__label">Источник списания</label>
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

          <!-- Comment row: full-width, 2 rows (TZ §11). -->
          <div class="form-row form-row--full">
            <label class="form-row__label">Комментарий</label>
            @if (!isReadonly()) {
              <textarea class="control comment-area" rows="2" [ngModel]="localDraft().comment" (ngModelChange)="onCommentChange($event)" placeholder="Комментарий к операции..."></textarea>
            } @else {
              <span class="readonly-value">{{ localDraft().comment || '—' }}</span>
            }
          </div>
        </div>

        <div class="modal-add-toolbar">
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
                      [consistency]="'authoritative'"
                      (itemSelected)="onNewItemSelected($event)"
                      (refreshRequested)="onRefreshCheckItems()"
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
        </div>

        <div class="modal-table-toolbar">
          <div class="table-toolbar__left">
            <div class="section-header">
              <h3>Позиции: {{ lines().length }}, Всего: {{ totalQuantity() }}</h3>
            </div>
          </div>
          <div class="table-toolbar__right">
            <button
              type="button"
              class="btn-refresh-balances"
              data-testid="operation-lines-refresh-all"
              [disabled]="isBalanceRefreshing()"
              (click)="onRefreshAllBalances()"
              [title]="isBalanceRefreshing() ? 'Обновление...' : 'Обновить остатки'"
              aria-label="Обновить остатки"
            >
              @if (isBalanceRefreshing()) {
                <span class="mini-spinner" aria-hidden="true"></span>
              } @else {
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                  <path d="M3 21v-5h5"/>
                </svg>
              }
              <span>Обновить остатки</span>
            </button>
          </div>
        </div>

        @if (showLinesFilter()) {
          <div class="modal-lines-filter">
            <input
              type="search"
              class="lines-filter-input"
              [ngModel]="tableNameFilter()"
              (ngModelChange)="tableNameFilter.set($event)"
              placeholder="Фильтр уже добавленных ТМЦ..."
              aria-label="Фильтр добавленных позиций"
            />
          </div>
        }

        <div class="modal-table-wrap">
          <app-operation-lines-table
            [lines]="lines()"
            [warehouseSiteId]="relevantSiteId()"
            [isBalanceRefreshing]="isBalanceRefreshing()"
            [operationType]="localDraft().type"
            [isObjectSourceFlow]="isObjectSourceFlow()"
            [submitErrorLines]="lineSubmitErrors()"
            [nameFilter]="tableNameFilter()"
            [isReadonly]="isReadonly()"
            (quantityChange)="onQuantityChange($event.localId, $event.quantity)"
            (removeLine)="removeLine($event)"
          />
        </div>

        <div class="modal-footer">
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
              <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCancelClick()">Закрыть</button>
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
              <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onCancelClick()">Отмена</button>
              <button class="wh-btn wh-btn--primary btn btn-primary" [disabled]="isSaving() || !!saveDisabledReason() || isRefreshing() || hasUnusableLines()" (click)="onSave()">Сохранить черновик</button>
              @if (hasStaleVersion()) {
                <button class="wh-btn wh-btn--secondary btn btn-secondary" data-testid="operation-submit-refresh" data-submit-refresh-btn (click)="onRefreshClick()">Обновить</button>
              }
              <button class="wh-btn wh-btn--success btn btn-submit" [disabled]="!canSubmitComputed() || isSubmitting() || isRefreshing() || hasUnusableLines()" [title]="submitDisabledReason()" (click)="onSubmit()">Подтвердить</button>
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
      @if (toasts().length > 0) {
        <div class="submit-toasts" data-testid="operation-submit-toast" role="alert" aria-live="assertive">
          @for (toast of toasts(); track toast) {
            <div class="submit-toast">{{ toast }}</div>
          }
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
      /* ─── Design tokens (TZ §11, scoped to modal) ─────────── */
      --f-bg: #F8FAFC;
      --f-surface: #FFFFFF;
      --f-surface-2: #F1F5F9;
      --f-surface-3: #E2E8F0;
      --f-fg: #0F172A;
      --f-fg-2: #334155;
      --f-muted: #64748B;
      --f-muted-2: #94A3B8;
      --f-border: #E2E8F0;
      --f-border-2: #CBD5E1;
      --f-accent: #059669;
      --f-accent-hover: #047857;
      --f-accent-bg: #ECFDF5;
      --f-accent-border: #A7F3D0;
      --f-warn: #92400E;
      --f-warn-bg: #FFFBEB;
      --f-warn-border: #FDE68A;
      --f-danger: #B91C1C;
      --f-danger-bg: #FEF2F2;
      --f-danger-border: #FECACA;
      --f-info: #1D4ED8;
      --f-info-bg: #EFF6FF;
      --f-info-border: #BFDBFE;
      --f-font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif;
      --f-font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
      --f-r-sm: 4px;
      --f-r-md: 6px;
      --f-r-modal: 10px;
      --f-ctrl-h: 32px;
      --f-ctrl-h-sm: 28px;

      font-family: var(--f-font-body);
      font-size: 14px;
      line-height: 1.45;
      color: var(--f-fg);
      -webkit-font-smoothing: antialiased;

      /* ─── Grid scaffold (TZ §6) ─────────────────────────────── */
      background: var(--f-surface);
      border-radius: var(--f-r-modal);
      border: 1px solid var(--f-border);
      box-shadow:
        0 1px 0 rgba(15, 23, 42, 0.04),
        0 12px 32px -8px rgba(15, 23, 42, 0.18),
        0 2px 6px rgba(15, 23, 42, 0.06);
      width: 100%;
      max-width: 1450px;
      height: clamp(640px, 94vh, 1000px);
      display: grid;
      grid-template-rows:
        auto         /* 1: header */
        auto         /* 2: banners (collapses to 0 when empty) */
        auto         /* 3: form-grid */
        auto         /* 4: add-toolbar (hidden in view) */
        auto         /* 5: table-toolbar */
        auto         /* 6: lines-filter */
        minmax(0, 1fr)/* 7: table-wrap (scroll) */
        auto;        /* 8: footer */
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--f-border);
      background: var(--f-surface);
    }
    .modal-header__title-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .modal-header__title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex-wrap: wrap;
    }
    .modal-header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--f-fg);
      letter-spacing: -0.01em;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .modal-header__num {
      font-family: var(--f-font-mono);
      font-size: 13px;
      color: var(--f-muted);
      font-weight: 500;
      margin-left: 2px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 550;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 2px 7px 2px 6px;
      border-radius: var(--f-r-sm);
      border: 1px solid transparent;
      line-height: 1.4;
      flex-shrink: 0;
    }
    .status-badge::before {
      content: "";
      width: 6px; height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    .status-badge--draft  { color: #92400E; background: var(--f-warn-bg); border-color: var(--f-warn-border); }
    .status-badge--done   { color: #047857; background: var(--f-accent-bg); border-color: var(--f-accent-border); }
    .status-badge--cancel { color: var(--f-danger); background: var(--f-danger-bg); border-color: var(--f-danger-border); }

    .icon-btn {
      appearance: none;
      background: transparent;
      border: 1px solid transparent;
      color: var(--f-muted);
      width: 28px; height: 28px;
      border-radius: var(--f-r-sm);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .icon-btn:hover { background: var(--f-surface-2); color: var(--f-fg); }
    .icon-btn:focus-visible {
      outline: 2px solid var(--f-accent);
      outline-offset: 1px;
    }
    .btn-close {
      /* legacy alias for selector compatibility */
      width: 28px; height: 28px;
    }

    .modal-banners {
      padding: 10px 20px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--f-surface);
    }
    .modal-banners:empty { display: none; }

    .modal-form-grid {
      padding: 14px 20px 12px;
      background: var(--f-surface);
      border-bottom: 1px solid var(--f-border);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .modal-add-toolbar {
      padding: 10px 20px;
      background: var(--f-surface-2);
      border-bottom: 1px solid var(--f-border);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .modal-add-toolbar:empty { display: none; }
    .modal-table-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 20px;
      background: var(--f-surface);
      border-bottom: 1px solid var(--f-border);
      min-height: 38px;
    }
    .modal-table-toolbar:empty { display: none; }
    .table-toolbar__left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .table-toolbar__right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-refresh-balances {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: var(--f-ctrl-h-sm);
      padding: 0 10px;
      border: 1px solid var(--f-border-2);
      border-radius: var(--f-r-sm);
      background: var(--f-surface);
      color: var(--f-fg-2);
      font-size: 12.5px;
      font-weight: 510;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    }
    .btn-refresh-balances:hover:not(:disabled) {
      background: var(--f-surface-2);
      border-color: var(--f-muted-2);
    }
    .btn-refresh-balances:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .btn-refresh-balances:focus-visible {
      outline: 2px solid var(--f-accent);
      outline-offset: 1px;
    }
    .mini-spinner {
      display: inline-block;
      width: 11px; height: 11px;
      border-radius: 50%;
      border: 1.5px solid var(--f-border-2);
      border-top-color: var(--f-muted);
      animation: f-spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    @keyframes f-spin { to { transform: rotate(360deg); } }
    .modal-lines-filter {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 20px;
      background: var(--f-surface);
      border-bottom: 1px solid var(--f-border);
      min-height: 40px;
    }
    .modal-lines-filter:empty { display: none; }
    .lines-filter-input {
      flex: 1;
      min-width: 0;
      height: var(--f-ctrl-h-sm);
      padding: 0 10px 0 30px;
      border: 1px solid var(--f-border-2);
      border-radius: var(--f-r-sm);
      font-size: 13px;
      color: var(--f-fg);
      background: var(--f-surface);
      background-image:
        url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><circle cx='11' cy='11' r='7'/><path d='m21 21-4.3-4.3'/></svg>");
      background-repeat: no-repeat;
      background-position: 10px 50%;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .lines-filter-input:hover { border-color: var(--f-muted-2); }
    .lines-filter-input:focus {
      outline: none;
      border-color: var(--f-accent);
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
    }
    .modal-table-wrap {
      overflow: auto;
      min-height: 0;
      background: var(--f-surface);
      scrollbar-gutter: stable;
    }

    /* ─── VIEW mode (TZ §9, §20) ──────────────────────────────── */
    .modal-container[data-mode="view"] .modal-add-toolbar { display: none; }
    .modal-container[data-mode="view"] .form-field > .control,
    .modal-container[data-mode="view"] .form-row--full > .control,
    .modal-container[data-mode="view"] .form-row--full > .issue-object-search,
    .modal-container[data-mode="view"] .form-row--full > .issue-object-selected,
    .modal-container[data-mode="view"] .form-row--full > .radio-group {
      display: none;
    }
    .modal-container[data-mode="view"] .form-field > .readonly-value,
    .modal-container[data-mode="view"] .form-row--full > .readonly-value {
      display: block;
      font-size: 13px;
      color: var(--f-fg);
      line-height: 1.4;
      padding: 4px 0;
      word-break: break-word;
    }
    .modal-container[data-mode="view"] .form-field__label,
    .modal-container[data-mode="view"] .form-row__label {
      margin-bottom: 0;
    }
    .modal-container[data-mode="view"] .modal-footer {
      background: var(--f-surface);
    }

    /* ─── Responsive (TZ §19) — selectors use .modal-form-grid ancestor
       to win CSS cascade against the default .form-grid rule below. ─── */
    @media (max-width: 1280px) {
      .modal-container {
        max-width: 100%;
      }
      .modal-form-grid .form-grid {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 0.95fr);
      }
      .modal-form-grid .form-grid[data-variant="move"] {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
    }
    @media (max-width: 1024px) {
      .modal-container {
        height: clamp(640px, 96vh, 1000px);
      }
      .modal-form-grid .form-grid,
      .modal-form-grid .form-grid[data-variant="move"] {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      .modal-table-wrap { overflow-x: auto; }
      :host ::ng-deep app-operation-lines-table .lines-data-table { min-width: 760px; }
    }
    @media (max-width: 768px) {
      .modal-container {
        height: 96vh;
      }
      .modal-form-grid .form-grid,
      .modal-form-grid .form-grid[data-variant="move"] {
        grid-template-columns: 1fr;
      }
      .modal-add-toolbar {
        flex-wrap: wrap;
        padding: 10px 14px;
      }
      .modal-header,
      .modal-table-toolbar,
      .modal-lines-filter,
      .modal-form-grid,
      .modal-footer {
        padding-left: 14px;
        padding-right: 14px;
      }
      .modal-banners { padding: 10px 14px 0; }
      .footer-actions { flex-wrap: wrap; }
    }

    /* Respect reduced-motion preference (TZ §20). */
    @media (prefers-reduced-motion: reduce) {
      .modal-container *,
      .modal-container *::before,
      .modal-container *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 20px;
      background: var(--f-surface);
      border-top: 1px solid var(--f-border);
      min-height: 56px;
    }
    .footer-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    /* ─── Form-grid (TZ §11) ──────────────────────────────────── */
.form-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      box-sizing: border-box;
    }
    .form-row--full {
      width: 100%;
    }
    .form-grid {
      display: grid;
      gap: 12px;
      align-items: start;
      grid-template-columns:
        minmax(0, 1.2fr)
        minmax(0, 1.8fr)
        minmax(0, 0.95fr);
    }
    .form-grid[data-variant="move"] {
      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1.2fr)
        minmax(0, 1.2fr)
        minmax(0, 0.85fr);
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .form-field__label,
    .form-row__label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--f-muted);
      font-weight: 550;
      line-height: 1.2;
    }
    .form-field--date {
      min-width: 0;
    }

    /* ─── Control (token-based replacement for .input) ──────── */
    .control {
      appearance: none;
      width: 100%;
      height: var(--f-ctrl-h);
      padding: 0 10px;
      border: 1px solid var(--f-border-2);
      border-radius: var(--f-r-sm);
      font-size: 13px;
      font-family: inherit;
      background: var(--f-surface);
      color: var(--f-fg);
      box-sizing: border-box;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .control:hover { border-color: var(--f-muted-2); }
    .control:focus {
      outline: none;
      border-color: var(--f-accent);
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
    }
    .control:disabled {
      background: var(--f-surface-2);
      color: var(--f-muted);
      cursor: not-allowed;
    }
    select.control {
      background-image:
        linear-gradient(45deg, transparent 50%, var(--f-muted) 50%),
        linear-gradient(-45deg, transparent 50%, var(--f-muted) 50%);
      background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
      background-size: 5px 5px;
      background-repeat: no-repeat;
      padding-right: 24px;
      cursor: pointer;
    }
    textarea.control {
      height: auto;
      min-height: 38px;
      padding: 7px 10px;
      line-height: 1.45;
      resize: vertical;
    }
    .comment-area { resize: vertical; }
    /* legacy aliases — keep selectors working for child components */
    .input,
    .wh-form-input {
      width: 100%;
      height: var(--f-ctrl-h);
      padding: 0 10px;
      border: 1px solid var(--f-border-2);
      border-radius: var(--f-r-sm);
      font-size: 13px;
      font-family: inherit;
      background: var(--f-surface);
      color: var(--f-fg);
      box-sizing: border-box;
    }
    .input:disabled,
    .wh-form-input:disabled {
      background: var(--f-surface-2);
      color: var(--f-muted);
      cursor: not-allowed;
    }
    .input:focus,
    .wh-form-input:focus {
      outline: none;
      border-color: var(--f-accent);
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
    }
    textarea.input,
    textarea.wh-form-input {
      height: auto;
      padding: 7px 10px;
      resize: vertical;
    }

    .object-source-hint .hint-card {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 10px 12px;
      background: var(--f-info-bg);
      border: 1px solid var(--f-info-border);
      border-radius: var(--f-r-md);
      color: #1E3A8A;
      font-size: 12px;
      line-height: 1.4;
    }
    .object-source-hint .hint-icon {
      font-size: 14px;
      color: var(--f-info);
      line-height: 1.2;
    }

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

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0;
    }
    .section-header h3 {
      margin: 0;
      font-size: 12.5px;
      font-weight: 500;
      color: var(--f-fg-2);
    }

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
    .refresh-error-banner {
      padding: 8px 12px;
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FCA5A5;
      border-radius: 6px;
      font-size: 13px;
      margin: 8px 0;
    }

    .submit-toasts {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1100;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(560px, calc(100vw - 32px));
    }
    .submit-toast {
      background: #7F1D1D;
      color: #FFFFFF;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      font-size: 14px;
      line-height: 1.4;
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
  /**
   * Raw HTTP error body of a rejected submit (the problem envelope from
   * TZ-FRONTEND §3). Nullable: when null the submit-error surface is reset.
   */
  submitErrorPayload = input<unknown>(null);
  /** Structured create/update line errors (`operation_lines_invalid`) from the BFF. */
  saveLineErrors = input<OperationSaveLineError[]>([]);
  save = output<OperationDraftVm>();
  submit = output<OperationDraftVm>();
  retrySubmit = output<OperationDraftVm>();
  resolveSubmit = output<OperationDraftVm>();
  retryRefresh = output<void>();
  cancel = output<void>();
  delete = output<OperationDraftVm>();
  cancelOperation = output<OperationDraftVm>();
  acceptOperation = output<OperationDraftVm>();
  /** Re-read the operation after a stale_version submit error (§8.2). */
  refresh = output<void>();

  @ViewChild('itemSearch') private itemSearch?: ItemCacheSearchComponent;

  private readonly service = inject(OperationsService);
  private readonly authContextService = inject(AuthContextService);
  private readonly issueObjectsService = inject(IssueObjectsService);
  private readonly diagnostics = inject(DiagnosticsSessionService);
  private readonly diag = inject(DiagnosticsService);
  private readonly draftStorage = inject(DraftStorageService);
  private readonly bff = inject(BffApiService);
  private readonly submitErrorService = inject(SubmitErrorService);
  private readonly catalogSearch = inject(CatalogSearchService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** Submit-error toasts shown after a rejected submit (§8). */
  readonly toasts = signal<string[]>([]);

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
    const errByLine = this.saveLineErrorsByNumber();
    return draftLines.map(l => ({
      ...l,
      error: this.lineAvailableQtyError(l) ?? errByLine.get(l.lineNumber ?? 0) ?? null,
    }));
  });

  /** Structured create/update line errors keyed by line_number. */
  private readonly saveLineErrorsByNumber = computed(() => {
    const map = new Map<number, string>();
    for (const e of this.saveLineErrors()) {
      if (e.line_number == null) continue;
      map.set(e.line_number, this.formatSaveLineError(e));
    }
    return map;
  });

  readonly totalQuantity = computed(() => {
    return this.localDraft().lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
  });

  /** Lines-filter state — lives in the modal so the input is rendered outside
   *  the table component but the filter is still applied to displayed lines. */
  readonly tableNameFilter = signal<string>('');
  readonly showLinesFilter = computed(() => this.lines().length > 3);

  /**
   * Maps local rows to their submit-error display state via the server line id
   * (TZ-FRONTEND §6). Malformed/unknown groups are excluded by the service's
   * `linesByGroup`/`groups` (they are never stored with safe line ids).
   */
  readonly lineSubmitErrors = computed<Record<string, LineSubmitErrorState>>(() => {
    const result: Record<string, LineSubmitErrorState> = {};
    const linesByGroup = this.submitErrorService.linesByGroup();
    const groups = this.submitErrorService.groups();
    for (const line of this.lines()) {
      if (line.serverLineId == null) continue;
      const groupId = linesByGroup.get(line.serverLineId);
      if (!groupId) continue;
      const group = groups[groupId];
      if (!group || group.error.kind !== 'known_line_group') continue;
      result[line.localId] = {
        groupId,
        stale: group.stale,
        text: formatSubmitStockHint(group.error),
      };
    }
    return result;
  });

  /** True when the envelope carries a `stale_version` operation error (§8.2). */
  readonly hasStaleVersion = computed(() => {
    const envelope = this.submitErrorService.envelope();
    return (
      envelope?.errors.some(
        error => error.kind === 'known_operation' && error.code === 'stale_version',
      ) ?? false
    );
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

  /**
   * B1 fix: the balance-refresh trigger is keyed ONLY by (site, canonical item
   * ID set), not by the whole draft object. Because computed() signals notify
   * only when the produced primitive actually changes, applying balance rows
   * (which mutates `availableQuantity`/`categoryId` but not the item-ID set or
   * the site) produces an identical key and therefore does NOT retrigger the
   * effect — eliminating the self-trigger loop (issue #24 B1).
   *
   * Returns null when a targeted read is not applicable (object flow, no site,
   * or no persisted items).
   */
  readonly balanceRefreshKey = computed<string | null>(() => {
    if (this.isObjectSourceFlow() || this.hasPrefilledAssetLine()) return null;
    const siteId = this.relevantSiteId();
    if (!siteId || siteId === 'undefined' || siteId === 'null') return null;
    const itemIds = [...new Set(
      this.localDraft().lines
        .map(l => l.itemId)
        .filter((id): id is string => !!id)
    )].sort();
    if (itemIds.length === 0) return null;
    return `${siteId}::${itemIds.join(',')}`;
  });

  /** Site whose balance rows were last applied; used to invalidate on site change. */
  private balanceAppliedSite: string | null = null;

  /** True while draft lines are being re-validated against the catalog (TZ-V3.2 W1.2). */
  readonly isRefreshing = signal(false);
  /** Structured resolver error from a failed check (502/503/unavailable). */
  readonly refreshError = signal<{ code: string; message: string } | null>(null);

  /**
   * TZ-V3.2 §4.2 / W1.2: true when any line carries a non-active
   * resolvedStatus (merged/inactive/deleted/missing) — blocks Save/Submit
   * until the affected rows are fixed. Delegates to the service helper which
   * owns the status semantics (W1.1 contract).
   */
  readonly hasUnusableLines = computed<boolean>(() =>
    this.service.hasUnusableLines(this.localDraft()),
  );

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

  /** Status badge label — hidden in create mode, shown in edit + view (TZ §10, §7, §8, §9). */
  readonly statusBadgeLabel = computed<string | null>(() => {
    if (!this.isEdit() && !this.isReadonly()) return null;
    const s = this.localDraft().status;
    return OPERATION_STATUS_LABELS[s] ?? null;
  });

  /** Status badge modifier class — drives sb-draft / sb-done / sb-cancel colours. */
  readonly statusBadgeClass = computed<string>(() => {
    const s = this.localDraft().status;
    if (s === 'draft') return 'status-badge status-badge--draft';
    if (s === 'submitted') return 'status-badge status-badge--done';
    if (s === 'cancelled') return 'status-badge status-badge--cancel';
    return 'status-badge';
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

  private formatSaveLineError(e: OperationSaveLineError): string {
    switch (e.reason) {
      case 'item_not_found':
        return 'ТМЦ не найдена в каталоге';
      case 'deleted':
        return 'ТМЦ удалена из каталога';
      case 'inactive':
        return 'ТМЦ деактивирована';
      case 'duplicate_item':
        return e.first_line_number
          ? `Дубликат: ТМЦ уже добавлена в строке ${e.first_line_number}`
          : 'Дубликат ТМЦ';
      case 'unit_unusable':
        return 'Единица измерения недоступна';
      case 'category_unusable':
        return 'Категория недоступна';
      default:
        return e.reason;
    }
  }

  constructor() {
    effect(() => {
      this.submitErrorLocal.set(this.submitError());
    });

    // Submit-error surface: when a rejected-submit payload arrives, parse it
    // into the service and render toasts + inline highlight + scroll/focus
    // (§5.5, §8, §9). When it is cleared (new submit / open / success) reset
    // the whole surface so nothing leaks into the next attempt.
    effect(() => {
      const raw = this.submitErrorPayload();
      if (raw === null || raw === undefined) {
        this.submitErrorService.clearAll();
        this.clearToasts();
        return;
      }
      this.submitErrorService.setFromHttpError(raw);
      this.showSubmitErrorSurface();
    });

    // B3: when structured create/update line errors arrive, scroll/focus the
    // first errored row so the user sees exactly which line is invalid.
    effect(() => {
      const errors = this.saveLineErrors();
      if (!errors || errors.length === 0) return;
      const firstLineNumber = errors.map(e => e.line_number).filter((n): n is number => n != null).sort((a, b) => a - b)[0];
      if (firstLineNumber == null) return;
      const target = this.lines().find(l => l.lineNumber === firstLineNumber);
      if (!target) return;
      setTimeout(() => {
        const qtyInput = document.querySelector<HTMLElement>(
          `[data-qty-for="${target.localId}"]`,
        );
        qtyInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        qtyInput?.focus({ preventScroll: true });
      });
    });

    // TZ Stage 4 WP-1: debounced autosave (2s of inactivity)
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
    effect(() => {
      const draft = this.localDraft();
      if (autosaveTimer !== null) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      if (draft.lines.length === 0) return;
      const draftSnapshot = draft;
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        if (this.draftStorage.save(draftSnapshot)) {
          this.diag.track('draft_autosaved', {
            draft: draftSnapshot,
            itemsCount: draftSnapshot.lines.length,
          });
        }
      }, 2_000);
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
      const key = this.balanceRefreshKey();
      if (!key) {
        this.isBalanceRefreshing.set(false);
        return;
      }
      const sep = key.indexOf('::');
      const siteId = key.slice(0, sep);
      const itemIds = key.slice(sep + 2).split(',');

      const seq = ++this.balanceRefreshSeq;
      this.isBalanceRefreshing.set(true);
      // Site change invalidates every previously-applied balance value (TZ §12).
      if (this.balanceAppliedSite !== siteId) {
        this.resetBalanceState();
      }
      this.markBalanceLoading();
      this.service.loadBalancesForItems(siteId, itemIds).then((rows) => {
        if (seq !== this.balanceRefreshSeq) return;
        if (this.relevantSiteId() === siteId) {
          this.balanceAppliedSite = siteId;
          this.applyTargetedBalanceRows(rows);
        }
        this.isBalanceRefreshing.set(false);
      }).catch(() => {
        if (seq === this.balanceRefreshSeq) {
          this.markBalanceRefreshFailed();
          this.isBalanceRefreshing.set(false);
        }
      });
    });
  }

  ngOnInit(): void {
    // Lifecycle: never carry submit errors from a previous mount (§5.5). The
    // component-level provider gives a fresh instance per mount anyway; this
    // is belt-and-suspenders for component reuse.
    this.submitErrorService.clearAll();
    this.attemptRestore();
  }

  /**
   * TZ Stage 4 WP-1: prompt user to restore a saved draft on modal open.
   * Skipped if the modal is being opened with an explicit draft from the
   * parent (i.e. editing an existing operation).
   */
  private attemptRestore(): void {
    if (this.draft()) return; // parent provided a draft — nothing to restore
    const saved = this.draftStorage.load();
    if (!saved) return;
    const ok = confirm('Найден несохранённый черновик. Восстановить?');
    if (!ok) {
      this.draftStorage.clear();
      return;
    }
    try {
      const parsed = JSON.parse(saved.draft);
      // Reconstruct a minimal OperationDraftVm from the snapshot. Real
      // restoration would need a full draft mapper; for v1 we hydrate
      // the keys we care about (lines, type, idempotencyKey, draftId).
      const restored: OperationDraftVm = {
        type: (parsed.type as OperationType) ?? 'RECEIVE',
        status: 'draft',
        effectiveAt: parsed.effectiveAt ?? currentDateTimeLocal(),
        sourceSiteId: parsed.sourceSiteId ?? null,
        destinationSiteId: parsed.destinationSiteId ?? null,
        personName: parsed.personName ?? null,
        issueObjectId: parsed.issueObjectId ?? null,
        issueObjectName: parsed.issueObjectName ?? null,
        writeOffSource: parsed.writeOffSource ?? null,
        comment: parsed.comment ?? null,
        lines: (parsed.lines ?? []).map((l: any) => ({
          localId: l.localId,
          itemId: l.itemId ?? null,
          quantity: l.quantity ?? null,
          inlineItem: l.inlineItem ?? null,
        })) as OperationLineDraftVm[],
        draftId: saved.draftId,
        idempotencyKey: saved.idempotencyKey,
      };
      this.localDraft.set(restored);
      this.savedOperationId.set(null);
      this.diag.track('draft_restored', {
        draft: { draftId: saved.draftId, idempotencyKey: saved.idempotencyKey },
        itemsCount: saved.itemsCount,
      });
    } catch {
      // Corrupt payload — drop it.
      this.draftStorage.clear();
    }
  }

  /**
   * Apply a successful targeted balance response atomically.
   *
   * Rows present → FRESH with the authoritative qty. Requested IDs missing from
   * the response → FRESH with a confirmed zero (authoritative "no balance
   * row"). Lines whose ID is in the response get category/unit metadata.
   * Lines that were not part of this request stay untouched.
   */
  private applyTargetedBalanceRows(rows: BalanceDto[]): void {
    if (this.isObjectSourceFlow() || this.hasPrefilledAssetLine()) return;
    const balanceMap = new Map<string, BalanceDto>();
    for (const row of rows) {
      balanceMap.set(String(row.item_id), row);
    }
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l => {
        if (!l.itemId) return l;
        const balanceRow = balanceMap.get(String(l.itemId));
        const qty = balanceRow ? parseFloat(balanceRow.qty) : 0;
        return {
          ...l,
          itemName: l.itemName || balanceRow?.item_name || '',
          unitName: l.unitName && l.unitName !== 'шт' ? l.unitName : (balanceRow?.unit_symbol || l.unitName),
          categoryId: balanceRow?.category_id || l.categoryId || null,
          availableQuantity: isNaN(qty) ? 0 : qty,
          sourceSiteQuantity: isNaN(qty) ? 0 : qty,
          balanceState: 'FRESH' as const,
        };
      }),
    }));
  }

  /**
   * Mark balance state ERROR after a failed targeted read (issue #24 B2).
   *
   * Lines that were previously FRESH keep their last confirmed value (stale
   * semantics — the failure must NOT overwrite them with 0). Lines that were
   * NOT_LOADED/LOADING transition to ERROR and never surface a false zero.
   */
  private markBalanceRefreshFailed(): void {
    if (this.isObjectSourceFlow() || this.hasPrefilledAssetLine()) return;
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l => {
        if (!l.itemId) return l;
        if (l.balanceState === 'FRESH') return l;
        return { ...l, balanceState: 'ERROR' as const, availableQuantity: null, sourceSiteQuantity: null };
      }),
    }));
  }

  /** Transition warehouse lines for the given site into LOADING before a targeted read. */
  private markBalanceLoading(): void {
    if (this.isObjectSourceFlow() || this.hasPrefilledAssetLine()) return;
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l => {
        if (!l.itemId) return l;
        if (l.balanceState === 'FRESH') return l;
        return { ...l, balanceState: 'LOADING' as const };
      }),
    }));
  }

  /** On site change: every persisted line returns to NOT_LOADED (no stale value). */
  private resetBalanceState(): void {
    if (this.isObjectSourceFlow() || this.hasPrefilledAssetLine()) return;
    this.localDraft.update(state => ({
      ...state,
      lines: state.lines.map(l =>
        l.itemId
          ? { ...l, balanceState: 'NOT_LOADED' as const, availableQuantity: null, sourceSiteQuantity: null }
          : l
      ),
    }));
  }

  private shouldUseWarehouseBalances(): boolean {
    return !this.isObjectSourceFlow() && !this.hasPrefilledAssetLine();
  }

  /**
   * TZ-OPERATION_MODAL_BALANCES_MANUAL_REFRESH §3.3 (вариант A): ручной
   * рефреш остатков по кнопке «Обновить всё». Один HTTP-запрос обновляет
   * signal balances, затем client-side проход по строкам. balanceRefreshSeq —
   * страховка от гонок с фоновым effect на смену склада.
   */
  async onRefreshAllBalances(): Promise<void> {
    // B3 step 1: ТМЦ-валидация — суперсет «Обновить и проверить».
    await this.validateAndApplyLineStatuses();

    // B3 step 2: складской flow — обновить остатки (targeted by item_ids).
    if (this.shouldUseWarehouseBalances()) {
      const siteId = this.relevantSiteId();
      if (siteId && siteId !== 'undefined' && siteId !== 'null') {
        const itemIds = [...new Set(
          this.localDraft().lines
            .map(l => l.itemId)
            .filter((id): id is string => !!id)
        )];
        if (itemIds.length === 0) {
          this.setToasts(['Нет ТМЦ для обновления остатков']);
          return;
        }
        const seq = ++this.balanceRefreshSeq;
        this.isBalanceRefreshing.set(true);
        this.markBalanceLoading();
        try {
          const rows = await this.service.loadBalancesForItems(siteId, itemIds);
          if (seq === this.balanceRefreshSeq) {
            if (this.relevantSiteId() === siteId) {
              this.balanceAppliedSite = siteId;
              this.applyTargetedBalanceRows(rows);
            }
          }
        } catch {
          if (seq === this.balanceRefreshSeq) {
            this.markBalanceRefreshFailed();
            this.setToasts([`Не удалось обновить остатки: ${this.service.balanceLoadError() ?? 'ошибка'}`]);
          }
        } finally {
          if (seq === this.balanceRefreshSeq) this.isBalanceRefreshing.set(false);
        }
      } else {
        this.setToasts(['Выберите склад, чтобы обновить остатки']);
      }
      return;
    }

    this.setToasts(['Остатки недоступны для объектных операций']);
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
    this.invalidateLineErrors(localId);
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
              // Item identity changed → balance is no longer valid until the
              // targeted refresh (triggered by the item-ID set change) returns.
              availableQuantity: null,
              sourceSiteQuantity: null,
              balanceState: 'NOT_LOADED' as const,
            }
          : l
      ),
    }));
    this.invalidateLineErrors(localId);
  }

  async onNewItemSelected(item: Item): Promise<void> {
    // Selection-time resolve gate: resolve before appending
    const resolved = await this.resolveItemBeforeAppend(item.id);
    if (!resolved) return; // blocked by resolve error or duplicate

    const canonicalId = resolved.canonical_item_id || item.id;
    const canonicalName = resolved.item?.name || item.name;
    const canonicalSku = resolved.item?.sku || item.sku;
    const canonicalUnitId = resolved.item?.unit_id || item.unit_id;
    const canonicalUnitSymbol = resolved.item?.unit_symbol || item.unit_symbol;
    const canonicalCategoryId = resolved.item?.category_id || item.category_id;
    const canonicalCategoryName = resolved.item?.category_name || item.category_name;

    // Duplicate guard: check if canonical ID already exists in lines
    const existingLine = this.localDraft().lines.find(l => String(l.itemId) === String(canonicalId));
    if (existingLine) {
      this.duplicateItemBlocked(existingLine, canonicalName);
      return;
    }

    this.localDraft.update(d => ({
      ...d,
      lines: [
        ...d.lines,
        {
          localId: nextLocalId(),
          itemId: canonicalId,
          itemName: canonicalName,
          categoryName: canonicalCategoryName ?? undefined,
          categoryId: canonicalCategoryId ?? null,
          sku: canonicalSku,
          unitId: canonicalUnitId,
          unitName: canonicalUnitSymbol,
          quantity: null,
          // B2: NOT_LOADED — never a confirmed 0 until a targeted read returns.
          availableQuantity: null,
          sourceSiteQuantity: null,
          balanceState: 'NOT_LOADED' as const,
          isTemporary: false,
          fromBalances: false,
          lineNumber: d.lines.length + 1,
          resolvedStatus: resolved.status as any,
          canonicalItemId: resolved.canonical_item_id,
        },
      ],
    }));
    this.itemSearch?.reset();
  }

  private async resolveItemBeforeAppend(itemId: string): Promise<{ canonical_item_id: string | null; status: string; item: any } | null> {
    try {
      const results = await this.catalogSearch.resolveItems([itemId]).toPromise();
      if (!results || results.length === 0) {
        this.showResolveError('ТМЦ не найдена в каталоге');
        return null;
      }
      const resolved = results[0];
      if (resolved.status === 'deleted') {
        this.showResolveError('ТМЦ удалена из каталога');
        return null;
      }
      if (resolved.status === 'inactive') {
        this.showResolveError('ТМЦ деактивирована');
        return null;
      }
      if (resolved.status === 'missing') {
        this.showResolveError('ТМЦ не найдена в каталоге');
        return null;
      }
      if (resolved.status === 'merged' && !resolved.canonical_item_id) {
        this.showResolveError('ТМЦ объединена, но целевой элемент недоступен');
        return null;
      }
      return resolved as any;
    } catch (err: any) {
      console.error('Item resolve error:', err);
      this.showResolveError('Не удалось проверить ТМЦ. Попробуйте ещё раз.');
      return null;
    }
  }

  private showResolveError(message: string): void {
    this.submitErrorLocal.set(message);
    this.cdr.detectChanges();
  }

  private duplicateItemBlocked(existingLine: OperationLineDraftVm, itemName: string): void {
    const lineNum = existingLine.lineNumber || this.localDraft().lines.indexOf(existingLine) + 1;
    this.submitErrorLocal.set(`ТМЦ «${itemName}» уже добавлена в строке ${lineNum}`);
    this.toasts.set([`ТМЦ «${itemName}» уже добавлена в строке ${lineNum}`]);
    this.cdr.detectChanges();
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
    this.invalidateLineErrors(localId);
  }

  onQuantityChange(localId: string, value: number | null): void {
    this.localDraft.update(d => ({
      ...d,
      lines: d.lines.map(l =>
        l.localId === localId ? { ...l, quantity: value } : l
      ),
    }));
    // §10: editing a significant field invalidates the line's whole error group.
    this.invalidateLineErrors(localId);
  }

  /**
   * Submit-error surface after a rejected submit (§8-§9): toasts, unknown-code
   * logging, scroll/focus to the first errored line.
   */
  private showSubmitErrorSurface(): void {
    const envelope = this.submitErrorService.envelope();
    this.setToasts(buildSubmitToasts(envelope));
    for (const error of collectUnknownSubmitErrors(envelope)) {
      console.error('[submit-error] unknown code', { code: error.code, error });
    }
    this.scrollFocusFirstErroredLine();
  }

  private setToasts(toasts: string[]): void {
    this.toasts.set(toasts);
  }

  private clearToasts(): void {
    this.toasts.set([]);
  }

  /** §9: scroll to and focus the first errored row's qty field, or a fallback button. */
  private scrollFocusFirstErroredLine(): void {
    setTimeout(() => {
      const firstId = this.submitErrorService.firstErroredLineId();
      if (firstId == null) {
        this.focusFallbackButton();
        return;
      }
      const localLine = this.lines().find(l => l.serverLineId === firstId);
      if (!localLine) return;
      const qtyInput = document.querySelector<HTMLElement>(
        `[data-qty-for="${localLine.localId}"]`,
      );
      if (!qtyInput) return;
      qtyInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      qtyInput.focus({ preventScroll: true });
    });
  }

  private focusFallbackButton(): void {
    let button: HTMLElement | null = null;
    if (this.hasStaleVersion()) {
      button = document.querySelector<HTMLElement>('[data-submit-refresh-btn]');
    }
    button ??= document.querySelector<HTMLElement>('[data-submit-close-btn]');
    button?.focus();
  }

  /**
   * §10: mark every error group that contains `localId`'s server line as stale,
   * so the whole group's rows switch to the dashed outline.
   */
  private invalidateLineErrors(localId: string): void {
    const line = this.lines().find(l => l.localId === localId);
    if (!line || line.serverLineId == null) return;
    const groupId = this.submitErrorService.linesByGroup().get(line.serverLineId);
    if (!groupId) return;
    const group = this.submitErrorService.groups()[groupId];
    if (!group || group.error.kind !== 'known_line_group') return;
    this.submitErrorService.invalidateByLineIds(group.error.operation_line_ids);
  }

  onRefreshClick(): void {
    this.refresh.emit();
  }

  /**
   * TZ-V3.2 §5.2 (W1.2): re-validate persisted draft lines against the
   * catalog after a cache refresh. The item-cache-search emits
   * `refreshRequested` when the user clicks «Обновить и проверить»
   * (btn-refresh-check-items); this handler batch-resolves the draft's
   * persisted item IDs and annotates each line with its resolver status via
   * the service. Unusable lines (merged/inactive/deleted/missing) then block
   * Save/Submit through `hasUnusableLines()`.
   */
  async onRefreshCheckItems(): Promise<void> {
    return this.validateAndApplyLineStatuses();
  }

  /**
   * B1/B2: core of draft line re-validation. Batch-resolves persisted lines and
   * annotates each line's resolver status. Never throws — resolver failures
   * are captured in `refreshError` (setToasts in callers), unusable lines are
   * surfaced via `hasUnusableLines`. Used by the manual refresh button and by
   * auto-validation before Save/Submit/RefreshAllBalances.
   */
  async validateAndApplyLineStatuses(): Promise<void> {
    const draft = this.localDraft();
    if (!draft) return;

    this.isRefreshing.set(true);
    this.refreshError.set(null);

    try {
      const resolved = await this.service.validateLinesBeforePersist(draft);
      const updated = this.service.applyResolvedStatuses(draft, resolved);
      this.localDraft.set(updated);
      this.cdr.markForCheck();
    } catch (err: any) {
      // Structured error from the resolver (502/503/unavailable).
      const code = err?.error?.code ?? err?.code ?? 'resolver_unavailable';
      const message = err?.error?.message ?? err?.message ?? 'Не удалось проверить ТМЦ';
      this.refreshError.set({ code, message });
    } finally {
      this.isRefreshing.set(false);
    }
  }

  async onSave(): Promise<void> {
    if (this.saveDisabledReason()) return;

    // B2: auto-validate ТМЦ before saving. Blocks if the resolver is
    // unavailable or the draft carries unusable (deleted/inactive) lines.
    await this.validateAndApplyLineStatuses();
    const refreshErr = this.refreshError();
    if (refreshErr) {
      this.setToasts([`Не удалось проверить ТМЦ: ${refreshErr.message}`]);
      return;
    }
    if (this.hasUnusableLines()) {
      const n = this.countUnusableLines();
      this.setToasts([`Сохранение отменено: ${n} строк содержат удалённые/недоступные ТМЦ`]);
      return;
    }

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

  /**
   * TZ Stage 4 WP-1: confirm before discarding an unsaved draft on
   * any cancel / close path.
   */
  onCancelClick(): void {
    if (this.hasUnsavedChanges() && (this.localDraft().lines?.length ?? 0) > 0) {
      const ok = confirm('У вас есть несохранённые изменения. Закрыть без сохранения?');
      if (!ok) return;
      this.diag.track('draft_lost', {
        draft: this.localDraft(),
        itemsCount: this.localDraft().lines.length,
      });
    }
    this.draftStorage.clear();
    this.cancel.emit();
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
    // Reset the previous submit-error surface before a new attempt (§5.5,
    // §10.3): errors are cleared so the new submit starts clean.
    this.submitErrorService.clearAll();
    this.clearToasts();

    // B2: auto-validate ТМЦ before submitting. Blocks if the resolver is
    // unavailable or the draft carries unusable lines.
    await this.validateAndApplyLineStatuses();
    const refreshErr = this.refreshError();
    if (refreshErr) {
      this.diag.track('validation_failed', {
        draft: this.localDraft(),
        reason: refreshErr.message,
      });
      this.setToasts([`Не удалось проверить ТМЦ: ${refreshErr.message}`]);
      return;
    }
    if (this.hasUnusableLines()) {
      const n = this.countUnusableLines();
      this.diag.track('validation_failed', {
        draft: this.localDraft(),
        reason: 'unusable_lines',
      });
      this.setToasts([`Сохранение отменено: ${n} строк содержат удалённые/недоступные ТМЦ`]);
      return;
    }

    // Diagnostics: submit_clicked
    this.diag.track('submit_clicked', {
      draft: this.localDraft(),
      itemsCount: this.localDraft().lines.length,
    });
    this.bff.setCurrentDraftId(this.localDraft().draftId ?? null);
    try {
      this.submit.emit(this.localDraft());
    } finally {
      this.bff.setCurrentDraftId(null);
    }
  }

  /** B2: count draft lines with an unusable resolvedStatus (non-active/undefined). */
  private countUnusableLines(): number {
    const draft = this.localDraft();
    return draft?.lines?.filter(l =>
      l.resolvedStatus !== undefined && l.resolvedStatus !== 'active'
    ).length ?? 0;
  }

  ngOnDestroy(): void {
    // Diagnostics TZ Stage 3 WP-4: form_closed
    this.diag.track('form_closed', {
      draft: this.localDraft(),
      hasUnsavedChanges: this.hasUnsavedChangesForDiagnostics(),
    });
    this.submitErrorService.clearAll();
    this.clearToasts();
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
