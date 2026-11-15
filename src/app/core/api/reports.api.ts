import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { paramsOf } from './paging';
import { BookingsReport, ReportQuery, RevenueReport } from './phase2.models';

export type ReportKind = 'bookings' | 'revenue';

/** reports: JSON for the charts, `format=csv` for the download. */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);

  bookings(query: ReportQuery): Observable<BookingsReport> {
    return this.http.get<BookingsReport>(apiUrl('/dashboard/reports/bookings'), {
      params: paramsOf({ ...query }),
    });
  }

  revenue(query: ReportQuery): Observable<RevenueReport> {
    return this.http.get<RevenueReport>(apiUrl('/dashboard/reports/revenue'), {
      params: paramsOf({ ...query }),
    });
  }

  csv(kind: ReportKind, query: ReportQuery): Observable<Blob> {
    return this.http.get(apiUrl(`/dashboard/reports/${kind}`), {
      params: paramsOf({ ...query, format: 'csv' }),
      responseType: 'blob',
    });
  }
}
