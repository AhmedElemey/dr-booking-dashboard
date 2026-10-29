import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { ClinicApi } from '../api/clinic.api';
import { LanguageService } from '../i18n/language.service';
import { Clock } from './clock';
import {
  DEFAULT_CLINIC_TZ,
  dateKeyOf,
  formatDate,
  formatDateKey,
  formatDateLong,
  formatRange,
  formatTime,
  todayKey,
} from './clinic-time';

/**
 * Holds the clinic timezone (from `GET /dashboard/clinic`) and formats instants with it, in the
 * current UI language. Components use this instead of formatting dates themselves.
 */
@Injectable({ providedIn: 'root' })
export class ClinicTime {
  private readonly clinicApi = inject(ClinicApi);
  private readonly languages = inject(LanguageService);
  private readonly clock = inject(Clock);

  readonly timezone = signal(DEFAULT_CLINIC_TZ);

  /** Loads the clinic's timezone; keeps the default if the user has no clinic (admin). */
  load(): Observable<string> {
    return this.clinicApi.get().pipe(
      tap((clinic) => this.timezone.set(clinic.timezone || DEFAULT_CLINIC_TZ)),
      map((clinic) => clinic.timezone),
      catchError(() => of(this.timezone())),
    );
  }

  private get lang() {
    return this.languages.language();
  }

  time(iso: string, tz = this.timezone()): string {
    return formatTime(iso, tz, this.lang);
  }

  date(iso: string, tz = this.timezone()): string {
    return formatDate(iso, tz, this.lang);
  }

  dateLong(iso: string, tz = this.timezone()): string {
    return formatDateLong(iso, tz, this.lang);
  }

  range(startIso: string, endIso: string, tz = this.timezone()): string {
    return formatRange(startIso, endIso, tz, this.lang);
  }

  dateKey(iso: string, tz = this.timezone()): string {
    return dateKeyOf(iso, tz);
  }

  keyLabel(key: string, pattern = 'ccc d LLL'): string {
    return formatDateKey(key, pattern, this.lang);
  }

  today(): string {
    return todayKey(this.timezone(), this.clock.now());
  }
}
