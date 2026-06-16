import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const start = performance.now();

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

      return throwError(() => error);
    })
  );
};
