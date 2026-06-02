import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { IssueObject, IssueObjectType, ISSUE_OBJECT_TYPE_LABELS } from '../../../../core/models/issue-objects.models';
import { IssuedAssetRow } from '../../../../core/models/assets.models';

@Component({
  selector: 'app-object-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="detail-page">
      <div class="detail-header">
        <button class="wh-btn wh-btn--secondary btn btn-back" (click)="onBack()">← Назад к списку</button>
        <div class="header-actions">
          <button class="wh-btn wh-btn--primary btn btn-primary" [disabled]="!object()" (click)="onEdit()">Редактировать</button>
        </div>
      </div>

      @if (loading()) {
        <div class="wh-state wh-state--loading loading-state">
          <div class="spinner"></div>
          <span>Загрузка...</span>
        </div>
      } @else if (service.error(); as err) {
        <div class="wh-state wh-state--error error-state">{{ err }}</div>
      } @else if (object(); as obj) {
        <div class="detail-content">
          <div class="wh-card info-card">
            <h2 class="card-title">{{ obj.display_name }}</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Тип</span>
                <span class="info-value">{{ objectTypeLabel(obj.object_type) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Код</span>
                <span class="info-value">{{ obj.code || '—' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Ключ</span>
                <span class="info-value">{{ obj.normalized_key }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Статус</span>
                <span class="info-value">
                  <span class="status-badge" [class.active]="obj.is_active" [class.inactive]="!obj.is_active">
                    {{ obj.is_active ? 'Активен' : 'Неактивен' }}
                  </span>
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Создан</span>
                <span class="info-value">{{ obj.created_at | date:'dd.MM.yyyy HH:mm' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Обновлён</span>
                <span class="info-value">{{ obj.updated_at | date:'dd.MM.yyyy HH:mm' }}</span>
              </div>
            </div>
          </div>

          <div class="wh-card assets-card">
            <h3 class="card-title">Выданное имущество</h3>
            @if (assetsLoading()) {
              <div class="wh-state wh-state--loading loading-state">
                <div class="spinner"></div>
                <span>Загрузка...</span>
              </div>
            } @else {
              <table class="wh-table data-table">
                <thead>
                  <tr>
                    <th class="col-num">№</th>
                    <th class="col-name">Наименование ТМЦ</th>
                    <th class="col-sku">Артикул</th>
                    <th class="col-qty">Количество</th>
                    <th class="col-date">Дата обновления</th>
                  </tr>
                </thead>
                <tbody>
                  @for (asset of service.objectAssets(); track asset.inventory_subject_id; let i = $index) {
                    <tr>
                      <td class="col-num">{{ i + 1 }}</td>
                      <td class="col-name">{{ asset.display_name || asset.resolved_item_name || asset.item_name || '—' }}</td>
                      <td class="col-sku">{{ asset.sku || '—' }}</td>
                      <td class="col-qty">{{ asset.qty }}</td>
                      <td class="col-date">{{ asset.updated_at | date:'dd.MM.yyyy HH:mm' }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="empty-state">Имущество не найдено</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow-y: auto; }
    .detail-page { padding: 16px 20px; }

    .detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-back { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-back:hover:not(:disabled) { background: #F8FAFC; }

    .detail-content { display: flex; flex-direction: column; gap: 16px; }

    .wh-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; }
    .card-title { margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #0F172A; }
    .assets-card .card-title { font-size: 15px; font-weight: 600; color: #374151; }

    .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 11px; font-weight: 500; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 14px; font-weight: 500; color: #1F2937; }

    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }
    .status-badge.active { background: #DCFCE7; color: #166534; }
    .status-badge.inactive { background: #FEE2E2; color: #991B1B; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; color: #1F2937; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #E2E8F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .data-table th { font-weight: 600; color: #475569; background: #F8FAFC; font-size: 12px; }
    .col-num { width: 50px; text-align: center; }
    .col-name { width: auto; }
    .col-sku { width: 120px; }
    .col-qty { width: 100px; text-align: center; }
    .col-date { width: 140px; }

    .loading-state, .error-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 40px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 20px; color: #94A3B8; font-size: 13px; }
  `]
})
export class ObjectDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly service = inject(IssueObjectsService);

  readonly loading = signal<boolean>(true);
  readonly assetsLoading = this.service.objectAssetsLoading;

  readonly object = this.service.selectedObject;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadObject(id);
    }
  }

  async loadObject(id: string): Promise<void> {
    this.loading.set(true);
    await this.service.getObject(id);
    this.loading.set(false);
    if (id) {
      this.service.loadObjectAssets(id);
    }
  }

  onBack(): void {
    this.router.navigate(['/issued-assets/objects']);
  }

  onEdit(): void {
    const obj = this.object();
    if (obj) {
      this.router.navigate(['/issued-assets/objects', obj.id, 'edit']);
    }
  }

  objectTypeLabel(type: string): string {
    return ISSUE_OBJECT_TYPE_LABELS[type as IssueObjectType] || type;
  }
}
