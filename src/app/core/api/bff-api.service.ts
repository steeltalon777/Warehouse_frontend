import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface BffApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
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

  constructor(private http: HttpClient) {}

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
      headers: this.getCsrfHeaders()
    }).pipe(catchError(this.handleError));
  }

  postData<T>(path: string, body?: unknown): Observable<T> {
    return this.post<T>(path, body).pipe(map(res => res.data as T));
  }

  put<T>(path: string, body?: unknown): Observable<BffApiResponse<T>> {
    return this.http.put<BffApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
      headers: this.getCsrfHeaders()
    }).pipe(catchError(this.handleError));
  }

  putData<T>(path: string, body?: unknown): Observable<T> {
    return this.put<T>(path, body).pipe(map(res => res.data as T));
  }

  patch<T>(path: string, body?: unknown): Observable<BffApiResponse<T>> {
    return this.http.patch<BffApiResponse<T>>(`${this.baseUrl}${path}`, body ?? {}, {
      withCredentials: true,
      headers: this.getCsrfHeaders()
    }).pipe(catchError(this.handleError));
  }

  patchData<T>(path: string, body?: unknown): Observable<T> {
    return this.patch<T>(path, body).pipe(map(res => res.data as T));
  }

  delete<T>(path: string): Observable<BffApiResponse<T>> {
    return this.http.delete<BffApiResponse<T>>(`${this.baseUrl}${path}`, {
      withCredentials: true,
      headers: this.getCsrfHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteData<T>(path: string): Observable<T> {
    return this.delete<T>(path).pipe(map(res => res.data as T));
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
      const apiError = error.error as BffApiResponse<never>;
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
