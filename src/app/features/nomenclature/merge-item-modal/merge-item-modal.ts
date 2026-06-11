import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CatalogAdminService } from '../../../core/services/catalog-admin.service';
import { BffApiService } from '../../../core/api/bff-api.service';
import { Item } from '../../../core/models/nomenclature.models';

@Component({
  selector: 'app-merge-item-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Слияние ТМЦ</h2>
          <button class="modal-close" (click)="cancel.emit()">&times;</button>
        </div>

        <div class="modal-body">
          @if (isSubmitting()) {
            <div class="loading">Слияние...</div>
          } @else if (error()) {
            <div class="error-banner">{{ error() }}</div>
          } @else {
            <div class="source-info">
              <div class="source-row">
                <span class="source-label">Название:</span>
                <span class="source-value">{{ sourceItem().name }}</span>
              </div>
              <div class="source-row">
                <span class="source-label">SKU:</span>
                <span class="source-value">{{ sourceItem().sku || '—' }}</span>
              </div>
              <div class="source-row">
                <span class="source-label">Категория:</span>
                <span class="source-value">{{ sourceItem().category_name }}</span>
              </div>
              <div class="source-row">
                <span class="source-label">Ед. изм.:</span>
                <span class="source-value">{{ sourceItem().unit_symbol }}</span>
              </div>
              <div class="source-row">
                <span class="source-label">Остаток:</span>
                <span class="source-value">{{ sourceItem().source_site_qty || '—' }}</span>
              </div>
            </div>

            <div class="form-group">
              <input
                class="search-input"
                type="text"
                [(ngModel)]="searchQuery"
                (ngModelChange)="onSearchChange($event)"
                placeholder="&#x1F50D; Поиск ТМЦ..."
              />
            </div>

            @if (searchResults().length > 0) {
              <div class="search-results">
                @for (result of searchResults(); track result.id) {
                  <div
                    class="search-result-item"
                    [class.selected]="isSelected(result.id)"
                    (click)="selectTarget(result)"
                  >
                    <div class="result-name">{{ result.name }}</div>
                    <div class="result-detail">
                      SKU: {{ result.sku || '—' }} · {{ result.category_name || '—' }} · {{ result.unit_symbol || '—' }}
                    </div>
                  </div>
                }
              </div>
            }

            @if (selectedTarget(); as target) {
              <div class="preview-box">
                <div class="preview-row">
                  <span class="preview-label">Целевая ТМЦ:</span>
                  <strong>{{ target.name }}</strong>
                </div>
                <div class="preview-row">
                  <span class="preview-label">SKU:</span> {{ target.sku || '—' }}
                </div>
                <div class="preview-row">
                  <span class="preview-label">Категория:</span> {{ target.category_name || '—' }}
                </div>
                <div class="preview-row">
                  <span class="preview-label">Ед. изм.:</span> {{ target.unit_symbol || '—' }}
                </div>
              </div>

              @if (unitMismatch()) {
                <div class="unit-warning">
                  <span>&#x26A0; Единицы измерения не совпадают: '{{ sourceItem().unit_symbol }}' → '{{ target.unit_symbol }}'</span>
                  <label class="confirm-label">
                    <input type="checkbox" [(ngModel)]="unitConfirmed" />
                    Подтверждаю слияние с разными единицами измерения
                  </label>
                </div>
              }

              <div class="form-group">
                <label class="form-label">Комментарий</label>
                <textarea
                  class="comment-textarea"
                  [(ngModel)]="comment"
                  rows="3"
                  placeholder="Необязательно"
                ></textarea>
              </div>

              <div class="modal-actions">
                <button class="btn btn-secondary" (click)="cancel.emit()">Отмена</button>
                <button class="btn btn-primary" [disabled]="!canSubmit()" (click)="onSubmit()">Слияние ТМЦ</button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1100; }
    .modal-container { background: #FFFFFF; border-radius: 12px; width: 600px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #E2E8F0; flex-shrink: 0; }
    .modal-title { margin: 0; font-size: 16px; font-weight: 600; color: #0F172A; }
    .modal-close { background: none; border: none; font-size: 24px; color: #94A3B8; cursor: pointer; padding: 0; line-height: 1; }
    .modal-body { padding: 24px; overflow-y: auto; flex: 1; }
    .loading, .error-banner { text-align: center; padding: 40px; font-size: 14px; }
    .error-banner { color: #DC2626; }
    .source-info { background: #f0f4ff; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .source-row { display: flex; gap: 8px; font-size: 13px; padding: 2px 0; }
    .source-label { color: #64748B; min-width: 90px; }
    .source-value { color: #1E293B; font-weight: 500; }
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    .search-input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; font-family: inherit; box-sizing: border-box; }
    .search-input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .search-results { border: 1px solid #e5e7eb; border-radius: 8px; max-height: 250px; overflow-y: auto; margin-top: 8px; }
    .search-result-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #F1F5F9; transition: background 0.1s; }
    .search-result-item:last-child { border-bottom: none; }
    .search-result-item:hover { background: #f3f4f6; }
    .search-result-item.selected { background: #eff6ff; border-left: 3px solid #3b82f6; }
    .result-name { font-size: 13px; font-weight: 500; color: #1E293B; }
    .result-detail { font-size: 11px; color: #94A3B8; margin-top: 2px; }
    .preview-box { background: #ecfdf5; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; margin-top: 12px; font-size: 13px; color: #166534; }
    .preview-row { padding: 2px 0; }
    .preview-label { color: #15803d; }
    .unit-warning { background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 12px 16px; margin-top: 12px; font-size: 12px; color: #92400E; display: flex; flex-direction: column; gap: 8px; }
    .confirm-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #92400E; cursor: pointer; }
    .comment-textarea { width: 100%; padding: 10px 14px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; box-sizing: border-box; resize: vertical; }
    .comment-textarea:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #E5E7EB; }
    .btn { display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; font-family: inherit; transition: all 0.15s; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #3b82f6; color: #FFFFFF; border-color: #3b82f6; }
    .btn-primary:hover:not(:disabled) { background: #2563EB; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
  `]
})
export class MergeItemModalComponent {
  private readonly catalogAdmin = inject(CatalogAdminService);
  private readonly bffApi = inject(BffApiService);

  readonly sourceItem = input.required<Item>();
  readonly mergeComplete = output<void>();
  readonly cancel = output<void>();

  searchQuery = '';
  readonly searchResults = signal<Item[]>([]);
  readonly selectedTarget = signal<Item | null>(null);
  unitConfirmed = false;
  comment = '';
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly unitMismatch = () => {
    const target = this.selectedTarget();
    if (!target) return false;
    return String(this.sourceItem().unit_id) !== String(target.unit_id);
  };

  readonly canSubmit = () => {
    return this.selectedTarget() !== null && (!this.unitMismatch() || this.unitConfirmed);
  };

  isSelected(itemId: string | number): boolean {
    return String(this.selectedTarget()?.id) === String(itemId);
  }

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
        this.bffApi.getList<Item>('/catalog/read/items', { search: query, page_size: 20 })
      );
      const sourceId = String(this.sourceItem().id);
      const filtered = (response?.items || []).filter(
        (item) => String(item.id) !== sourceId && item.is_active === true
      );
      this.searchResults.set(filtered);
    } catch {
      this.searchResults.set([]);
    }
  }

  selectTarget(item: Item): void {
    this.selectedTarget.set(item);
    this.unitConfirmed = false;
  }

  async onSubmit(): Promise<void> {
    const target = this.selectedTarget();
    if (!target || !this.canSubmit()) return;
    this.isSubmitting.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(
        this.catalogAdmin.mergeItem({
          source_item_id: this.sourceItem().id,
          target_item_id: target.id,
          comment: this.comment || undefined,
        })
      );
      this.mergeComplete.emit();
    } catch (err: unknown) {
      const message = (err && typeof err === 'object' && 'message' in err)
        ? (err as { message: string }).message
        : 'Ошибка при слиянии. Попробуйте ещё раз.';
      this.error.set(message);
      this.isSubmitting.set(false);
    }
  }

}
