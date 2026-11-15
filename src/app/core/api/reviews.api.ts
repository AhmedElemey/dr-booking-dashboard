import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { paramsOf, toPage } from './paging';
import { DashboardReview, MaybePaged, PageResult, ReviewsQuery } from './phase2.models';

/** reviews: moderation. */
@Injectable({ providedIn: 'root' })
export class ReviewsApi {
  private readonly http = inject(HttpClient);

  list(query: ReviewsQuery): Observable<PageResult<DashboardReview>> {
    return this.http
      .get<MaybePaged<DashboardReview>>(apiUrl('/dashboard/reviews'), {
        params: paramsOf({ ...query }),
      })
      .pipe(map((raw) => toPage(raw, query.page ?? 1)));
  }

  hide(id: string): Observable<DashboardReview | null> {
    return this.http.post<DashboardReview | null>(apiUrl(`/dashboard/reviews/${id}/hide`), {});
  }

  publish(id: string): Observable<DashboardReview | null> {
    return this.http.post<DashboardReview | null>(apiUrl(`/dashboard/reviews/${id}/publish`), {});
  }

  reply(id: string, reply: string): Observable<DashboardReview | null> {
    return this.http.put<DashboardReview | null>(apiUrl(`/dashboard/reviews/${id}/reply`), {
      reply,
    });
  }
}
