import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { toPage, paramsOf } from './paging';
import { DashboardPayment, MaybePaged, PageResult, PaymentsQuery } from './phase2.models';

/** onlinePayments: `/dashboard/payments`, mark-paid and refund. */
@Injectable({ providedIn: 'root' })
export class PaymentsApi {
  private readonly http = inject(HttpClient);

  list(query: PaymentsQuery): Observable<PageResult<DashboardPayment>> {
    return this.http
      .get<MaybePaged<DashboardPayment>>(apiUrl('/dashboard/payments'), {
        params: paramsOf({ ...query }),
      })
      .pipe(map((raw) => toPage(raw)));
  }

  /** Cash payment recorded at the desk. */
  markPaid(appointmentId: string): Observable<DashboardPayment | null> {
    return this.http.post<DashboardPayment | null>(
      apiUrl(`/dashboard/appointments/${appointmentId}/mark-paid`),
      {},
    );
  }

  refund(paymentId: string): Observable<DashboardPayment | null> {
    return this.http.post<DashboardPayment | null>(
      apiUrl(`/dashboard/payments/${paymentId}/refund`),
      {},
    );
  }
}
