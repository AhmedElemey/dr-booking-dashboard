import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { apiUrl } from '../config/api-url';
import { Clinic, UpdateClinicRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ClinicApi {
  private readonly http = inject(HttpClient);

  get(): Observable<Clinic> {
    return this.http.get<Clinic>(apiUrl('/dashboard/clinic'));
  }

  update(body: UpdateClinicRequest): Observable<Clinic> {
    return this.http.put<Clinic>(apiUrl('/dashboard/clinic'), body);
  }
}
