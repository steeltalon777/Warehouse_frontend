import { describe, it, expect, beforeEach, vi } from 'vitest';

import { unsavedDraftGuard } from './unsaved-draft.guard';

describe('unsavedDraftGuard', () => {
  let component: any;

  beforeEach(() => {
    component = { editingDraftHasChanges: vi.fn() };
    // Reset confirm mock between tests
    vi.restoreAllMocks();
  });

  it('returns true when there are no unsaved changes', () => {
    component.editingDraftHasChanges.mockReturnValue(false);
    expect(unsavedDraftGuard(component, undefined as never, undefined as never, undefined as never)).toBe(true);
  });

  it('returns true when editingDraftHasChanges is not a function', () => {
    component.editingDraftHasChanges = undefined;
    expect(unsavedDraftGuard(component, undefined as never, undefined as never, undefined as never)).toBe(true);
  });

  it('prompts the user when there are unsaved changes and returns the answer', () => {
    component.editingDraftHasChanges.mockReturnValue(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(unsavedDraftGuard(component, undefined as never, undefined as never, undefined as never)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toMatch(/несохранённ/i);
  });

  it('returns true if the user confirms the navigation', () => {
    component.editingDraftHasChanges.mockReturnValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(unsavedDraftGuard(component, undefined as never, undefined as never, undefined as never)).toBe(true);
  });
});