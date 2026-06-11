import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BffApiService } from '../../../core/api/bff-api.service';
import { CatalogAdminService } from '../../../core/services/catalog-admin.service';
import { Category } from '../../../core/models/nomenclature.models';

@Component({
  selector: 'app-merge-category-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">Слияние категорий</h2>
          <button class="modal-close" (click)="cancel.emit()">&times;</button>
        </div>
        <div class="modal-body">
          @if (isSubmitting()) {
            <div class="loading-state">Слияние...</div>
          } @else if (error()) {
            <div class="error-banner">{{ error() }}</div>
            <div class="modal-actions">
              <button class="btn btn-secondary" (click)="cancel.emit()">Закрыть</button>
            </div>
          } @else {
            <div class="source-info">
              <div class="source-name">{{ sourceCategory().name }}</div>
              <div class="source-meta">
                Код: {{ sourceCategory().code || '—' }}
                · ТМЦ: {{ sourceCategory().items_count }} шт.
                · Подкатегории: {{ sourceCategory().children_count }}
              </div>
            </div>

            <label class="field-label">Целевая категория:</label>
            <input
              type="text"
              class="search-input"
              placeholder="🔍 Поиск категории..."
              [ngModel]="searchQuery()"
              (ngModelChange)="onSearchChange($event)"
            />

            @if (searchResults().length > 0) {
              <div class="search-results">
                @for (cat of searchResults(); track cat.id) {
                  <div
                    class="search-result-item"
                    [class.selected]="isSelected(cat.id)"
                    (click)="selectTarget(cat)"
                  >
                    <div class="result-name">{{ cat.name }}</div>
                    <div class="result-meta">
                      Код: {{ cat.code || '—' }} · ТМЦ: {{ cat.items_count }} шт.
                    </div>
                  </div>
                }
              </div>
            }

            @if (selectedTarget(); as target) {
              <div class="preview-box">
                <div class="preview-label">Целевая категория:</div>
                <div class="preview-name">{{ target.name }}</div>
                <div class="preview-meta">
                  Код: {{ target.code || '—' }} · ТМЦ: {{ target.items_count }} шт.
                </div>
              </div>

              <div class="merge-warning">
                ⚠️ Все ТМЦ ({{ sourceCategory().items_count }} шт.) и подкатегории
                ({{ sourceCategory().children_count }}) будут перенесены в «{{ target.name }}».
              </div>

              <label class="field-label">Комментарий:</label>
              <textarea
                class="comment-input"
                placeholder="Причина слияния..."
                [ngModel]="comment()"
                (ngModelChange)="comment.set($event)"
                rows="3"
              ></textarea>

              <div class="modal-actions">
                <button class="btn btn-secondary" (click)="cancel.emit()">Отмена</button>
                <button class="btn btn-primary" (click)="onSubmit()">Слияние категории</button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.4); z-index: 1100;
      display: flex; align-items: center; justify-content: center;
    }
    .modal-container {
      background: #fff; border-radius: 12px; width: 600px;
      max-height: 80vh; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }
    .modal-header {
      padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-title { margin: 0; font-size: 18px; font-weight: 600; }
    .modal-close {
      background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;
      padding: 0; line-height: 1;
    }
    .modal-close:hover { color: #111827; }
    .modal-body { padding: 24px; overflow-y: auto; }
    .loading-state { text-align: center; padding: 40px; color: #6b7280; font-size: 16px; }
    .error-banner {
      background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;
      padding: 12px 16px; color: #991b1b; margin-bottom: 16px;
    }
    .source-info {
      background: #f0f4ff; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;
    }
    .source-name { font-weight: 600; font-size: 15px; color: #1e40af; }
    .source-meta { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .field-label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
    .search-input {
      width: 100%; padding: 10px 14px; border: 1px solid #d1d5db;
      border-radius: 8px; font-size: 14px; box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .search-results {
      border: 1px solid #e5e7eb; border-radius: 8px;
      max-height: 250px; overflow-y: auto; margin-top: 8px;
    }
    .search-result-item {
      padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f3f4f6;
    }
    .search-result-item:last-child { border-bottom: none; }
    .search-result-item:hover { background: #f3f4f6; }
    .search-result-item.selected { background: #eff6ff; border-left: 3px solid #3b82f6; }
    .result-name { font-weight: 500; font-size: 14px; }
    .result-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .preview-box {
      background: #ecfdf5; border: 1px solid #86efac; border-radius: 8px;
      padding: 12px 16px; margin-top: 12px;
    }
    .preview-label { font-size: 12px; color: #065f46; font-weight: 500; margin-bottom: 4px; }
    .preview-name { font-weight: 600; font-size: 15px; color: #065f46; }
    .preview-meta { font-size: 13px; color: #047857; margin-top: 2px; }
    .merge-warning {
      background: #fefce8; border: 1px solid #fde047; border-radius: 8px;
      padding: 12px 16px; margin-top: 12px; font-size: 13px; color: #854d0e;
    }
    .comment-input {
      width: 100%; padding: 10px 14px; border: 1px solid #d1d5db;
      border-radius: 8px; font-size: 14px; resize: vertical; box-sizing: border-box;
    }
    .comment-input:focus { outline: none; border-color: #3b82f6; }
    .modal-actions {
      display: flex; justify-content: flex-end; gap: 8px;
      margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;
    }
    .btn {
      padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 500;
      cursor: pointer; border: 1px solid transparent;
    }
    .btn-secondary { background: #f3f4f6; color: #374151; border-color: #d1d5db; }
    .btn-secondary:hover { background: #e5e7eb; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
  `]
})
export class MergeCategoryModalComponent {
  readonly sourceCategory = input.required<Category>();
  readonly allCategories = input<Category[]>([]);
  readonly mergeComplete = output<void>();
  readonly cancel = output<void>();

  private readonly bffApi = inject(BffApiService);
  private readonly catalogAdmin = inject(CatalogAdminService);

  readonly searchQuery = signal('');
  readonly searchResults = signal<Category[]>([]);
  readonly selectedTarget = signal<Category | null>(null);
  readonly comment = signal('');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  isSelected(catId: string | number): boolean {
    return String(this.selectedTarget()?.id) === String(catId);
  }

  /** Recursively collect all descendant IDs of the source category */
  readonly excludedIds = computed<Set<string>>(() => {
    const source = this.sourceCategory();
    const ids = new Set<string>();
    if (!source) return ids;
    const sourceId = String(source.id);
    const collectFromTree = (cats: Category[]) => {
      for (const c of cats) {
        if (String(c.id) === sourceId) {
          this.collectDescendants(c, ids);
          return true;
        }
        if (c.children && collectFromTree(c.children)) return true;
      }
      return false;
    };
    collectFromTree(this.allCategories());
    ids.add(sourceId);
    return ids;
  });

  private collectDescendants(cat: Category, ids: Set<string>): void {
    if (!cat.children) return;
    for (const child of cat.children) {
      ids.add(String(child.id));
      this.collectDescendants(child, ids);
    }
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (query.length < 2) { this.searchResults.set([]); return; }
    this.searchTimer = setTimeout(() => this.doSearch(query), 300);
  }

  private async doSearch(query: string): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.bffApi.getData<{ categories: Category[]; total_count: number; page: number; page_size: number }>(
          '/catalog/read/categories',
          { search: query, page_size: 20 }
        )
      );
      const excluded = this.excludedIds();
      const filtered = (response?.categories || []).filter(c => !excluded.has(String(c.id)));
      this.searchResults.set(filtered);
    } catch {
      this.searchResults.set([]);
    }
  }

  selectTarget(category: Category): void {
    this.selectedTarget.set(category);
  }

  async onSubmit(): Promise<void> {
    const target = this.selectedTarget();
    if (!target) return;
    this.isSubmitting.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.catalogAdmin.mergeCategory({
          source_category_id: this.sourceCategory().id,
          target_category_id: target.id,
          comment: this.comment() || undefined,
        })
      );
      this.mergeComplete.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка при слиянии категорий';
      this.error.set(msg);
      this.isSubmitting.set(false);
    }
  }

}
