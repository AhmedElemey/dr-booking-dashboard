import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { Coupon, CouponRedemption, CouponRequest } from './phase2.models';

/** promotions: coupons CRUD and redemptions. */
@Injectable({ providedIn: 'root' })
export class CouponsApi {
  private readonly http = inject(HttpClient);
  private readonly base = apiUrl('/dashboard/coupons');

  list(): Observable<Coupon[]> {
    return this.http.get<Coupon[]>(this.base);
  }

  create(body: CouponRequest): Observable<Coupon> {
    return this.http.post<Coupon>(this.base, body);
  }

  update(id: string, body: CouponRequest): Observable<Coupon> {
    return this.http.put<Coupon>(`${this.base}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  redemptions(id: string): Observable<CouponRedemption[]> {
    return this.http.get<CouponRedemption[]>(`${this.base}/${id}/redemptions`);
  }
}
