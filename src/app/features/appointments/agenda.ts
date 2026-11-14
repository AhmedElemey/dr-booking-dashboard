import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EMPTY, Subject, catchError, merge, switchMap, tap, timer } from 'rxjs';

import { AppointmentsApi } from '../../core/api/appointments.api';
import { DoctorsApi } from '../../core/api/doctors.api';
import { AppointmentStatus, DashboardAppointment, Doctor } from '../../core/api/models';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { addDays, dateRange, startOfWeek } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { StatusChip } from '../../shared/status-chip';
import { AppointmentDrawer } from './appointment-drawer';

export const AGENDA_REFRESH_MS = 60_000;

const STATUSES: AppointmentStatus[] = ['Confirmed', 'Completed', 'NoShow', 'Cancelled'];

interface DayGroup {
  key: string;
  items: DashboardAppointment[];
}

/** Today / agenda: appointments for a day or week, filterable, refreshed every 60 seconds. */
@Component({
  selector: 'app-agenda',
  imports: [
    FormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
    MatIcon,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatProgressBar,
    TranslatePipe,
    StatusChip,
    AppointmentDrawer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda.html',
  styleUrl: './agenda.scss',
})
export class Agenda {
  private readonly api = inject(AppointmentsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly languages = inject(LanguageService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly statuses = STATUSES;

  protected readonly view = signal<'day' | 'week'>('day');
  protected readonly anchor = signal(this.clinicTime.today());
  protected readonly doctorId = signal<string>('');
  protected readonly status = signal<AppointmentStatus | ''>('');

  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly items = signal<DashboardAppointment[]>([]);
  protected readonly loading = signal(true);
  protected readonly selectedId = signal<string | null>(null);

  private readonly manualRefresh$ = new Subject<void>();

  protected readonly range = computed(() => {
    const anchor = this.anchor();
    if (this.view() === 'day') return { from: anchor, to: anchor };
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  });

  protected readonly rangeLabel = computed(() => {
    const { from, to } = this.range();
    return this.view() === 'day'
      ? this.clinicTime.keyLabel(from, 'cccc, d LLLL yyyy')
      : `${this.clinicTime.keyLabel(from, 'd LLL')} - ${this.clinicTime.keyLabel(to, 'd LLL yyyy')}`;
  });

  protected readonly isToday = computed(() => {
    const { from, to } = this.range();
    const today = this.clinicTime.today();
    return from <= today && today <= to;
  });

  protected readonly groups = computed<DayGroup[]>(() => {
    const { from, to } = this.range();
    const byDay = new Map<string, DashboardAppointment[]>();
    for (const a of this.items()) {
      const key = this.clinicTime.dateKey(a.startsAt, a.timezone);
      byDay.set(key, [...(byDay.get(key) ?? []), a]);
    }
    const keys = this.view() === 'day' ? [from] : dateRange(from, to);
    return keys
      .map((key) => ({ key, items: byDay.get(key) ?? [] }))
      .filter((g) => this.view() === 'day' || g.items.length > 0);
  });

  protected readonly counts = computed(() => {
    const counts: Record<AppointmentStatus, number> = {
      Confirmed: 0,
      Completed: 0,
      NoShow: 0,
      Cancelled: 0,
    };
    for (const a of this.items()) counts[a.status]++;
    return counts;
  });

  constructor() {
    this.doctorsApi.list().subscribe((doctors) => this.doctors.set(doctors));

    const query$ = toObservable(
      computed(() => ({
        ...this.range(),
        doctorId: this.doctorId() || undefined,
        status: this.status() || undefined,
      })),
    );

    query$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((query) =>
          merge(timer(0, AGENDA_REFRESH_MS), this.manualRefresh$).pipe(
            switchMap(() => this.api.list(query).pipe(catchError(() => EMPTY))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.items.set(page.items);
        this.loading.set(false);
      });
  }

  protected doctorName(doctor: Doctor): string {
    return localized(this.languages.language(), doctor.nameAr, doctor.nameEn);
  }

  protected shift(direction: 1 | -1): void {
    this.anchor.update((key) => addDays(key, direction * (this.view() === 'day' ? 1 : 7)));
  }

  protected today(): void {
    this.anchor.set(this.clinicTime.today());
  }

  protected setAnchor(key: string): void {
    if (key) this.anchor.set(key);
  }

  protected refresh(): void {
    this.manualRefresh$.next();
  }
}
