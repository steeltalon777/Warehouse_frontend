import { Component, input } from '@angular/core';

@Component({
  selector: 'app-temp-items-info-card',
  standalone: true,
  template: `
    <div class="info-card wh-card">
      <div class="info-text">
        <p class="info-description">
          Временные позиции создаются для срочной приёмки, когда справочник ещё не заполнен.
          Их нужно преобразовать в постоянные ТМЦ или слить с существующими.
        </p>
      </div>
      <div class="info-stats">
        <div class="stat">
          <span class="stat-value total">{{ totalActive() }}</span>
          <span class="stat-label">Временные ТМЦ</span>
        </div>
        <div class="stat">
          <span class="stat-value warning">{{ needsReviewCount() }}</span>
          <span class="stat-label">Требуют разбора</span>
        </div>
        <div class="stat">
          <span class="stat-value accent">{{ inPendingCount() }}</span>
          <span class="stat-label">В приёмке</span>
        </div>
        <div class="stat">
          <span class="stat-value success">{{ canDeleteCount() }}</span>
          <span class="stat-label">Можно удалить</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .info-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 10px;
      margin-bottom: 12px;
    }
    .info-text { flex: 1; }
    .info-description {
      margin: 0;
      font-size: 13px;
      color: #92400E;
      line-height: 1.4;
    }
    .info-stats {
      display: flex;
      gap: 16px;
      flex-shrink: 0;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 60px;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
    }
    .stat-value.total { color: #1E293B; }
    .stat-value.warning { color: #D97706; }
    .stat-value.accent { color: #7C3AED; }
    .stat-value.success { color: #059669; }
    .stat-label {
      font-size: 11px;
      color: #64748B;
      text-align: center;
      white-space: nowrap;
    }
  `]
})
export class TempItemsInfoCardComponent {
  readonly totalActive = input.required<number>();
  readonly needsReviewCount = input.required<number>();
  readonly inPendingCount = input.required<number>();
  readonly canDeleteCount = input.required<number>();
}
