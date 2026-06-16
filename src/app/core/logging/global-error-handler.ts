import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack?.slice(0, 500) ?? '') : '';

    console.error(
      '[GlobalError]',
      message,
      stack,
    );

    throw error;
  }
}
