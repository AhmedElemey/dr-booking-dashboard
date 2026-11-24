import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { interval } from 'rxjs';

import { AppointmentsApi } from '../../core/api/appointments.api';
import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor } from '../../core/api/models';
import { DashboardQueueEntry } from '../../core/api/phase2.models';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { Clock } from '../../core/time/clock';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { StatusChip } from '../../shared/status-chip';
import { availableActions } from '../appointments/appointment-actions';

/** The queue reloads by itself this often (ms) so it stays current without pressing refresh. */
export const QUEUE_REFRESH_MS = 30_000;

/** liveQueue: today's queue - with the doctor, checked-in by arrival, then upcoming. */
@Component({
  selector: 'app-queue',
  imports: [
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatIcon,
    MatProgressBar,
    StatusChip,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'queue.title' | translate }}</h1>
        <button mat-stroked-button type="button" (click)="load()">
          <mat-icon>refresh</mat-icon>{{ 'agenda.refresh' | translate }}
        </button>
      </div>
      <p class="muted intro">{{ 'queue.intro' | translate }}</p>

      @if (doctors().length > 1) {
        <div class="filters">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'agenda.doctor' | translate }}</mat-label>
            <mat-select [value]="doctorId()" (selectionChange)="doctorId.set($event.value)">
              <mat-option value="">{{ 'common.all' | translate }}</mat-option>
              @for (d of doctors(); track d.id) {
                <mat-option [value]="d.id">{{ doctorName(d) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      }

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (entries().length === 0 && !loading()) {
          <p class="empty-state">{{ 'queue.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{{ 'agenda.col.patient' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.phone' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.doctor' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.time' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.status' | translate }}</th>
                  <th scope="col">{{ 'queue.col.checkedIn' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (e of entries(); track e.appointment.id) {
                  <tr>
                    <td [attr.data-label]="'queue.col.position' | translate">
                      <strong>{{ e.position }}</strong>
                    </td>
                    <td [attr.data-label]="'agenda.col.patient' | translate">
                      <span dir="auto">{{ e.appointment.patient.fullName || '-' }}</span>
                      @if (e.appointment.familyMember; as m) {
                        <div class="muted small">
                          {{ 'waitingList.forMember' | translate: { name: m.fullName } }}
                        </div>
                      }
                    </td>
                    <td [attr.data-label]="'agenda.col.phone' | translate">
                      <span class="ltr-text">{{ e.appointment.patient.phone }}</span>
                    </td>
                    <td [attr.data-label]="'agenda.col.doctor' | translate">
                      <span dir="auto">{{ e.appointment.doctor.name }}</span>
                    </td>
                    <td [attr.data-label]="'agenda.col.time' | translate">
                      <span class="ltr-text">{{ clinicTime.time(e.appointment.startsAt) }}</span>
                    </td>
                    <td [attr.data-label]="'agenda.col.status' | translate">
                      <app-status-chip [status]="e.appointment.status" />
                    </td>
                    <td [attr.data-label]="'queue.col.checkedIn' | translate">
                      @if (e.appointment.checkedInAt) {
                        <span class="ltr-text">{{
                          clinicTime.time(e.appointment.checkedInAt)
                        }}</span>
                      } @else {
                        <span class="muted">-</span>
                      }
                    </td>
                    <td class="end">
                      @if (e.appointment.status === 'Confirmed') {
                        <button
                          mat-stroked-button
                          type="button"
                          [disabled]="busyId() === e.appointment.id"
                          (click)="checkIn(e)"
                        >
                          <mat-icon>how_to_reg</mat-icon>{{ 'queue.checkIn' | translate }}
                        </button>
                      }
                      @if (e.appointment.status === 'CheckedIn') {
                        <button
                          mat-stroked-button
                          type="button"
                          [disabled]="busyId() === e.appointment.id"
                          (click)="start(e)"
                        >
                          <mat-icon>play_arrow</mat-icon>{{ 'queue.start' | translate }}
                        </button>
                      }
                      @if (e.appointment.status === 'InProgress') {
                        <button
                          mat-stroked-button
                          type="button"
                          [disabled]="busyId() === e.appointment.id"
                          (click)="complete(e)"
                        >
                          <mat-icon>check_circle</mat-icon>{{ 'queue.complete' | translate }}
                        </button>
                      }
                      @if (canNoShow(e)) {
                        <button
                          mat-stroked-button
                          type="button"
                          [disabled]="busyId() === e.appointment.id"
                          (click)="noShow(e)"
                        >
                          <mat-icon>person_off</mat-icon>{{ 'queue.noShow' | translate }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .intro {
      margin-block: -8px 16px;
    }
    .small {
      font-size: 12px;
    }
  `,
})
export class Queue {
  private readonly api = inject(AppointmentsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly toast = inject(ToastService);
  private readonly languages = inject(LanguageService);
  private readonly clock = inject(Clock);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly doctorId = signal('');
  protected readonly entries = signal<DashboardQueueEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    this.doctorsApi.list().subscribe((d) => this.doctors.set(d));
    effect(() => {
      const doctorId = this.doctorId();
      this.load(doctorId);
    });
    // Refresh in the background: no progress bar, and a failed refresh keeps the list on screen.
    interval(QUEUE_REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load(this.doctorId(), true));
  }

  protected load(doctorId = this.doctorId(), background = false): void {
    if (!background) this.loading.set(true);
    this.api.queue(doctorId || undefined).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** "Didn't attend": a checked-in visit, or a confirmed one whose time has come. */
  protected canNoShow(entry: DashboardQueueEntry): boolean {
    const { status, startsAt } = entry.appointment;
    return availableActions(status, startsAt, this.clock.now()).noShow;
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected checkIn(entry: DashboardQueueEntry): void {
    this.act(entry, 'checkIn', 'queue.checkedIn');
  }

  protected start(entry: DashboardQueueEntry): void {
    this.act(entry, 'start', 'queue.started');
  }

  protected complete(entry: DashboardQueueEntry): void {
    this.act(entry, 'complete', 'queue.completed');
  }

  protected noShow(entry: DashboardQueueEntry): void {
    this.act(entry, 'noShow', 'queue.noShowDone');
  }

  private act(
    entry: DashboardQueueEntry,
    action: 'checkIn' | 'start' | 'complete' | 'noShow',
    toastKey: string,
  ): void {
    const id = entry.appointment.id;
    this.busyId.set(id);
    this.api[action](id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success(toastKey);
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }
}
