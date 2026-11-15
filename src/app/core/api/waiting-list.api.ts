import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { paramsOf } from './paging';
import { WaitingListEntry, WaitingListQuery } from './phase2.models';

/** waitingList: `/dashboard/waiting-list`. */
@Injectable({ providedIn: 'root' })
export class WaitingListApi {
  private readonly http = inject(HttpClient);

  list(query: WaitingListQuery): Observable<WaitingListEntry[]> {
    return this.http.get<WaitingListEntry[]>(apiUrl('/dashboard/waiting-list'), {
      params: paramsOf({ ...query }),
    });
  }

  notify(id: string): Observable<{ notified: boolean }> {
    return this.http.post<{ notified: boolean }>(
      apiUrl(`/dashboard/waiting-list/${id}/notify`),
      {},
    );
  }
}
