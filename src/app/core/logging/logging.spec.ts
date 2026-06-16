import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { httpErrorInterceptor } from './http-error.interceptor';
import { GlobalErrorHandler } from './global-error-handler';

describe('Logging infrastructure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HttpErrorInterceptor', () => {
    it('should log 403 error with [HTTP] prefix', () => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptors([httpErrorInterceptor])),
          provideHttpClientTesting(),
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
      const handler = new GlobalErrorHandler();
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
      const handler = new GlobalErrorHandler();
      expect(() => handler.handleError(new Error('test'))).toThrow('test');
    });
  });
});
