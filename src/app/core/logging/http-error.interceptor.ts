import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { DiagnosticsService } from '../diagnostics/diagnostics.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  // Diagnostics TZ Stage 3 WP-4: skip diagnostics endpoint to avoid recursion
  if (req.url.includes('/diagnostics/ui-events')) {
    return next(req);
  }

  const start = performance.now();
  const diag = inject(DiagnosticsService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const durationMs = Math.round(performance.now() - start);
      let errorCode = 'unknown';

      if (error.error?.error?.code) {
        errorCode = error.error.error.code;
      }

      console.error(
        '[HTTP]',
        req.method,
        req.urlWithParams,
        error.status,
        `${durationMs}ms`,
        errorCode
      );

      // Diagnostics TZ Stage 3 WP-4: track request_failed for non-outcome-unknown errors
      if (errorCode !== 'operation_outcome_unknown') {
        try {
          diag.track('request_failed', {
            httpMethod: req.method,
            httpUrl: req.urlWithParams,
            httpStatus: error.status,
            errorCode,
            durationMs,
          });
        } catch {
          // never break the chain
        }
      }

      return throwError(() => error);
    })
  );
};
