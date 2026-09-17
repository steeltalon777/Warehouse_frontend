import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { OperationsService } from '../../../../core/services/operations.service';
import { AuthContextService } from '../../../../core/services/auth-context.service';
import { CatalogSearchService } from '../../../../core/services/catalog-search.service';
import { DocumentsService } from '../../../../core/services/documents.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { DraftStorageService } from '../../../../core/services/draft-storage.service';
import { OperationListRowVm } from '../../../../core/models/operations.models';
import { SubmitErrorService } from '../../submit-error/submit-error.service';
import { OperationsPageComponent } from './operations-page.component';

function makeRow(id: string, createdAt: string, effectiveAt: string): OperationListRowVm {
  return {
    id,
    number: id,
    displayNumber: id,
    type: 'RECEIVE',
    typeLabel: 'Приход',
    status: 'submitted',
    statusLabel: 'Проведена',
    statusLines: [{ label: 'Проведена', kind: 'operation_status' }],
    createdAt,
    effectiveAt,
    createdByUserId: 'user-1',
    createdByLabel: 'Пользователь',
    directionLabel: '—',
    siteName: null,
    linesCount: 0,
    positionCount: 0,
    acceptanceStateLabel: '',
    canInvoice: false,
    canOpen: true,
    canEdit: false,
    canSubmit: false,
    canDelete: false,
    canCancel: false,
    canPrint: false,
    canAccept: false,
  };
}

describe('OperationsPageComponent — default business chronology', () => {
  let rowsSignal: ReturnType<typeof signal<OperationListRowVm[]>>;
  let serviceMock: any;
  let authMock: any;

  beforeEach(async () => {
    rowsSignal = signal<OperationListRowVm[]>([]);

    serviceMock = {
      isLoading: signal(false),
      error: signal<string | null>(null),
      isSaving: signal(false),
      isSubmitting: signal(false),
      rows: rowsSignal,
      totalCount: signal(0),
      page: signal(1),
      pageSize: signal(20),
      sites: signal([]),
      loadSites: vi.fn(),
      loadList: vi.fn().mockResolvedValue(undefined),
      getOperation: vi.fn(),
      cancelOperation: vi.fn(),
      deleteOperation: vi.fn(),
      restoreOperation: vi.fn(),
      submitOperation: vi.fn(),
      submitWithResult: vi.fn(),
      createOperation: vi.fn(),
      updateOperation: vi.fn(),
      mapDtoToDraftVm: vi.fn(),
      resolveByIdempotencyKey: vi.fn(),
    };

    authMock = {
      authContext: signal({ userId: 'user-1', role: 'root', defaultSiteId: null }),
      load: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [OperationsPageComponent],
      providers: [
        { provide: OperationsService, useValue: serviceMock },
        { provide: AuthContextService, useValue: authMock },
        { provide: CatalogSearchService, useValue: { searchItemsOnce: vi.fn(() => of([])) } },
        { provide: DocumentsService, useValue: { openOperationWaybill: vi.fn(() => of({})) } },
        { provide: DiagnosticsService, useValue: { track: vi.fn() } },
        { provide: DraftStorageService, useValue: { clear: vi.fn() } },
        { provide: SubmitErrorService, useValue: { cancelErrorPayload: signal(null), clearCancel: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('defaults to effectiveAt DESC, not createdAt', () => {
    const fixture = TestBed.createComponent(OperationsPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.sortColumn()).toBe('effectiveAt');
    expect(fixture.componentInstance.sortDirection()).toBe('desc');
  });

  it('sortedRows orders the page by effectiveAt even when created_at order differs', () => {
    const fixture = TestBed.createComponent(OperationsPageComponent);
    fixture.detectChanges();

    const a = makeRow('a', '2026-09-16T12:00:00Z', '2026-01-15T12:00:00Z');
    const b = makeRow('b', '2026-01-10T12:00:00Z', '2026-09-10T12:00:00Z');
    const c = makeRow('c', '2026-06-01T12:00:00Z', '2026-06-20T12:00:00Z');
    rowsSignal.set([a, c, b]);

    expect(fixture.componentInstance.sortedRows().map(r => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('renders the business date (effectiveAt) in the date column', () => {
    const fixture = TestBed.createComponent(OperationsPageComponent);
    fixture.detectChanges();

    rowsSignal.set([
      makeRow('a', '2026-09-16T12:00:00Z', '2026-01-15T12:00:00Z'),
    ]);
    fixture.detectChanges();

    const dateCell = fixture.nativeElement.querySelector('[data-testid="operation-date-cell"]');
    expect(dateCell?.textContent).toContain('15.01.2026');
    expect(dateCell?.textContent).not.toContain('16.09.2026');
  });

  it('keeps explicit user column sorting available', () => {
    const fixture = TestBed.createComponent(OperationsPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.onSort('createdAt');
    expect(fixture.componentInstance.sortColumn()).toBe('createdAt');
    expect(fixture.componentInstance.sortDirection()).toBe('asc');

    fixture.componentInstance.onSort('effectiveAt');
    expect(fixture.componentInstance.sortColumn()).toBe('effectiveAt');
    expect(fixture.componentInstance.sortDirection()).toBe('asc');
  });
});
