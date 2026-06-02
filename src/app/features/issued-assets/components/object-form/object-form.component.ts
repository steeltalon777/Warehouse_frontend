import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import {
  IssueObject,
  IssueObjectType,
  IssueObjectCreatePayload,
  IssueObjectUpdatePayload,
  ISSUE_OBJECT_TYPE_LABELS,
} from '../../../../core/models/issue-objects.models';

@Component({
  selector: 'app-object-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="form-page">
      <div class="form-header">
        <button class="wh-btn wh-btn--secondary btn btn-back" (click)="onBack()">← Назад</button>
        <h2 class="form-title">{{ isEdit() ? 'Редактирование объекта' : 'Создание объекта выдачи' }}</h2>
      </div>

      @if (loading()) {
        <div class="wh-state wh-state--loading loading-state">
          <div class="spinner"></div>
          <span>Загрузка...</span>
        </div>
      } @else {
        <div class="wh-card form-card">
          <div class="form-row">
            <label class="form-label">Наименование *</label>
            <input
              type="text"
              class="wh-form-input input"
              [ngModel]="displayName()"
              (ngModelChange)="displayName.set($event)"
              placeholder="Введите наименование объекта"
            />
            @if (duplicateWarning()) {
              <div class="warning-msg">Объект с похожим наименованием уже существует: «{{ duplicateWarning() }}»</div>
            }
          </div>

          <div class="form-row">
            <label class="form-label">Тип объекта *</label>
            <select class="wh-form-input input" [ngModel]="objectType()" (ngModelChange)="objectType.set($event)">
              <option [ngValue]="null" disabled>Выберите тип</option>
              @for (entry of typeOptions; track entry.key) {
                <option [value]="entry.key">{{ entry.label }}</option>
              }
            </select>
          </div>

          <div class="form-row">
            <label class="form-label">Код</label>
            <input
              type="text"
              class="wh-form-input input"
              [ngModel]="code()"
              (ngModelChange)="code.set($event)"
              placeholder="Внешний код (необязательно)"
            />
          </div>

          <div class="form-actions">
            <button class="wh-btn wh-btn--secondary btn btn-secondary" (click)="onBack()">Отмена</button>
            <button class="wh-btn wh-btn--primary btn btn-primary" [disabled]="!isValid() || saving()" (click)="onSave()">
              {{ saving() ? 'Сохранение...' : 'Сохранить' }}
            </button>
          </div>

          @if (service.error(); as err) {
            <div class="error-msg">{{ err }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow-y: auto; }
    .form-page { padding: 16px 20px; max-width: 600px; }

    .form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .form-title { margin: 0; font-size: 18px; font-weight: 700; color: #0F172A; }

    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; font-family: inherit; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #334155; color: #FFFFFF; border-color: #334155; }
    .btn-primary:hover:not(:disabled) { background: #1E293B; }
    .btn-secondary { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-secondary:hover:not(:disabled) { background: #F8FAFC; }
    .btn-back { background: #FFFFFF; border-color: #D1D5DB; color: #374151; }
    .btn-back:hover:not(:disabled) { background: #F8FAFC; }

    .wh-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 20px; }

    .form-row { margin-bottom: 16px; }
    .form-label { display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 4px; }

    .input { width: 100%; height: 36px; padding: 0 10px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 13px; font-family: inherit; background: #FFFFFF; color: #1F2937; box-sizing: border-box; }
    .input:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }

    .form-actions { display: flex; gap: 8px; margin-top: 20px; }

    .warning-msg { margin-top: 4px; padding: 6px 10px; background: #FEF9C3; border: 1px solid #FDE68A; border-radius: 6px; font-size: 12px; color: #854D0E; }
    .error-msg { margin-top: 12px; padding: 8px 12px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; font-size: 12px; color: #DC2626; }

    .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; padding: 40px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ObjectFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly service = inject(IssueObjectsService);

  readonly isEdit = signal<boolean>(false);
  readonly objectId = signal<string | null>(null);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);

  readonly displayName = signal<string>('');
  readonly objectType = signal<IssueObjectType | null>(null);
  readonly code = signal<string>('');
  readonly duplicateWarning = signal<string | null>(null);
  private duplicateTimer: ReturnType<typeof setTimeout> | null = null;

  readonly typeOptions = (Object.entries(ISSUE_OBJECT_TYPE_LABELS) as [IssueObjectType, string][])
    .map(([key, label]) => ({ key, label }));

  readonly isValid = computed(() => {
    return this.displayName().trim().length > 0 && this.objectType() !== null;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.objectId.set(id);
      this.loadObject(id);
    }
  }

  async loadObject(id: string): Promise<void> {
    this.loading.set(true);
    const obj = await this.service.getObject(id);
    if (obj) {
      this.displayName.set(obj.display_name);
      this.objectType.set(obj.object_type);
      this.code.set(obj.code || '');
    }
    this.loading.set(false);
  }

  async onSave(): Promise<void> {
    if (!this.isValid()) return;
    this.saving.set(true);

    try {
      if (this.isEdit()) {
        const id = this.objectId();
        if (!id) return;
        const payload: IssueObjectUpdatePayload = {
          display_name: this.displayName().trim(),
          object_type: this.objectType()!,
          code: this.code().trim() || undefined,
        };
        await this.service.updateObject(id, payload);
      } else {
        const payload: IssueObjectCreatePayload = {
          display_name: this.displayName().trim(),
          object_type: this.objectType()!,
          code: this.code().trim() || undefined,
        };
        await this.service.createObject(payload);
      }
      this.router.navigate(['/issued-assets/objects']);
    } catch {
      // error handled in service
    } finally {
      this.saving.set(false);
    }
  }

  onBack(): void {
    this.router.navigate(['/issued-assets/objects']);
  }
}
