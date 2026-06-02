import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LostAssetsService } from '../../../../core/services/lost-assets.service';
import {
  LostAssetDetailVm,
  LostAssetResolvePayload,
  LOST_ASSET_ACTION_LABELS,
  LOST_ASSET_STATUS_LABELS,
} from '../../../../core/models/assets.models';

@Component({
  selector: 'app-lost-asset-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wh-page lost-asset-detail-page">
      <div class="wh-page-header page-header">
        <div class="header-info">
          <div class="breadcrumbs">
            <button class="wh-link back-link" (click)="goBack()">← Непринятое / Ненайденное</button>
            @if (detail()) {
              <span class="separator">/</span>
              <button class="wh-link back-link" (click)="goToOperation()">
                Операция {{ detail()!.operation_id }}
              </button>
            }
          </div>
          <h1 class="page-title">Непринятый актив</h1>
          @if (detail()) {
            <p class="page-subtitle">{{ detail()!.display_name || detail()!.item_name }}</p>
          }
        </div>
      </div>

      <div class="content-area">
        @if (isLoading()) {
          <div class="wh-state wh-state--loading loading-overlay">
            <div class="spinner"></div>
            <span>Загрузка...</span>
          </div>
        } @else if (error()) {
          <div class="wh-state wh-state--error error-banner">{{ error() }}</div>
        } @else if (detail(); as d) {
          <div class="detail-card">
            <div class="detail-grid">
              <div class="detail-field">
                <span class="detail-label">Товар</span>
                <span class="detail-value">{{ d.display_name || d.item_name }}</span>
              </div>
              @if (d.sku) {
                <div class="detail-field">
                  <span class="detail-label">SKU</span>
                  <span class="detail-value">{{ d.sku }}</span>
                </div>
              }
              <div class="detail-field">
                <span class="detail-label">Потерянное количество</span>
                <span class="detail-value qty-value">{{ d.qty }} {{ d.unit_symbol || '' }}</span>
              </div>
              <div class="detail-field">
                <span class="detail-label">Операция</span>
                <span class="detail-value">
                  <button class="wh-link op-link" (click)="goToOperation()">{{ d.operation_id }}</button>
                </span>
              </div>
              <div class="detail-field">
                <span class="detail-label">Склад назначения</span>
                <span class="detail-value">{{ d.site_name || '—' }}</span>
              </div>
              @if (d.source_site_name) {
                <div class="detail-field">
                  <span class="detail-label">Склад-источник</span>
                  <span class="detail-value">{{ d.source_site_name }}</span>
                </div>
              }
              <div class="detail-field">
                <span class="detail-label">Статус</span>
                <span class="detail-value">
                  <span class="badge status-badge wh-badge" [class]="statusClass(d.status)">
                    {{ statusLabel(d.status) }}
                  </span>
                </span>
              </div>
              @if (d.created_at) {
                <div class="detail-field">
                  <span class="detail-label">Дата создания</span>
                  <span class="detail-value">{{ d.created_at | date:'dd.MM.yyyy HH:mm' }}</span>
                </div>
              }
              @if (d.updated_at) {
                <div class="detail-field">
                  <span class="detail-label">Дата обновления</span>
                  <span class="detail-value">{{ d.updated_at | date:'dd.MM.yyyy HH:mm' }}</span>
                </div>
              }
            </div>
          </div>

          @if (successMessage()) {
            <div class="wh-state wh-state--success success-banner">{{ successMessage() }}</div>
          }

          @if (d.status !== 'resolved') {
            <div class="resolve-panel">
              <h3 class="resolve-title">Подтвердить решение</h3>
              <p class="resolve-subtitle">Выберите, что сделать с непринятым количеством по этой конкретной строке операции.</p>

              <div class="resolve-form">
                <div class="form-group">
                  <label class="form-label">Действие</label>
                  <div class="action-buttons">
                    <button
                      type="button"
                      class="action-choice action-choice--danger"
                      [class.action-choice--active]="resolveForm().action === 'write_off'"
                      (click)="onActionChange('write_off')"
                    >
                      Списать окончательно
                    </button>
                    @if (d.source_site_name || d.source_site_id) {
                      <button
                        type="button"
                        class="action-choice"
                        [class.action-choice--active]="resolveForm().action === 'return_to_source'"
                        (click)="onActionChange('return_to_source')"
                      >
                        Вернуть отправителю
                      </button>
                    }
                    <button
                      type="button"
                      class="action-choice action-choice--success"
                      [class.action-choice--active]="resolveForm().action === 'found_to_destination'"
                      (click)="onActionChange('found_to_destination')"
                    >
                      Зачислить на склад
                    </button>
                  </div>
                </div>

                <div class="resolve-grid">
                  <div class="form-group">
                    <label class="form-label" for="resolve-qty">Количество</label>
                    <input
                      id="resolve-qty"
                      class="wh-input qty-input"
                      type="number"
                      step="0.001"
                      min="0.001"
                      [max]="maxQty()"
                      [ngModel]="resolveForm().qty"
                      (ngModelChange)="onQtyChange($event)"
                    />
                    <span class="qty-hint">макс. {{ d.qty }} {{ d.unit_symbol || '' }}</span>
                  </div>

                  <div class="form-group form-group--note">
                    <label class="form-label" for="resolve-note">Примечание</label>
                    <textarea
                      id="resolve-note"
                      class="wh-input note-textarea"
                      rows="3"
                      placeholder="Необязательно"
                      [ngModel]="resolveForm().note"
                      (ngModelChange)="onNoteChange($event)"
                    ></textarea>
                  </div>
                </div>

                @if (resolveError()) {
                  <div class="wh-state wh-state--error resolve-error">{{ resolveError() }}</div>
                }

                <div class="form-actions">
                  <button
                    class="wh-btn wh-btn--primary btn btn-primary"
                    [disabled]="isResolving() || !isFormValid()"
                    (click)="onResolve()"
                  >
                    @if (isResolving()) {
                      <span class="spinner-inline"></span>
                    }
                    Подтвердить
                  </button>
                </div>
              </div>
            </div>
          } @else {
            <div class="resolved-panel">
              <h3 class="resolved-title">Решение подтверждено</h3>
              @if (d.resolution_action) {
                <p class="resolved-note"><strong>Действие:</strong> {{ actionLabel(d.resolution_action) }}</p>
              }
              @if (d.note) {
                <p class="resolved-note"><strong>Примечание:</strong> {{ d.note }}</p>
              } @else if (d.resolution_note) {
                <p class="resolved-note"><strong>Примечание:</strong> {{ d.resolution_note }}</p>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: auto; }
    .lost-asset-detail-page { display: flex; flex-direction: column; min-height: 100%; background: #F1F5F9; }
    .page-header { flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; }
    .header-info { min-width: 0; }
    .breadcrumbs { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 12px; }
    .back-link { background: none; border: none; padding: 0; font: inherit; color: #2563EB; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; font-size: 12px; }
    .back-link:hover { color: #1D4ED8; }
    .separator { color: #94A3B8; }
    .page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0; }
    .page-subtitle { font-size: 13px; color: #64748B; margin: 4px 0 0; }
    .content-area { flex: 1; padding: 16px 20px; }
    .detail-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .detail-field { display: flex; flex-direction: column; gap: 2px; }
    .detail-label { font-size: 12px; font-weight: 500; color: #64748B; }
    .detail-value { font-size: 14px; color: #1F2937; }
    .qty-value { font-weight: 600; }
    .op-link { background: none; border: none; padding: 0; font: inherit; color: #2563EB; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
    .op-link:hover { color: #1D4ED8; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; line-height: 1.4; }
    .status-badge.wh-badge--open { background: #FEF9C3; color: #854D0E; }
    .status-badge.wh-badge--resolved { background: #DCFCE7; color: #166534; }
    .status-badge.wh-badge--unknown { background: #F3F4F6; color: #6B7280; }
    .loading-overlay { display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 40px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-banner { padding: 12px 16px; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
    .success-banner { padding: 12px 16px; background: #F0FDF4; color: #166534; border: 1px solid #BBF7D0; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
    .resolve-panel { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; }
    .resolve-title { font-size: 16px; font-weight: 600; color: #0F172A; margin: 0; }
    .resolve-subtitle { margin: 4px 0 14px; color: #64748B; font-size: 13px; }
    .resolve-form { display: flex; flex-direction: column; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-label { font-size: 13px; font-weight: 500; color: #475569; }
    .action-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .action-choice { height: 36px; padding: 0 14px; border: 1px solid #D1D5DB; border-radius: 8px; background: #FFFFFF; color: #334155; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .action-choice:hover { background: #F8FAFC; border-color: #94A3B8; }
    .action-choice--active { background: #334155; border-color: #334155; color: #FFFFFF; }
    .action-choice--active:hover { background: #1E293B; border-color: #1E293B; }
    .action-choice--danger.action-choice--active { background: #DC2626; border-color: #DC2626; }
    .action-choice--success.action-choice--active { background: #059669; border-color: #059669; }
    .resolve-grid { display: grid; grid-template-columns: minmax(160px, 220px) 1fr; gap: 12px; align-items: start; }
    .form-group--note { min-width: 0; }
    .wh-input { height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; font-family: inherit; background: #FFFFFF; }
    .qty-input { width: 140px; }
    .qty-hint { font-size: 12px; color: #64748B; }
    .note-textarea { height: auto; min-height: 72px; padding: 8px 10px; resize: vertical; }
    .resolve-error { padding: 8px 12px; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; border-radius: 6px; font-size: 13px; }
    .form-actions { display: flex; gap: 8px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 18px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .spinner-inline { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #FFFFFF; border-radius: 50%; animation: spin 0.6s linear infinite; }
    .resolved-panel { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; }
    .resolved-title { font-size: 16px; font-weight: 600; color: #166534; margin: 0 0 8px; }
    .resolved-note { font-size: 14px; color: #475569; margin: 0; }
  `]
})
export class LostAssetDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly service = inject(LostAssetsService);

  readonly detail = this.service.detail;
  readonly isLoading = this.service.isLoading;
  readonly error = this.service.error;
  readonly isResolving = this.service.isResolving;

  readonly successMessage = signal<string | null>(null);
  readonly resolveError = signal<string | null>(null);

  readonly resolveForm = signal<{
    action: 'found_to_destination' | 'return_to_source' | 'write_off';
    qty: string;
    note: string;
  }>({
    action: 'found_to_destination',
    qty: '',
    note: '',
  });

  readonly maxQty = signal<number>(0);

  ngOnInit(): void {
    const operationLineId = this.route.snapshot.paramMap.get('operationLineId');
    if (operationLineId) {
      void this.loadDetail(operationLineId);
    }
  }

  private async loadDetail(operationLineId: string): Promise<void> {
    this.successMessage.set(null);
    this.resolveError.set(null);
    const data = await this.service.getLostAsset(operationLineId);
    if (data) {
      const qty = parseFloat(data.qty);
      this.maxQty.set(isNaN(qty) ? 0 : qty);
      this.resolveForm.set({
        action: 'found_to_destination',
        qty: data.qty,
        note: '',
      });
    }
  }

  onActionChange(action: 'found_to_destination' | 'return_to_source' | 'write_off'): void {
    this.resolveForm.update(f => ({ ...f, action }));
  }

  onQtyChange(value: string): void {
    this.resolveForm.update(f => ({ ...f, qty: value }));
  }

  onNoteChange(value: string): void {
    this.resolveForm.update(f => ({ ...f, note: value }));
  }

  isFormValid(): boolean {
    const form = this.resolveForm();
    const qty = parseFloat(form.qty);
    return qty > 0 && qty <= this.maxQty();
  }

  async onResolve(): Promise<void> {
    this.resolveError.set(null);
    const form = this.resolveForm();
    const d = this.detail();
    if (!d) return;

    const payload: LostAssetResolvePayload = {
      action: form.action,
      qty: form.qty,
      note: form.note || undefined,
    };

    try {
      await this.service.resolveLostAsset(d.operation_line_id, payload);
      this.successMessage.set('Решение успешно подтверждено.');
    } catch {
      this.resolveError.set(this.service.error() || 'Не удалось подтвердить решение.');
    }
  }

  goBack(): void {
    this.router.navigate(['/operations/lost-assets']);
  }

  goToOperation(): void {
    const d = this.detail();
    if (d) {
      this.router.navigate(['/operations', d.operation_id]);
    }
  }

  statusLabel(status: string | undefined): string {
    if (!status) return 'Открыт';
    return LOST_ASSET_STATUS_LABELS[status] || status;
  }

  statusClass(status: string | undefined): string {
    if (!status) return 'wh-badge--open';
    return `wh-badge--${status}`;
  }

  actionLabel(action: string): string {
    return LOST_ASSET_ACTION_LABELS[action] || action;
  }
}
