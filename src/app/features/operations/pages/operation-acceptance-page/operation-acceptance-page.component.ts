import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AcceptanceService, PendingAcceptanceLineVm, AcceptLinePayload } from '../../services/acceptance.service';
import { OPERATION_TYPE_LABELS } from '../../../../core/models/operations.models';

interface LineEditVm {
  line: PendingAcceptanceLineVm;
  factQty: string;
  note: string;
  lostQty: string;
  validationError: string | null;
}

@Component({
  selector: 'app-operation-acceptance-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wh-page acceptance-page">
      <!-- Header -->
      <div class="wh-page-header page-header">
        <div class="header-left">
          <a class="wh-link back-link" (click)="goBack()">← Назад к операциям</a>
          <h1 class="page-title">Приёмка</h1>
          <div class="operation-meta">
            <span class="op-number">{{ displayNumber() }}</span>
            <span class="op-type">{{ typeLabel() }}</span>
            @if (directionLabel()) {
              <span class="op-direction">{{ directionLabel() }}</span>
            }
            <span class="wh-badge acceptance-badge {{ acceptanceBadgeClass() }}">{{ acceptanceLabel() }}</span>
          </div>
        </div>
      </div>

      <!-- Error banner -->
      @if (svc.error()) {
        <div class="wh-state wh-state--error error-banner">{{ svc.error() }}</div>
      }

      <!-- Success banner -->
      @if (successMessage()) {
        <div class="wh-state wh-state--success success-banner">
          {{ successMessage() }}
          @if (showLostLink()) {
            <a class="wh-link lost-link" (click)="goToLostAssets()">Перейти к ненайденным ТМЦ</a>
          }
        </div>
      }

      <!-- Loading -->
      @if (svc.isLoading()) {
        <div class="wh-state wh-state--loading loading-overlay">
          <div class="spinner"></div>
          <span>Загрузка данных приёмки...</span>
        </div>
      }

      <!-- Main content -->
      @if (!svc.isLoading() && editLines().length >= 0) {
        <div class="wh-card table-card">
          <!-- Actions -->
          <div class="action-bar">
            <button
              class="wh-btn wh-btn--primary btn btn-primary"
              [disabled]="!canSubmit() || svc.isSubmitting() || isResolved()"
              (click)="onSubmit()"
            >
              @if (svc.isSubmitting()) {
                <span class="spinner-small"></span>
              }
              Принять
            </button>
            <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="goBack()">Назад</button>
            <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="reload()" [disabled]="svc.isLoading()">Обновить</button>
          </div>

          <!-- Table -->
          <div class="table-wrapper">
            <table class="wh-table data-table">
              <thead>
                <tr>
                  <th class="col-num">№</th>
                  <th class="col-item">ТМЦ</th>
                  <th class="col-qty">Отправлено</th>
                  <th class="col-fact">По факту</th>
                  <th class="col-lost">Ненайдено</th>
                  <th class="col-note">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                @for (el of editLines(); track el.line.operation_line_id; let idx = $index) {
                  <tr>
                    <td class="col-num">{{ idx + 1 }}</td>
                    <td class="col-item">
                      <span class="item-name">{{ el.line.display_name || el.line.item_name }}</span>
                      @if (el.line.sku) {
                        <span class="item-sku">{{ el.line.sku }}</span>
                      }
                    </td>
                    <td class="col-qty qty-readonly">{{ el.line.qty }}{{ unitSymbol(el.line) }}</td>
                    <td class="col-fact">
                      @if (!isResolved()) {
                        <input
                          type="number"
                          class="wh-input fact-input"
                          [ngModel]="el.factQty"
                          (ngModelChange)="onFactChange(idx, $event)"
                          step="0.001"
                          min="0"
                          [class.input-error]="!!el.validationError"
                        />
                        @if (el.validationError) {
                          <span class="validation-msg">{{ el.validationError }}</span>
                        }
                      } @else {
                        <span class="qty-readonly">{{ el.factQty }}{{ unitSymbol(el.line) }}</span>
                      }
                    </td>
                    <td class="col-lost">
                      <span class="qty-lost">{{ el.lostQty }}{{ unitSymbol(el.line) }}</span>
                    </td>
                    <td class="col-note">
                      @if (!isResolved()) {
                        <input
                          type="text"
                          class="wh-input note-input"
                          [ngModel]="el.note"
                          (ngModelChange)="onNoteChange(idx, $event)"
                          placeholder="—"
                        />
                      } @else {
                        <span class="note-display">{{ el.note || '—' }}</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty-state">Нет данных для приёмки</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    .acceptance-page {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #F1F5F9;
      overflow: hidden;
      min-height: 0;
    }

    .page-header {
      flex-shrink: 0;
      padding: 12px 20px;
      background: #FFFFFF;
      border-bottom: 1px solid #E2E8F0;
    }
    .header-left { display: flex; flex-direction: column; gap: 4px; }
    .back-link {
      font-size: 13px;
      color: #2563EB;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .back-link:hover { color: #1D4ED8; text-decoration: underline; }
    .page-title {
      font-size: 20px;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }
    .operation-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .op-number {
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }
    .op-type {
      font-size: 13px;
      color: #64748B;
    }
    .op-direction {
      font-size: 13px;
      color: #64748B;
    }

    .wh-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }
    .acceptance-badge--pending { background: #FEF9C3; color: #854D0E; }
    .acceptance-badge--in_progress { background: #DBEAFE; color: #1E40AF; }
    .acceptance-badge--resolved { background: #DCFCE7; color: #166534; }

    .error-banner {
      margin: 12px 20px 0;
      padding: 12px 16px;
      background: #FEF2F2;
      color: #DC2626;
      border: 1px solid #FECACA;
      border-radius: 8px;
      font-size: 14px;
    }
    .success-banner {
      margin: 12px 20px 0;
      padding: 12px 16px;
      background: #F0FDF4;
      color: #166534;
      border: 1px solid #BBF7D0;
      border-radius: 8px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .lost-link {
      color: #2563EB;
      cursor: pointer;
      text-decoration: underline;
    }

    .loading-overlay {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #64748B;
      font-size: 14px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #E2E8F0;
      border-top-color: #3B82F6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .spinner-small {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #FFFFFF;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .table-card {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #FFFFFF;
      margin: 12px 20px;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      min-height: 0;
    }

    .action-bar {
      flex-shrink: 0;
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid #E2E8F0;
      background: #F8FAFC;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      border: 1px solid transparent;
      font-family: inherit;
    }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }

    .table-wrapper {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      color: #1F2937;
      table-layout: fixed;
    }
    .data-table th, .data-table td {
      padding: 8px 10px;
      text-align: left;
      border-bottom: 1px solid #E2E8F0;
      vertical-align: middle;
    }
    .data-table th {
      font-weight: 600;
      color: #475569;
      background: #F8FAFC;
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .col-num { width: 50px; text-align: center; }
    .col-item { min-width: 200px; }
    .col-qty { width: 120px; text-align: right; }
    .col-fact { width: 180px; }
    .col-lost { width: 120px; text-align: right; }
    .col-note { min-width: 180px; }

    .item-name { display: block; font-weight: 500; }
    .item-sku { display: block; font-size: 11px; color: #94A3B8; }

    .qty-readonly {
      font-weight: 600;
      color: #334155;
      font-variant-numeric: tabular-nums;
    }
    .qty-lost {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .qty-lost.positive { color: #DC2626; }
    .qty-lost.zero { color: #94A3B8; }

    .wh-input {
      width: 100%;
      height: 32px;
      padding: 0 8px;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.15s;
    }
    .wh-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .fact-input { text-align: right; font-variant-numeric: tabular-nums; }
    .input-error { border-color: #DC2626; }
    .input-error:focus { border-color: #DC2626; box-shadow: 0 0 0 2px rgba(220,38,38,0.15); }

    .validation-msg {
      display: block;
      font-size: 11px;
      color: #DC2626;
      margin-top: 2px;
    }

    .note-display { color: #64748B; font-size: 13px; }

    .empty-state {
      text-align: center;
      padding: 40px 16px;
      color: #94A3B8;
      font-size: 14px;
    }
  `],
})
export class OperationAcceptancePageComponent implements OnInit {
  readonly svc = inject(AcceptanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly editLines = signal<LineEditVm[]>([]);
  readonly successMessage = signal<string | null>(null);

  readonly displayNumber = computed(() => {
    const op = this.svc.operation();
    return op?.display_number || op?.number || op?.id?.slice(0, 8).toUpperCase() || '';
  });

  readonly typeLabel = computed(() => {
    const op = this.svc.operation();
    if (!op) return '';
    return OPERATION_TYPE_LABELS[op.type] || op.type;
  });

  readonly directionLabel = computed(() => {
    const op = this.svc.operation();
    if (!op) return '';
    switch (op.type) {
      case 'MOVE':
        return `${op.source_site_name || '—'} → ${op.destination_site_name || '—'}`;
      case 'RECEIVE':
        return `→ ${op.site_name || op.destination_site_name || '—'}`;
      default:
        return '';
    }
  });

  readonly isResolved = this.svc.isResolved;

  readonly acceptanceLabel = computed(() => {
    const op = this.svc.operation();
    if (!op?.acceptance_state) return '';
    const labels: Record<string, string> = {
      pending: 'Ожидает приёмки',
      in_progress: 'Частично принята',
      resolved: 'Приёмка завершена',
    };
    return labels[op.acceptance_state] || op.acceptance_state_label || op.acceptance_state;
  });

  readonly acceptanceBadgeClass = computed(() => {
    const op = this.svc.operation();
    const state = op?.acceptance_state || '';
    return `acceptance-badge--${state}`;
  });

  readonly hasValidationError = computed(() =>
    this.editLines().some(el => !!el.validationError)
  );

  readonly canSubmit = computed(() =>
    !this.hasValidationError() && this.editLines().length > 0
  );

  readonly showLostLink = computed(() => {
    if (this.successMessage()) {
      return this.editLines().some(el => {
        const lost = parseFloat(el.lostQty);
        return !isNaN(lost) && lost > 0;
      });
    }
    return false;
  });

  ngOnInit(): void {
    const operationId = this.route.snapshot.paramMap.get('operationId');
    if (!operationId) {
      this.svc.error.set('Не указан идентификатор операции.');
      return;
    }
    void this.loadData(operationId);
  }

  private async loadData(operationId: string): Promise<void> {
    await this.svc.loadOperation(operationId);
    await this.svc.loadPendingAcceptance(operationId);
    this.buildEditLines();
  }

  private buildEditLines(): void {
    const lines = this.svc.lines();
    const editLines: LineEditVm[] = lines.map(line => {
      const qty = parseFloat(line.qty);
      const factQty = isNaN(qty) ? '0' : line.qty;
      const lostQty = '0';
      return {
        line,
        factQty,
        note: '',
        lostQty,
        validationError: null,
      };
    });
    this.editLines.set(editLines);
  }

  onFactChange(index: number, value: string): void {
    const editLines = this.editLines();
    const el = editLines[index];
    if (!el) return;

    const fact = parseFloat(value);
    const sent = parseFloat(el.line.qty);

    if (isNaN(fact) || fact < 0) {
      el.validationError = 'Введите корректное число';
      el.factQty = value;
      el.lostQty = '0';
    } else if (fact > sent) {
      el.validationError = 'По факту не может превышать отправленное';
      el.factQty = value;
      el.lostQty = '0';
    } else {
      el.validationError = null;
      el.factQty = value;
      const lost = Math.max(sent - fact, 0);
      el.lostQty = lost.toFixed(3).replace(/\.?0+$/, '') || '0';
    }

    this.editLines.set([...editLines]);
  }

  onNoteChange(index: number, value: string): void {
    const editLines = this.editLines();
    editLines[index].note = value;
    this.editLines.set([...editLines]);
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;

    const operationId = this.svc.operation()?.id;
    if (!operationId) return;

    const payloads: AcceptLinePayload[] = [];
    for (const el of this.editLines()) {
      const acceptedQty = parseFloat(el.factQty);
      const sent = parseFloat(el.line.qty);
      const lost = Math.max(sent - acceptedQty, 0);

      if (acceptedQty > 0 || lost > 0) {
        payloads.push({
          line_id: el.line.operation_line_id,
          accepted_qty: String(acceptedQty),
          lost_qty: String(lost),
          note: el.note || undefined,
        });
      }
    }

    if (payloads.length === 0) {
      this.svc.error.set('Нет строк для приёмки.');
      return;
    }

    try {
      const result = await this.svc.submitAcceptLines(operationId, payloads);
      this.successMessage.set('Приёмка успешно проведена.');
      this.buildEditLines();

      if (result.operation?.acceptance_state === 'resolved') {
        this.successMessage.set('Приёмка завершена.');
      }
    } catch (err: any) {
      if (err?.status === 409) {
        await this.loadData(operationId);
      }
    }
  }

  async reload(): Promise<void> {
    const operationId = this.svc.operation()?.id;
    if (operationId) {
      this.successMessage.set(null);
      await this.loadData(operationId);
    }
  }

  goBack(): void {
    void this.router.navigate(['/operations']);
  }

  goToLostAssets(): void {
    const operationId = this.svc.operation()?.id;
    if (operationId) {
      void this.router.navigate(['/operations/lost-assets'], {
        queryParams: { operation_id: operationId },
      });
    }
  }

  unitSymbol(line: PendingAcceptanceLineVm): string {
    return line.unit_symbol ? ` ${line.unit_symbol}` : '';
  }
}
