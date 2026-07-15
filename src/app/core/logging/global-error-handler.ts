import { ErrorHandler, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { DiagnosticsService } from '../diagnostics/diagnostics.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly diag = inject(DiagnosticsService);
  private readonly router = inject(Router);

  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack?.slice(0, 500) ?? '') : '';

    console.error(
      '[GlobalError]',
      message,
      stack,
    );

    // Diagnostics TZ Stage 3 WP-4: unexpected_error
    try {
      this.diag.track('unexpected_error', {
        stackTraceSnippet: stack,
        reason: message,
      });
    } catch {
      // diagnostics must never break the app
    }

    throw error;
  }
}
