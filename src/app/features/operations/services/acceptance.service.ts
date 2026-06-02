import { Injectable, signal, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BffApiService } from '../../../core/api/bff-api.service';
import { OperationDto } from '../../../core/models/operations.models';

export interface PendingAcceptanceLineVm {
  operation_line_id: number | string;
  operation_id: string;
  item_id: string;
  item_name: string;
  display_name?: string;
  sku?: string;
  unit_symbol?: string;
  qty: string;
  accepted_qty?: string;
  lost_qty?: string;
  destination_site_id?: number;
  destination_site_name?: string;
  source_site_id?: number;
  source_site_name?: string;
}

export interface AcceptLinePayload {
  line_id: number | string;
  accepted_qty: string;
  lost_qty: string;
  note?: string;
}

export interface AcceptanceSubmitResult {
  operation: OperationDto | null;
  hasLost: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AcceptanceService {
  private readonly bff = inject(BffApiService);

  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly operation = signal<OperationDto | null>(null);
  readonly lines = signal<PendingAcceptanceLineVm[]>([]);

  readonly isResolved = computed(() => {
    const op = this.operation();
    return op?.acceptance_state === 'resolved';
  });

  async loadOperation(id: string): Promise<OperationDto | null> {
    try {
      const result = await firstValueFrom(
        this.bff.getData<OperationDto>(`/operations/${id}`)
      );
      this.operation.set(result);
      return result;
    } catch (err: any) {
      this.error.set(err?.message || 'Не удалось загрузить операцию.');
      return null;
    }
  }

  async loadPendingAcceptance(operationId: string): Promise<PendingAcceptanceLineVm[]> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.getList<PendingAcceptanceLineVm>('/pending-acceptance', {
          operation_id: operationId,
          page_size: 200,
        })
      );
      const items = result?.items ?? [];
      this.lines.set(items);
      return items;
    } catch (err: any) {
      this.error.set(err?.message || 'Не удалось загрузить данные приёмки.');
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitAcceptLines(
    operationId: string,
    lines: AcceptLinePayload[]
  ): Promise<AcceptanceSubmitResult> {
    this.isSubmitting.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.bff.postData<OperationDto>(`/operations/${operationId}/accept-lines`, {
          lines,
        })
      );
      this.operation.set(result);
      const hasLost = (result?.lines ?? []).some(
        l => {
          const lost = parseFloat(l.lost_qty ?? '0');
          return !isNaN(lost) && lost > 0;
        }
      );
      return { operation: result, hasLost };
    } catch (err: any) {
      const status = err?.status;
      if (status === 403) {
        this.error.set('Доступ запрещён.');
      } else if (status === 409) {
        this.error.set('Конфликт: данные изменились, перезагружаю...');
      } else if (status === 422) {
        const fields = err?.fields;
        if (fields) {
          const messages = Object.entries(fields)
            .map(([k, v]) => `${k}: ${v}`)
            .join('; ');
          this.error.set(`Ошибка валидации: ${messages}`);
        } else {
          this.error.set(err?.message || 'Ошибка валидации данных.');
        }
      } else {
        this.error.set(err?.message || 'Не удалось провести приёмку.');
      }
      throw err;
    } finally {
      this.isSubmitting.set(false);
    }
  }

  clear(): void {
    this.isLoading.set(false);
    this.isSubmitting.set(false);
    this.error.set(null);
    this.operation.set(null);
    this.lines.set([]);
  }
}
