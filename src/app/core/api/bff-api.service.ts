import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';
import { DiagnosticsSessionService } from '../services/diagnostics-session.service';

export interface BffApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
  current_version?: number;
  request_id?: string;
  status?: string;
  retry_safe?: boolean;
}

export interface BffApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: BffApiError;
}

export interface PaginatedBffResponse<T> {
  items: T[];
  total_count: number;
  page: number;
  page_size: number;
}

@Injectable({
  providedIn: 'root'
})
export class BffApiService {
  private readonly baseUrl = '/bff/api/v1';
  /** Mutation-specific timeout (TZ C5): write requests abort after 30 s */
  private readonly MUTATION_TIMEOUT_MS = 30_000;
  private readonly WAREHOUSE_CLIENT_HEADER = '3.2-angular';
  /** Optional X-Client-Draft-Id for operations endpoints (TZ C5 §3.1). */
  private _currentDraftId: string | null = null;

  constructor(
    private http: HttpClient,
    private diagnostics: DiagnosticsSessionService,
  ) {}

  /** Set the draft id that will be sent as X-Client-Draft-Id on the next
   *  mutation call. Pass null to clear. Used for operations endpoints. */
  setCurrentDraftId(draftId: string | null): void {
    this._currentDraftId = draftId || null;
  }

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<BffApiResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<BffApiResponse<T>>(`${this.baseUrl}${path}`, {
      params: httpParams,
      withCredentials: true
    }).pipe(catchError(this.handleError));
  }

  getData<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.get<T>(path, params).pipe(map(res => res.data as T));
  }

  getList<T>(path: string, params?: Record<string, string | number | boolean>): Observable<PaginatedBffResponse<T>> {
    return this.getData<PaginatedBffResponse<T>>(path, params);
  }

  post<T>(path: string, body?: unknown): Observable<BffApiResponse<T>> {
    return this.http.post<BffApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
      headers: this.getMutationHeaders(),
      observe: 'response'
    }).pipe(
      timeout(this.MUTATION_TIMEOUT_MS),
      tap(res => this.captureServerRequestId(res.headers)),
      map(res => res.body as BffApiResponse<T>),
      catchError(this.handleError)
    );
  }

  postData<T>(path: string, body?: unknown): Observable<T> {
    return this.post<T>(path, body).pipe(map(res => res.data as T));
  }

  put<T>(path: string, body?: unknown): Observable<BffApiResponse<T>> {
    return this.http.put<BffApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
      headers: this.getMutationHeaders(),
      observe: 'response'
    }).pipe(
      timeout(this.MUTATION_TIMEOUT_MS),
      tap(res => this.captureServerRequestId(res.headers)),
      map(res => res.body as BffApiResponse<T>),
      catchError(this.handleError)
    );
  }

  putData<T>(path: string, body?: unknown): Observable<T> {
    return this.put<T>(path, body).pipe(map(res => res.data as T));
  }

  patch<T>(path: string, body?: unknown): Observable<BffApiResponse<T>> {
    return this.http.patch<BffApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
      headers: this.getMutationHeaders(),
      observe: 'response'
    }).pipe(
      timeout(this.MUTATION_TIMEOUT_MS),
      tap(res => this.captureServerRequestId(res.headers)),
      map(res => res.body as BffApiResponse<T>),
      catchError(this.handleError)
    );
  }

  patchData<T>(path: string, body?: unknown): Observable<T> {
    return this.patch<T>(path, body).pipe(map(res => res.data as T));
  }

  delete<T>(path: string): Observable<BffApiResponse<T>> {
    return this.http.delete<BffApiResponse<T>>(`${this.baseUrl}${path}`, {
      withCredentials: true,
      headers: this.getMutationHeaders(),
      observe: 'response'
    }).pipe(
      timeout(this.MUTATION_TIMEOUT_MS),
      tap(res => this.captureServerRequestId(res.headers)),
      map(res => res.body as BffApiResponse<T>),
      catchError(this.handleError)
    );
  }

  deleteData<T>(path: string): Observable<T> {
    return this.delete<T>(path).pipe(map(res => res.data as T));
  }

  /** Store X-Request-Id from response headers (TZ C5 §3.3). */
  private captureServerRequestId(headers: HttpHeaders): void {
    const id = headers.get('X-Request-Id');
    if (id) {
      this.diagnostics.lastServerRequestId = id;
    }
  }

  private getCsrfHeaders(): HttpHeaders {
    const csrfToken = this.getCsrfToken();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (csrfToken) {
      headers = headers.set('X-CSRFToken', csrfToken);
    }
    return headers;
  }

  /** Headers for mutating requests: CSRF + Warehouse client version + diagnostics (TZ C5 §3.1). */
  private getMutationHeaders(): HttpHeaders {
    let headers = this.getCsrfHeaders();
    headers = headers.set('X-Warehouse-Client', this.WAREHOUSE_CLIENT_HEADER);
    headers = headers.set('X-Client-Session-Id', this.diagnostics.sessionId);
    headers = headers.set('X-Client-Tab-Id', this.diagnostics.tabId);
    headers = headers.set('X-Client-Request-Id', this.diagnostics.newRequestId());
    headers = headers.set('X-Frontend-Version', this.diagnostics.frontendVersion);
    if (this._currentDraftId) {
      headers = headers.set('X-Client-Draft-Id', this._currentDraftId);
    }
    return headers;
  }

  private getCsrfToken(): string | null {
    const name = 'csrftoken';
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=', 2);
      if (key === name) return value;
    }
    return null;
  }

  private handleError(error: any) {
    let message = 'Произошла ошибка при выполнении запроса.';
    let code = 'unexpected_error';
    let fields: Record<string, string> | undefined;
    let currentVersion: number | undefined;
    let requestId: string | undefined;
    let status: string | undefined;
    let retrySafe: boolean | undefined;

    // Preserve the raw HTTP error body so submit-error surfaces can parse the
    // problem envelope (TZ-FRONTEND_OPERATION_SUBMIT_ERROR_SURFACE §4). Only
    // attach it when a body is present; network/timeout errors have none.
    const rawBody = error?.error;

    if (error.name === 'TimeoutError') {
      // Mutation-specific timeout → distinct operation_outcome_unknown
      return throwError(() => ({
        code: 'operation_outcome_unknown',
        message: 'Сервер не ответил вовремя. Результат операции неизвестен. Вы можете проверить статус в списке операций.',
        retry_safe: true,
      }));
    }

    if (error.error?.error) {
      const apiError = error.error as BffApiResponse<never>;
      message = apiError.error?.message ?? message;
      code = apiError.error?.code ?? code;
      fields = apiError.error?.fields;
      currentVersion = apiError.error?.current_version;
      requestId = apiError.error?.request_id;
      status = apiError.error?.status;
      retrySafe = apiError.error?.retry_safe;
    } else if (error.status === 0) {
      message = 'Сервер недоступен. Проверьте соединение.';
      code = 'syncserver_unavailable';
    } else if (error.status === 403) {
      message = 'Доступ запрещён.';
      code = 'forbidden';
    } else if (error.status === 404) {
      message = 'Ресурс не найден.';
      code = 'not_found';
    }

    return throwError(() => ({
      code,
      message,
      fields,
      current_version: currentVersion,
      request_id: requestId,
      status,
      retry_safe: retrySafe,
      raw: rawBody,
    }));
  }
}
