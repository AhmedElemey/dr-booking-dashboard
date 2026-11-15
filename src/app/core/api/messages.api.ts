import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { paramsOf, toPage } from './paging';
import { MaybePaged, MessagesQuery, OutboundMessage, PageResult } from './phase2.models';

/** whatsappReminders: the outbound message log (sms, whatsapp, push). */
@Injectable({ providedIn: 'root' })
export class MessagesApi {
  private readonly http = inject(HttpClient);

  list(query: MessagesQuery): Observable<PageResult<OutboundMessage>> {
    return this.http
      .get<MaybePaged<OutboundMessage>>(apiUrl('/dashboard/messages'), {
        params: paramsOf({ ...query }),
      })
      .pipe(map((raw) => toPage(raw, query.page ?? 1)));
  }
}
