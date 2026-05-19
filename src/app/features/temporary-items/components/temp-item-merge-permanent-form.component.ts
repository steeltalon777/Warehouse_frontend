import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TempItemsService } from '../../../core/services/temp-items.service';
import { BffApiService } from '../../../core/api/bff-api.service';
import { TemporaryItemVm } from '../../../core/models/temp-items.models';

interface CatalogItem {
  id: string;
  name: string;
  sku?: string;
  category_name?: string;
  unit_symbol?: string;
  total_balance?: number;
}

@Component({
  selector: 'app-temp-item-merge-permanent-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Слить с постоянной ТМЦ</h2>
          <button class="modal-close" (click)="cancel.emit()">&times;</button>
        </div>

        <div class="modal-body">
          @if (isSubmitting()) {
            <div class="loading">Слияние...</div>
          } @else if (error()) {
            <div class="error-banner">{{ error() }}</div>
          } @else {
            <div class="source-info">
              <span class="source-label">Исходная:</span>
              <span class="source-name">{{ item().name }}</span>
              <span class="source-balance">{{ item().totalBalance }} {{ item().unitSymbol }}</span>
            </div>

            <div class="form-group">
              <label class="form-label">Поиск постоянной ТМЦ</label>
              <input class="form-input" type="text" [(ngModel)]="searchQuery" (ngModelChange)="onSearchChange($event)" placeholder="Минимум 2 символа..." />
            </div>

            @if (searchResults().length > 0) {
              <div class="search-results">
                @for (result of searchResults(); track result.id) {
                  <div class="search-item" [class.selected]="selectedTarget()?.id === result.id" (click)="selectTarget(result)">
                    <div class="item-name">{{ result.name }}</div>
                    <div class="item-detail">SKU: {{ result.sku || '—' }} · {{ result.category_name || '—' }} · {{ result.unit_symbol || '—' }}</div>
                  </div>
                }
              </div>
            }

            @if (selectedTarget(); as target) {
              <div class="preview-box">
                <h4 class="preview-title">Выбранная постоянная:</h4>
                <p><strong>{{ target.name }}</strong></p>
                <p>SKU: {{ target.sku || '—' }} · Категория: {{ target.category_name || '—' }} · Ед.: {{ target.unit_symbol || '—' }}</p>
                <hr class="preview-divider" />
                <p>Временный остаток: <strong>{{ item().totalBalance }} {{ item().unitSymbol }}</strong></p>
                <p>Текущий остаток постоянной: <strong>{{ (target.total_balance ?? 0) }} {{ target.unit_symbol }}</strong></p>
                <p>После слияния: <strong>{{ (target.total_balance ?? 0) + item().totalBalance }} {{ target.unit_symbol }}</strong></p>

                @if (showUnitWarning()) {
                  <div class="warning-box">
                    ⚠ Единицы измерения не совпадают: временная '{{ item().unitSymbol }}' → постоянная '{{ target.unit_symbol }}'.
                    Требуется ручное подтверждение.
                    <label class="confirm-label">
                      <input type="checkbox" [(ngModel)]="unitConfirmed" />
                      Я подтверждаю слияние с разными единицами измерения
                    </label>
                  </div>
                }
              </div>

              <div class="form-group">
                <label class="form-label">Комментарий</label>
                <input class="form-input" type="text" [(ngModel)]="comment" placeholder="Необязательно" />
              </div>

              <div class="modal-actions">
                <button class="btn btn-primary" [disabled]="!canSubmit()" (click)="onSubmit()">Слить с выбранной ТМЦ</button>
                <button class="btn btn-secondary" (click)="cancel.emit()">Отмена</button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1100; }
    .modal-container { background: #FFFFFF; border-radius: 12px; width: 560px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #E2E8F0; flex-shrink: 0; }
    .modal-title { margin: 0; font-size: 16px; font-weight: 600; color: #0F172A; }
    .modal-close { background: none; border: none; font-size: 24px; color: #94A3B8; cursor: pointer; padding: 0; line-height: 1; }
    .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
    .loading, .error-banner { text-align: center; padding: 40px; font-size: 14px; }
    .error-banner { color: #DC2626; }
    .source-info { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #F8FAFC; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
    .source-label { color: #64748B; }
    .source-name { font-weight: 500; color: #1E293B; flex: 1; }
    .source-balance { font-weight: 600; color: #0F172A; }
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    .form-input { width: 100%; padding: 8px 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
    .form-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .search-results { max-height: 160px; overflow-y: auto; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 14px; }
    .search-item { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #F1F5F9; transition: background 0.1s; }
    .search-item:last-child { border-bottom: none; }
    .search-item:hover { background: #F8FAFC; }
    .search-item.selected { background: #EFF6FF; border-left: 3px solid #3B82F6; }
    .item-name { font-size: 13px; font-weight: 500; color: #1E293B; }
    .item-detail { font-size: 11px; color: #94A3B8; margin-top: 2px; }
    .preview-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px; margin-bottom: 14px; font-size: 13px; color: #166534; }
    .preview-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
    .preview-box p { margin: 4px 0; }
    .preview-divider { border: none; border-top: 1px solid #BBF7D0; margin: 8px 0; }
    .warning-box { margin-top: 10px; padding: 10px; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; font-size: 12px; color: #92400E; display: flex; flex-direction: column; gap: 8px; }
    .confirm-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #92400E; cursor: pointer; }
    .modal-actions { display: flex; gap: 10px; margin-top: 16px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: all 0.15s; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
  `]
})
export class TempItemMergePermanentFormComponent {
  private readonly service = inject(TempItemsService);
  private readonly bffApi = inject(BffApiService);

  readonly item = input.required<TemporaryItemVm>();
  readonly submit = output<TemporaryItemVm>();
  readonly cancel = output<void>();

  readonly searchQuery = signal('');
  readonly searchResults = signal<CatalogItem[]>([]);
  readonly selectedTarget = signal<CatalogItem | null>(null);
  readonly unitConfirmed = signal(false);
  readonly comment = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly showUnitWarning = () => {
    const target = this.selectedTarget();
    if (!target) return false;
    return target.unit_symbol && this.item().unitSymbol && target.unit_symbol !== this.item().unitSymbol;
  };

  readonly canSubmit = () => {
    return this.selectedTarget() !== null && (!this.showUnitWarning() || this.unitConfirmed());
  };

  onSearchChange(query: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (query.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => this.doSearch(query), 300);
  }

  private async doSearch(query: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.bffApi.getList<CatalogItem>('/catalog/read/items', { search: query, page_size: 20 })
      );
      this.searchResults.set(response?.items || []);
    } catch {
      this.searchResults.set([]);
    }
  }

  selectTarget(item: CatalogItem): void {
    this.selectedTarget.set(item);
  }

  async onSubmit(): Promise<void> {
    const target = this.selectedTarget();
    if (!target || !this.canSubmit()) return;
    this.isSubmitting.set(true);
    this.error.set(null);

    const success = await this.service.mergeToPermanent(
      this.item().id,
      target.id,
      this.comment() || undefined,
    );
    if (success) {
      this.submit.emit(this.item());
    } else {
      this.error.set('Ошибка при слиянии. Попробуйте ещё раз.');
      this.isSubmitting.set(false);
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancel.emit();
    }
  }
}
