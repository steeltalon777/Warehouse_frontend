/**
 * TZ V3.2 Stage D Extension — W2.1 modal-stays-open contract (TZ §7.4 #16).
 *
 * Verifies that `ObjectPanelComponent.onModalSubmit()` closes the modal ONLY
 * when create/update AND submit succeed. On any failure (business reject,
 * version conflict, outcome_unknown, network error) the modal must remain
 * open so the user can correct the draft.
 */
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ObjectPanelComponent } from './object-panel.component';
import { OperationsService } from '../../../../core/services/operations.service';
import { IssueObjectsService } from '../../../../core/services/issue-objects.service';
import { OperationDraftVm } from '../../../../core/models/operations.models';

describe('ObjectPanelComponent — onModalSubmit (TZ §7.4 #16 modal-stays-open)', () => {
  let fixture: ComponentFixture<ObjectPanelComponent>;
  let component: ObjectPanelComponent;
  let operationsService: {
    createOperation: ReturnType<typeof vi.fn>;
    updateOperation: ReturnType<typeof vi.fn>;
    submitOperation: ReturnType<typeof vi.fn>;
  };

  const baseDraft: OperationDraftVm = {
    draftId: 'local-1',
    type: 'RECEIVE',
    status: 'draft',
    lines: [],
  };

  beforeEach(async () => {
    operationsService = {
      createOperation: vi.fn(),
      updateOperation: vi.fn(),
      submitOperation: vi.fn(),
    };

    // Minimal IssueObjectsService stub — `service` is heavily used in the
    // template (tree(), objectAssets(), isSaving(), etc.). CUSTOM_ELEMENTS_SCHEMA
    // bypasses template type-checking for unknown DOM elements (e.g.
    // app-assigned-assets-table), so we only need the signals the template
    // actually invokes.
    const issueObjectsStub = {
      isLoading: signal(false),
      isSaving: signal(false),
      error: signal<string | null>(null),
      items: signal([]),
      totalCount: signal(0),
      page: signal(1),
      pageSize: signal(20),
      selectedObject: signal(null),
      objectAssets: signal([]),
      objectAssetsLoading: signal(false),
      tree: signal([]),
      treeLoading: signal(false),
      loadTree: vi.fn().mockResolvedValue(undefined),
      loadObjectAssets: vi.fn().mockResolvedValue(undefined),
      createObject: vi.fn().mockResolvedValue(null),
      updateObject: vi.fn().mockResolvedValue(null),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    } as unknown as IssueObjectsService;

    await TestBed.configureTestingModule({
      imports: [ObjectPanelComponent],
      providers: [
        { provide: OperationsService, useValue: operationsService },
        { provide: IssueObjectsService, useValue: issueObjectsStub },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectPanelComponent);
    component = fixture.componentInstance;
    // Skip detectChanges — we only need to exercise onModalSubmit, not render
    // the full template (which has many IssueObjectsService dependencies that
    // are unrelated to TZ §7.4 #16 contract).
    component.showCreateModal.set(true);
    component.modalDraft.set({ ...baseDraft });
  });

  it('closes the modal when create + submit succeed', async () => {
    operationsService.createOperation.mockResolvedValue({ id: 'op-1', version: 1, status: 'draft' });
    operationsService.submitOperation.mockResolvedValue(undefined);

    await component.onModalSubmit({ ...baseDraft });

    expect(component.showCreateModal()).toBe(false);
    expect(component.modalDraft()).toBeNull();
    expect(operationsService.submitOperation).toHaveBeenCalledWith('op-1');
  });

  it('keeps modal open on business reject (create ok, submit throws operation_submit_rejected)', async () => {
    operationsService.createOperation.mockResolvedValue({ id: 'op-1', version: 1, status: 'draft' });
    operationsService.submitOperation.mockRejectedValue({
      code: 'operation_submit_rejected',
      message: 'Недостаточно остатков',
    });

    await component.onModalSubmit({ ...baseDraft });

    expect(component.showCreateModal(), 'modal must stay open on business reject').toBe(true);
    expect(component.modalDraft(), 'modal draft must survive for retry').not.toBeNull();
    expect(operationsService.submitOperation).toHaveBeenCalledOnce();
  });

  it('keeps modal open on outcome_unknown (504)', async () => {
    operationsService.createOperation.mockResolvedValue({ id: 'op-2', version: 1, status: 'draft' });
    operationsService.submitOperation.mockRejectedValue({
      code: 'operation_outcome_unknown',
      message: 'submit timed out',
    });

    await component.onModalSubmit({ ...baseDraft });

    expect(component.showCreateModal(), 'modal must stay open on outcome_unknown').toBe(true);
    expect(component.modalDraft()).not.toBeNull();
  });

  it('keeps modal open on version conflict (409)', async () => {
    operationsService.createOperation.mockResolvedValue({ id: 'op-3', version: 2, status: 'draft' });
    operationsService.submitOperation.mockRejectedValue({
      code: 'operation_version_conflict',
      message: 'Операция была изменена в другой вкладке',
    });

    await component.onModalSubmit({ ...baseDraft });

    expect(component.showCreateModal(), 'modal must stay open on version conflict').toBe(true);
    expect(component.modalDraft()).not.toBeNull();
  });

  it('does NOT issue a duplicate create when submit fails', async () => {
    operationsService.createOperation.mockResolvedValue({ id: 'op-4', version: 1, status: 'draft' });
    operationsService.submitOperation.mockRejectedValue({ code: 'operation_outcome_unknown' });

    await component.onModalSubmit({ ...baseDraft });

    // Exactly one create (no auto-retry on submit failure).
    expect(operationsService.createOperation).toHaveBeenCalledOnce();
    expect(operationsService.submitOperation).toHaveBeenCalledOnce();
  });

  it('user-initiated cancel still closes the modal (onModalCancel)', () => {
    component.onModalCancel();
    expect(component.showCreateModal()).toBe(false);
    expect(component.modalDraft()).toBeNull();
  });
});
