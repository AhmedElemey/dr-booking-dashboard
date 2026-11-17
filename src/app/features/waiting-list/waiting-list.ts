import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor } from '../../core/api/models';
import { WaitingListEntry, WaitingStatus } from '../../core/api/phase2.models';
import { WaitingListApi } from '../../core/api/waiting-list.api';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ClinicTime } from '../../core/time/clinic-time.service';

const STATUSES: WaitingStatus[] = ['Waiting', 'Notified', 'Booked', 'Cancelled', 'Expired'];

/** waitingList: patients waiting for a slot on a day; filter by doctor, date and status; notify. */
@Component({
  selector: 'app-waiting-list',
  imports: [
    FormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
    MatProgressBar,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'waitingList.title' | translate }}</h1>
      </div>
      <p class="muted intro">{{ 'waitingList.intro' | translate }}</p>

      <div class="filters">
        @if (doctors().length > 1) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'agenda.doctor' | translate }}</mat-label>
            <mat-select [value]="doctorId()" (selectionChange)="doctorId.set($event.value)">
              <mat-option value="">{{ 'common.all' | translate }}</mat-option>
              @for (d of doctors(); track d.id) {
                <mat-option [value]="d.id">{{ doctorName(d) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'waitingList.date' | translate }}</mat-label>
          <input matInput type="date" [ngModel]="date()" (ngModelChange)="date.set($event)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'agenda.status' | translate }}</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value)">
            <mat-option value="">{{ 'common.all' | translate }}</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ 'waitingList.status.' + s | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (date()) {
          <button mat-button type="button" (click)="date.set('')">
            {{ 'waitingList.clearDate' | translate }}
          </button>
        }
      </div>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (entries().length === 0 && !loading()) {
          <p class="empty-state">{{ 'waitingList.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'waitingList.col.patient' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.phone' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.doctor' | translate }}</th>
                  <th scope="col">{{ 'waitingList.date' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.status' | translate }}</th>
                  <th scope="col">{{ 'waitingList.col.notified' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (e of entries(); track e.id) {
                  <tr>
                    <td>
                      <span dir="auto">{{ e.patient.fullName || '-' }}</span>
                      @if (e.familyMember; as m) {
                        <div class="muted small">
                          {{ 'waitingList.forMember' | translate: { name: m.fullName } }}
                        </div>
                      }
                    </td>
                    <td>
                      <span class="ltr-text">{{ e.patient.phone }}</span>
                    </td>
                    <td dir="auto">{{ e.doctor.name }}</td>
                    <td>{{ clinicTime.keyLabel(e.date, 'ccc d LLL yyyy') }}</td>
                    <td>
                      <span class="pill" [class]="'pill ' + tone(e.status)">{{
                        'waitingList.status.' + e.status | translate
                      }}</span>
                    </td>
                    <td>
                      @if (e.notifiedAt) {
                        {{ clinicTime.date(e.notifiedAt) }}
                        <span class="ltr-text">{{ clinicTime.time(e.notifiedAt) }}</span>
                      } @else {
                        <span class="muted">-</span>
                      }
                    </td>
                    <td class="end">
                      @if (e.status === 'Waiting' || e.status === 'Notified') {
                        <button
                          mat-stroked-button
                          type="button"
                          [disabled]="busyId() === e.id"
                          (click)="notify(e)"
                        >
                          <mat-icon>notifications_active</mat-icon
                          >{{ 'waitingList.notify' | translate }}
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
export class WaitingList {
  private readonly api = inject(WaitingListApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly toast = inject(ToastService);
  private readonly languages = inject(LanguageService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly statuses = STATUSES;
  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly doctorId = signal('');
  protected readonly date = signal('');
  protected readonly status = signal<WaitingStatus | ''>('');
  protected readonly entries = signal<WaitingListEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    this.doctorsApi.list().subscribe((d) => this.doctors.set(d));
    effect(() => {
      const query = { doctorId: this.doctorId(), date: this.date(), status: this.status() };
      this.load(query);
    });
  }

  private load(query = { doctorId: this.doctorId(), date: this.date(), status: this.status() }) {
    this.loading.set(true);
    this.api.list(query).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected tone(status: WaitingStatus): string {
    return { Waiting: 'info', Notified: 'warn', Booked: 'ok', Cancelled: '', Expired: '' }[status];
  }

  protected notify(entry: WaitingListEntry): void {
    this.busyId.set(entry.id);
    this.api.notify(entry.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.toast.success('waitingList.notified');
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }
}
