import { Component, input, output, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IssuedAssetRow } from '../../../../core/models/assets.models';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';

@Component({
  selector: 'app-assigned-assets-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="assets-table-shell" data-testid="issued-assets-table">
      @if (service.objectAssetsLoading()) {
        <div class="wh-state wh-state--loading loading-state">
          <div class="spinner"></div>
          <span>Загрузка имущества...</span>
        </div>
      } @else if (service.error(); as err) {
        <div class="wh-state wh-state--error error-state">{{ err }}</div>
      } @else {
        <table class="wh-table data-table assets-table-head" aria-hidden="true">
          <thead>
            <tr>
              <th class="col-num">№</th>
              <th class="col-name">Наименование ТМЦ</th>
              <th class="col-sku">Артикул</th>
              <th class="col-qty">Количество</th>
              <th class="col-date">Обновлено</th>
              <th class="col-actions">Действия</th>
            </tr>
          </thead>
        </table>

        <div class="assets-table-wrapper" [attr.data-testid]="wrapperTestId">
          @if (rows().length > 0) {
            <table class="wh-table data-table assets-table-body" aria-label="Назначенное имущество">
              <thead class="sr-only">
                <tr>
                  <th class="col-num">№</th>
                  <th class="col-name">Наименование ТМЦ</th>
                  <th class="col-sku">Артикул</th>
                  <th class="col-qty">Количество</th>
                  <th class="col-date">Обновлено</th>
                  <th class="col-actions">Действия</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.inventory_subject_id; let i = $index) {
                  <tr data-testid="issued-asset-row">
                    <td class="col-num">{{ i + 1 }}</td>
                    <td class="col-name" [title]="row.display_name || row.resolved_item_name || row.item_name || '—'">
                      {{ row.display_name || row.resolved_item_name || row.item_name || '—' }}
                    </td>
                    <td class="col-sku">{{ row.sku || '—' }}</td>
                    <td class="col-qty">{{ row.qty }}</td>
                    <td class="col-date">{{ row.updated_at | date:'dd.MM.yyyy HH:mm' }}</td>
                    <td class="col-actions">
                      <button type="button" class="wh-btn wh-btn--secondary btn btn-action" data-testid="issued-asset-return-button" (click)="return.emit(row)">Возврат</button>
                      <button type="button" class="wh-btn wh-btn--secondary btn btn-action btn-action--danger" data-testid="issued-asset-writeoff-button" (click)="writeOff.emit(row)">Списание</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="empty-state" data-testid="issued-assets-empty-state">За объектом сейчас не числится имущество.</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .assets-table-shell { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
    .assets-table-wrapper { position: relative; display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: auto; }

    .data-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; color: #1F2937; table-layout: fixed; }
    .data-table th, .data-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #E2E8F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .assets-table-head { flex: 0 0 auto; }
    .assets-table-body { min-width: 100%; }
    .data-table th { font-weight: 600; color: #475569; background: #F8FAFC; user-select: none; font-size: 12px; }
    .data-table tbody tr { transition: background 0.1s; }
    .data-table tbody tr:hover { background: #F8FAFC; }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .col-num { width: 44px; text-align: center; }
    .col-name { width: auto; }
    .col-sku { width: 110px; }
    .col-qty { width: 90px; text-align: center; }
    .col-date { width: 130px; }
    .col-actions { width: 200px; }

    .empty-state { display: flex; align-items: center; justify-content: center; flex: 1 1 auto; min-height: 120px; text-align: center; padding: 30px 16px; color: #94A3B8; font-size: 13px; }
    .loading-state, .error-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 30px; }
    .spinner { width: 22px; height: 22px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; white-space: nowrap; border: 1px solid transparent; font-family: inherit; margin-right: 4px; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-action { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-action:hover:not(:disabled) { background: #F1F5F9; }
    .btn-action--danger { color: #B91C1C; border-color: #FECACA; }
    .btn-action--danger:hover:not(:disabled) { background: #FEE2E2; }
  `]
})
export class AssignedAssetsTableComponent implements OnInit, OnDestroy {
  readonly objectId = input.required<string>();
  readonly variant = input<'embedded' | 'expanded'>('embedded');

  readonly return = output<IssuedAssetRow>();
  readonly writeOff = output<IssuedAssetRow>();

  readonly service = inject(IssueObjectsService);

  private loadedId: string | null = null;

  readonly rows = this.service.objectAssets;

  protected get wrapperTestId(): string {
    return this.variant() === 'expanded'
      ? 'issued-assets-expanded-table-wrap'
      : 'issued-assets-table-wrap';
  }

  constructor() {
    effect(() => {
      const id = this.objectId();
      if (id && id !== this.loadedId) {
        this.loadedId = id;
        void this.service.loadObjectAssets(id);
      } else if (!id) {
        this.loadedId = null;
      }
    });
  }

  ngOnInit(): void {
    const id = this.objectId();
    if (id && id !== this.loadedId) {
      this.loadedId = id;
      void this.service.loadObjectAssets(id);
    }
  }

  ngOnDestroy(): void {
    this.loadedId = null;
  }
}
