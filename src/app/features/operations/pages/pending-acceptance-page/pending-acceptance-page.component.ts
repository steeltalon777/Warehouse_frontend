import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OperationsService } from '../../../../core/services/operations.service';
import {
  OperationListRowVm,
  OperationDto,
  OperationStatus,
} from '../../../../core/models/operations.models';
import { OperationsTableComponent } from '../../components/operations-table/operations-table.component';
import { firstValueFrom } from 'rxjs';
import { BffApiService, PaginatedBffResponse } from '../../../../core/api/bff-api.service';

@Component({
  selector: 'app-pending-acceptance-page',
  standalone: true,
  imports: [CommonModule, OperationsTableComponent],
  template: `
    <div class="wh-page operations-page">
      <div class="wh-page-header page-header">
        <div class="header-info">
          <h1 class="page-title">Операции к приёмке</h1>
          <p class="page-subtitle">
            Операции, ожидающие приёмки на складе назначения.
          </p>
        </div>
      </div>

      <div class="wh-card table-card">
        @if (isLoading()) {
          <div class="wh-state wh-state--loading loading-overlay">
            <div class="spinner"></div>
            <span>Загрузка...</span>
          </div>
        } @else if (error()) {
          <div class="wh-state wh-state--error error-banner">{{ error() }}</div>
        } @else {
          <app-operations-table
            [rows]="filteredRows()"
            [sortColumn]="sortColumn()"
            [sortDirection]="sortDirection()"
            [pageSize]="pageSize()"
            [page]="currentPage()"
            [totalCount]="filteredTotal()"
            (sort)="onSort($event)"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
            (rowAccept)="onRowAccept($event)"
          />
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; overflow: hidden; }
    .operations-page { display: flex; flex-direction: column; height: 100%; background: #F1F5F9; overflow: hidden; min-height: 0; }
    .page-header { flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 20px; background: #FFFFFF; border-bottom: 1px solid #E2E8F0; min-height: 0; }
    .header-info { min-width: 0; }
    .page-title { font-size: 20px; font-weight: 700; color: #0F172A; margin: 0; }
    .page-subtitle { font-size: 13px; color: #64748B; margin: 4px 0 0; }
    .table-card { flex: 1; overflow: hidden; display: flex; flex-direction: column; background: #FFFFFF; margin: 8px 20px 12px; border: 1px solid #E2E8F0; border-radius: 10px; min-height: 0; }
    .loading-overlay { flex: 1; display: flex; align-items: center; justify-content: center; gap: 12px; color: #64748B; font-size: 14px; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-banner { margin: 16px; padding: 12px 16px; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; border-radius: 8px; font-size: 14px; }
  `]
})
export class PendingAcceptancePageComponent implements OnInit {
  private readonly bff = inject(BffApiService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly allRows = signal<OperationListRowVm[]>([]);
  readonly sortColumn = signal<string>('createdAt');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);

  /** Filter to operations with pending/in_progress acceptance_state */
  readonly filteredRows = computed(() => {
    const all = this.allRows();
    const filtered = all.filter(r => {
      const label = r.acceptanceStateLabel || '';
      return label.includes('ожидает') || label.includes('частично');
    });
    // Client-side sort
    const col = this.sortColumn();
    const dir = this.sortDirection();
    const sorted = [...filtered].sort((a, b) => {
      let av: any = (a as any)[col];
      let bv: any = (b as any)[col];
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    // Client-side pagination
    const page = this.currentPage();
    const size = this.pageSize();
    return sorted.slice((page - 1) * size, page * size);
  });

  readonly filteredTotal = computed(() => {
    return this.allRows().filter(r =>
      r.acceptanceStateLabel &&
      (r.acceptanceStateLabel.includes('ожидает') || r.acceptanceStateLabel.includes('частично'))
    ).length;
  });

  ngOnInit(): void {
    void this.loadList();
  }

  private async loadList(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Load operations with status that may have pending acceptance
      const result = await firstValueFrom(
        this.bff.getList<OperationDto>('/operations', {
          page_size: 100,
          page: 1,
        })
      );

      const rows = (result.items ?? []).map(op => this.mapToRowVm(op));
      this.allRows.set(rows);
    } catch (err: any) {
      this.error.set(err?.message || 'Ошибка загрузки операций');
    } finally {
      this.isLoading.set(false);
    }
  }

  private mapToRowVm(op: OperationDto): OperationListRowVm {
    const typeLabels: Record<string, string> = {
      RECEIVE: 'Приход', EXPENSE: 'Расход', MOVE: 'Перемещение',
      WRITE_OFF: 'Списание', ISSUE: 'Выдача', ISSUE_RETURN: 'Возврат выдачи',
      CORRECTION: 'Корректировка', ADJUSTMENT: 'Корректировка',
    };
    const statusLabels: Record<string, string> = {
      draft: 'Черновик', created: 'Подтверждена', pending: 'Ожидает приёмки',
      submitted: 'Проведена', rejected: 'Отклонена', cancelled: 'Отменена',
    };
    const acceptanceLabels: Record<string, string> = {
      pending: 'Приёмка: ожидает',
      in_progress: 'Приёмка: частично',
      resolved: 'Приёмка: закрыта',
    };

    const normalizedType = op.type === 'ADJUSTMENT' ? 'CORRECTION' : op.type;
    const displayNumber = op.display_number || op.number || op.id.slice(0, 8).toUpperCase();

    const srcName = op.source_site_name || (op.source_site_id ? `Склад #${op.source_site_id}` : null);
    const dstName = op.destination_site_name || (op.destination_site_id ? `Склад #${op.destination_site_id}` : null);
    const siteName = op.site_name || (op.site_id ? `Склад #${op.site_id}` : null);
    let directionLabel = '—';
    if (op.type === 'MOVE') directionLabel = `${srcName || '—'} → ${dstName || '—'}`;
    else if (op.type === 'RECEIVE') directionLabel = `→ ${siteName || dstName || '—'}`;
    else directionLabel = `${siteName || srcName || '—'}`;

    const accLabel = op.acceptance_state_label || '';

    return {
      id: op.id,
      number: displayNumber,
      displayNumber,
      type: normalizedType as any,
      typeLabel: typeLabels[normalizedType] || op.type,
      status: op.status as OperationStatus,
      statusLabel: statusLabels[op.status] || op.status,
      statusLines: [statusLabels[op.status] || op.status, accLabel].filter(Boolean),
      createdAt: op.created_at,
      createdByUserId: op.created_by_user_id,
      createdByLabel: op.created_by_label || 'Пользователь',
      sourceSiteId: op.source_site_id,
      sourceSiteName: op.source_site_name,
      destinationSiteId: op.destination_site_id,
      destinationSiteName: op.destination_site_name,
      personName: op.person_name,
      issueObjectId: op.issue_object_id,
      issueObjectName: op.issue_object_name_snapshot,
      directionLabel,
      siteName: siteName || null,
      linesCount: op.lines_count ?? (op.lines?.length ?? 0),
      positionCount: op.lines_count ?? (op.lines?.length ?? 0),
      acceptanceStateLabel: accLabel,
      canInvoice: op.status === 'submitted' || op.status === 'pending',
      canOpen: true,
      canEdit: false,
      canSubmit: false,
      canDelete: false,
      canCancel: false,
      canPrint: false,
      canAccept: this.isAcceptanceApplicable(op),
    };
  }

  private isAcceptanceApplicable(op: OperationDto): boolean {
    return (op.type === 'MOVE' || op.type === 'RECEIVE')
      && (op.status === 'submitted' || op.status === 'pending')
      && (op.acceptance_state === 'pending' || op.acceptance_state === 'in_progress');
  }

  onSort(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  onRowAccept(row: OperationListRowVm): void {
    this.router.navigate(['/operations', row.id, 'acceptance']);
  }
}
