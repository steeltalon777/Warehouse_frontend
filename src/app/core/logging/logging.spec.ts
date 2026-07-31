import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';

import { DiagnosticsService } from '../diagnostics/diagnostics.service';
import { httpErrorInterceptor } from './http-error.interceptor';
import { GlobalErrorHandler } from './global-error-handler';

describe('Logging infrastructure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  describe('HttpErrorInterceptor', () => {
    it('should log 403 error with [HTTP] prefix', () => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([httpErrorInterceptor])),
          provideHttpClientTesting(),
          // DiagnosticsService injects DIAGNOSTICS_QUEUE_PORT; provide a stub
          // so the real provider chain is not pulled into the test module.
          { provide: DiagnosticsService, useValue: { track: vi.fn() } },
        ],
      });

      const httpCtrl = TestBed.inject(HttpTestingController);
      const httpClient = TestBed.inject(HttpClient);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      httpClient.get('/bff/api/v1/test').subscribe({ error: () => {} });

      const req = httpCtrl.expectOne('/bff/api/v1/test');
      req.flush('forbidden', { status: 403, statusText: 'Forbidden' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[HTTP]',
        'GET',
        expect.stringContaining('/test'),
        403,
        expect.any(String),
        'unknown',
      );

      consoleSpy.mockRestore();
    });

    it('should not log successful responses', () => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([httpErrorInterceptor])),
          provideHttpClientTesting(),
          { provide: DiagnosticsService, useValue: { track: vi.fn() } },
        ],
      });

      const httpCtrl = TestBed.inject(HttpTestingController);
      const httpClient = TestBed.inject(HttpClient);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      httpClient.get('/bff/api/v1/test').subscribe();

      const req = httpCtrl.expectOne('/bff/api/v1/test');
      req.flush({ ok: true }, { status: 200, statusText: 'OK' });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('GlobalErrorHandler', () => {
    it('should log Error with [GlobalError] prefix', () => {
      TestBed.configureTestingModule({
        providers: [
          GlobalErrorHandler,
          // GlobalErrorHandler uses field-initializer `inject()` for both deps,
          // so plain `new` will throw NG0203. Use the TestBed injector.
          { provide: DiagnosticsService, useValue: { track: vi.fn() } },
          { provide: Router, useValue: { url: '/test' } },
        ],
      });

      const handler = TestBed.inject(GlobalErrorHandler);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => handler.handleError(new Error('test error'))).toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[GlobalError]',
        'test error',
        expect.any(String),
      );

      consoleSpy.mockRestore();
    });

    it('should rethrow the error', () => {
      TestBed.configureTestingModule({
        providers: [
          GlobalErrorHandler,
          { provide: DiagnosticsService, useValue: { track: vi.fn() } },
          { provide: Router, useValue: { url: '/test' } },
        ],
      });

      const handler = TestBed.inject(GlobalErrorHandler);
      expect(() => handler.handleError(new Error('test'))).toThrow('test');
    });
  });
});
