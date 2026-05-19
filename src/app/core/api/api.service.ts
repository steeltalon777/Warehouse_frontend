import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse } from '../models/nomenclature.models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = '/nomenclature/api';

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<ApiResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${path}`, {
      params: httpParams,
      withCredentials: true
    }).pipe(
      catchError(this.handleError)
    );
  }

  /** Convenience: unwrap data from ApiResponse */
  getData<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    return this.get<T>(path, params).pipe(
      map(res => res.data as T)
    );
  }

  post<T>(path: string, body?: unknown): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
      headers: this.getCsrfHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  patch<T>(path: string, body?: unknown): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
      headers: this.getCsrfHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  delete<T>(path: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.baseUrl}${path}`, {
      withCredentials: true,
      headers: this.getCsrfHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  private getCsrfHeaders(): HttpHeaders {
    const csrfToken = this.getCsrfToken();
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (csrfToken) {
      headers = headers.set('X-CSRFToken', csrfToken);
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

    if (error.error?.error) {
      const apiError = error.error as ApiResponse<never>;
      message = apiError.error?.message ?? message;
      code = apiError.error?.code ?? code;
      fields = apiError.error?.fields;
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

    return throwError(() => ({ code, message, fields, status: error.status }));
  }
}
