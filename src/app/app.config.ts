import { ApplicationConfig, provideBrowserGlobalErrorListeners, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withXsrfConfiguration, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { httpErrorInterceptor } from './core/logging/http-error.interceptor';
import { GlobalErrorHandler } from './core/logging/global-error-handler';

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
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};
