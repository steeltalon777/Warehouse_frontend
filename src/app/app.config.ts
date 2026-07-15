import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXsrfConfiguration, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/logging/http-error.interceptor';
import { GlobalErrorHandler } from './core/logging/global-error-handler';
import { DiagnosticsSessionService } from './core/services/diagnostics-session.service';
import { DIAGNOSTICS_QUEUE_PORT } from './core/diagnostics/diagnostics.models';
import { DiagnosticsQueueService } from './core/diagnostics/diagnostics-queue.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withXsrfConfiguration({
        cookieName: 'csrftoken',
        headerName: 'X-CSRFToken'
      }),
      withInterceptors([httpErrorInterceptor])
    ),
    // Eagerly construct DiagnosticsSessionService so sessionId/tabId are
    // populated before the first mutation request is dispatched (TZ C5 §2.1).
    provideAppInitializer(() => { inject(DiagnosticsSessionService); }),
    // Diagnostics queue: bind the port to the concrete service so
    // DiagnosticsService can inject the port without depending on
    // DiagnosticsQueueService directly (keeps the cycle safe and lets
    // us mock the queue in tests).
    { provide: DIAGNOSTICS_QUEUE_PORT, useExisting: DiagnosticsQueueService },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
