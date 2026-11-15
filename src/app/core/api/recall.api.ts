import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { paramsOf, toPage } from './paging';
import {
  MaybePaged,
  PageResult,
  RecallCampaign,
  RecallCampaignRequest,
  RecallPreview,
  RecallSend,
  RecallSendResult,
} from './phase2.models';

/** recallCampaigns: CRUD, audience preview, send now, sends log. */
@Injectable({ providedIn: 'root' })
export class RecallApi {
  private readonly http = inject(HttpClient);
  private readonly base = apiUrl('/dashboard/recall-campaigns');

  list(): Observable<RecallCampaign[]> {
    return this.http.get<RecallCampaign[]>(this.base);
  }

  create(body: RecallCampaignRequest): Observable<RecallCampaign> {
    return this.http.post<RecallCampaign>(this.base, body);
  }

  update(id: string, body: RecallCampaignRequest): Observable<RecallCampaign> {
    return this.http.put<RecallCampaign>(`${this.base}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  preview(id: string): Observable<RecallPreview> {
    return this.http.post<RecallPreview>(`${this.base}/${id}/preview`, {});
  }

  sendNow(id: string): Observable<RecallSendResult> {
    return this.http.post<RecallSendResult>(`${this.base}/${id}/send-now`, {});
  }

  sends(id: string, page = 1) {
    return this.http
      .get<MaybePaged<RecallSend>>(`${this.base}/${id}/sends`, { params: paramsOf({ page }) })
      .pipe(map((raw) => toPage(raw, page))) as Observable<PageResult<RecallSend>>;
  }
}
