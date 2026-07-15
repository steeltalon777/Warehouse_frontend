import { CanDeactivateFn } from '@angular/router';

import { OperationsPageComponent } from '../../features/operations/pages/operations-page/operations-page.component';

/**
 * CanDeactivate guard for /operations.
 *
 * Per contract `docs/contracts/DRAFT_PROTECTION_CONTRACTS.md` §5.
 * Prompts the user to confirm navigation away when the create modal is
 * open and the draft has unsaved changes.
 */
export const unsavedDraftGuard: CanDeactivateFn<OperationsPageComponent> = (
  component: OperationsPageComponent,
): boolean => {
  // Check whether the modal is currently open with a dirty draft.
  if (typeof component.editingDraftHasChanges === 'function' && component.editingDraftHasChanges()) {
    // Defer to the browser's native confirm dialog. Returning false here
    // cancels the navigation; returning true allows it.
    return confirm('У вас есть несохранённые изменения. Покинуть страницу?');
  }
  return true;
};