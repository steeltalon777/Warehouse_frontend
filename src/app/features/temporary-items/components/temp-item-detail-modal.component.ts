import { Component, input, output, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { TemporaryItemVm, TempItemDetail, TempItemBalancePerSite, TempItemOperation, TEMP_ITEM_UI_STATUS_COLORS } from '../../../core/models/temp-items.models';

@Component({
  selector: 'app-temp-item-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">ТМЦ на проверке: {{ item().name }}</h2>
          <button class="modal-close" (click)="close.emit()" aria-label="Закрыть">&times;</button>
        </div>

        <div class="modal-body">
          @if (isLoading()) {
            <div class="loading">Загрузка...</div>
          } @else {
            <!-- Metadata section -->
            <div class="section metadata-section">
              <div class="meta-grid">
                <div class="meta-item">
                  <span class="meta-label">Статус</span>
                  <span class="status-badge wh-badge" [class]="'wh-badge--' + (TEMP_ITEM_UI_STATUS_COLORS[item().uiStatus] || 'neutral')">
                    {{ item().uiStatusLabel }}
                  </span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Создана</span>
                  <span class="meta-value">{{ item().createdAt }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Создано токеном</span>
                  <span class="meta-value">{{ detail()?.created_by_user_id || item().createdByUserId }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Категория</span>
                  <span class="meta-value">{{ detail()?.category_name || item().categoryName || '—' }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Единица измерения</span>
                  <span class="meta-value">{{ detail()?.unit_symbol || item().unitSymbol || '—' }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Остаток</span>
                  <span class="meta-value balance">{{ item().totalBalance }} {{ item().unitSymbol }}</span>
                </div>
              </div>
            </div>

            <!-- Balances per site -->
            <div class="section">
              <h3 class="section-title">Остатки по складам</h3>
              @if ((balances() || []).length === 0) {
                <p class="empty-text">Нет данных об остатках по складам</p>
              } @else {
                <div class="balances-list">
                  @for (b of balances(); track b.site_id) {
                    <div class="balance-row">
                      <span class="site-name">{{ b.site_name }}</span>
                      <span class="site-balance">{{ b.balance }} {{ item().unitSymbol }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Operations list -->
            <div class="section">
              <h3 class="section-title">Операции</h3>
              @if ((operations() || []).length === 0) {
                <p class="empty-text">Нет связанных операций</p>
              } @else {
                <div class="operations-list">
                  @for (op of operations(); track op.id) {
                    <div class="operation-row">
                      <span class="op-id">{{ op.id }}</span>
                      <span class="op-type">{{ op.operation_type_label || op.operation_type }}</span>
                      <span class="op-status">{{ op.status_label || op.status }}</span>
                      <span class="op-qty">{{ op.quantity }} {{ item().unitSymbol }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Warning for pending acceptance -->
            @if (item().hasPendingAcceptance) {
              <div class="warning-banner">
                <span class="warning-icon">⚠</span>
                <span>Эта временная ТМЦ участвует в незавершённой приёмке. Преобразование, слияние и удаление заблокированы до завершения приёмки.</span>
              </div>
            }

            <!-- Action buttons -->
            <div class="section actions-section">
              <h3 class="section-title">Действия</h3>
              <div class="action-buttons">
                <!-- Convert -->
                <button class="action-btn" [disabled]="!item().canConvert" [title]="item().convertBlockedReason || ''" (click)="convert.emit(item())">
                  Преобразовать в постоянную
                  @if (!item().canConvert && item().convertBlockedReason) {
                    <span class="btn-hint">{{ item().convertBlockedReason }}</span>
                  }
                </button>

                <!-- Merge with permanent -->
                <button class="action-btn" [disabled]="!item().canMergeToPermanent" [title]="item().mergeBlockedReason || ''" (click)="mergePermanent.emit(item())">
                  Слить с постоянной ТМЦ
                  @if (!item().canMergeToPermanent && item().mergeBlockedReason) {
                    <span class="btn-hint">{{ item().mergeBlockedReason }}</span>
                  }
                </button>

                <!-- Confirm - active for items needing review -->
                <button class="action-btn action-btn--confirm"
                  [disabled]="!item().canConvert && item().uiStatus !== 'needs_review'"
                  [title]="item().canConvert ? '' : 'Подтвердить ТМЦ, созданную через операцию'"
                  (click)="confirm.emit(item())">
                  ✓ Подтвердить
                </button>

                <!-- Delete -->
                <button class="action-btn action-btn--danger" [disabled]="!item().canDelete" [title]="item().deleteBlockedReason || ''" (click)="deleteItem.emit(item())">
                  Удалить
                  @if (!item().canDelete && item().deleteBlockedReason) {
                    <span class="btn-hint">{{ item().deleteBlockedReason }}</span>
                  }
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-container { background: #FFFFFF; border-radius: 12px; width: 640px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #E2E8F0; flex-shrink: 0; }
    .modal-title { margin: 0; font-size: 16px; font-weight: 600; color: #0F172A; }
    .modal-close { background: none; border: none; font-size: 24px; color: #94A3B8; cursor: pointer; padding: 0; line-height: 1; }
    .modal-close:hover { color: #475569; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 600; color: #1E293B; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #F1F5F9; }
    .loading { text-align: center; padding: 40px; color: #94A3B8; font-size: 14px; }
    .empty-text { color: #94A3B8; font-size: 13px; padding: 8px 0; }

    /* Metadata grid */
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-value { font-size: 13px; color: #1E293B; font-weight: 500; }
    .meta-value.balance { font-weight: 700; color: #0F172A; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; line-height: 1.4; width: fit-content; }

    /* Balances */
    .balances-list { display: flex; flex-direction: column; gap: 6px; }
    .balance-row { display: flex; justify-content: space-between; padding: 6px 10px; background: #F8FAFC; border-radius: 6px; font-size: 13px; }
    .site-name { color: #475569; }
    .site-balance { font-weight: 600; color: #1E293B; }

    /* Operations */
    .operations-list { display: flex; flex-direction: column; gap: 4px; }
    .operation-row { display: flex; gap: 10px; padding: 6px 10px; background: #F8FAFC; border-radius: 6px; font-size: 12px; align-items: center; }
    .op-id { font-family: monospace; color: #64748B; min-width: 120px; }
    .op-type { color: #1E293B; font-weight: 500; min-width: 80px; }
    .op-status { color: #64748B; min-width: 100px; }
    .op-qty { margin-left: auto; font-weight: 600; color: #1E293B; }

    /* Warning */
    .warning-banner { display: flex; align-items: flex-start; gap: 8px; padding: 10px 14px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; font-size: 13px; color: #92400E; margin-bottom: 16px; }
    .warning-icon { flex-shrink: 0; font-size: 16px; }

    /* Action buttons */
    .action-buttons { display: flex; flex-direction: column; gap: 8px; }
    .action-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 14px; border: 1px solid #E2E8F0; border-radius: 8px; background: #FFFFFF; font-size: 13px; font-weight: 500; color: #1E293B; cursor: pointer; transition: all 0.15s; text-align: left; width: 100%; font-family: inherit; }
    .action-btn:hover:not(:disabled) { background: #F8FAFC; border-color: #CBD5E1; }
    .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .action-btn--danger { color: #DC2626; border-color: #FECACA; }
    .action-btn--danger:hover:not(:disabled) { background: #FEF2F2; border-color: #FECACA; }
    .btn-hint { font-size: 11px; font-weight: 400; color: #94A3B8; }
    .action-btn--danger .btn-hint { color: #FCA5A5; }
    .action-btn--confirm { color: #16A34A; border-color: #BBF7D0; }
    .action-btn--confirm:hover:not(:disabled) { background: #F0FDF4; border-color: #86EFAC; }
  `]
})
export class TempItemDetailModalComponent implements OnInit {
  private readonly service = inject(TempItemsService);

  readonly item = input.required<TemporaryItemVm>();
  readonly role = input<string>('storekeeper');
  readonly close = output<void>();
  readonly convert = output<TemporaryItemVm>();
  readonly mergePermanent = output<TemporaryItemVm>();
  readonly mergeTemp = output<TemporaryItemVm>();
  readonly confirm = output<TemporaryItemVm>();
  readonly deleteItem = output<TemporaryItemVm>();

  readonly TEMP_ITEM_UI_STATUS_COLORS = TEMP_ITEM_UI_STATUS_COLORS;

  readonly detail = signal<TempItemDetail | null>(null);
  readonly balances = signal<TempItemBalancePerSite[]>([]);
  readonly operations = signal<TempItemOperation[]>([]);
  readonly isLoading = signal(true);

  async ngOnInit(): Promise<void> {
    const detail = await this.service.loadDetail(this.item().id);
    this.detail.set(detail);
    if (detail?.balances_per_site) {
      this.balances.set(detail.balances_per_site);
    }
    const ops = await this.service.loadOperations(this.item().id);
    this.operations.set(ops);
    this.isLoading.set(false);
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
