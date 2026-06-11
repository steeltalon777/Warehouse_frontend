import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { BffApiService } from '../api/bff-api.service';
import { OperationWaybillOpenResult } from '../models/documents.models';

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  constructor(private bff: BffApiService) {}

  openOperationWaybill(operationId: string): Observable<OperationWaybillOpenResult> {
    const encodedId = encodeURIComponent(operationId);
    return this.bff.postData<OperationWaybillOpenResult>(`/documents/operations/${encodedId}/waybill/open`, {});
  }
}
