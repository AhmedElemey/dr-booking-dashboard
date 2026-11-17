import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor } from '../../core/api/models';
import { PaymentsApi } from '../../core/api/payments.api';
import { DashboardPayment, PaymentRecordStatus } from '../../core/api/phase2.models';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { addDays } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { egp } from '../../core/util/format';
import { ConfirmDialog } from '../../shared/confirm-dialog';

const STATUSES: PaymentRecordStatus[] = ['Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled'];

/** onlinePayments: payment list with filters and refund. */
@Component({
  selector: 'app-payments',
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
        <h1>{{ 'payments.title' | translate }}</h1>
      </div>

      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'payments.from' | translate }}</mat-label>
          <input matInput type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'payments.to' | translate }}</mat-label>
          <input matInput type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'agenda.status' | translate }}</mat-label>
          <mat-select [value]="status()" (selectionChange)="status.set($event.value)">
            <mat-option value="">{{ 'common.all' | translate }}</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ 'payments.status.' + s | translate }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
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
        <span class="grow"></span>
        <p class="total">
          {{ 'payments.collected' | translate }}:
          <strong class="num">{{ collected() }} {{ 'common.egp' | translate }}</strong>
        </p>
      </div>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (payments().length === 0 && !loading()) {
          <p class="empty-state">{{ 'payments.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'payments.col.date' | translate }}</th>
                  <th scope="col">{{ 'payments.col.patient' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.doctor' | translate }}</th>
                  <th scope="col">{{ 'payments.col.method' | translate }}</th>
                  <th scope="col">{{ 'payments.col.amount' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.status' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (p of payments(); track p.id) {
                  <tr>
                    <td>
                      {{ clinicTime.date(p.paidAt || p.createdAt) }}
                      <span class="ltr-text muted">{{
                        clinicTime.time(p.paidAt || p.createdAt)
                      }}</span>
                    </td>
                    <td dir="auto">{{ p.patient?.fullName || '-' }}</td>
                    <td dir="auto">{{ p.doctor?.name || '-' }}</td>
                    <td>{{ 'payments.method.' + p.method | translate }}</td>
                    <td class="num">{{ amount(p.amountEgp) }} {{ 'common.egp' | translate }}</td>
                    <td>
                      <span class="pill" [class]="'pill ' + tone(p.status)">{{
                        'payments.status.' + p.status | translate
                      }}</span>
                    </td>
                    <td class="end">
                      @if (p.status === 'Paid' && canRefund()) {
                        <button
                          mat-stroked-button
                          type="button"
                          class="danger-outline"
                          [disabled]="busyId() === p.id"
                          (click)="refund(p)"
                        >
                          <mat-icon>undo</mat-icon>{{ 'payments.refund' | translate }}
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
    .grow {
      flex: 1;
    }
    .total {
      margin: 0;
    }
    .danger-outline {
      --mat-button-outlined-label-text-color: #b3261e;
      --mat-button-outlined-outline-color: #b3261e;
    }
  `,
})
export class Payments {
  private readonly api = inject(PaymentsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly languages = inject(LanguageService);
  protected readonly clinicTime = inject(ClinicTime);

  private readonly auth = inject(AuthService);
  /** Refunds are for clinic staff only: the API answers 403 to a doctor. */
  protected readonly canRefund = computed(() => this.auth.role() === 'ClinicStaff');

  protected readonly statuses = STATUSES;
  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly from = signal(addDays(this.clinicTime.today(), -29));
  protected readonly to = signal(this.clinicTime.today());
  protected readonly status = signal<PaymentRecordStatus | ''>('');
  protected readonly doctorId = signal('');
  protected readonly payments = signal<DashboardPayment[]>([]);
  protected readonly loading = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected readonly collected = computed(() =>
    egp(
      this.payments()
        .filter((p) => p.status === 'Paid')
        .reduce((sum, p) => sum + p.amountEgp, 0),
    ),
  );

  constructor() {
    this.doctorsApi.list().subscribe((d) => this.doctors.set(d));
    effect(() => {
      const query = {
        from: this.from(),
        to: this.to(),
        status: this.status(),
        doctorId: this.doctorId(),
      };
      if (query.from && query.to) this.load(query);
    });
  }

  private load(
    query = {
      from: this.from(),
      to: this.to(),
      status: this.status(),
      doctorId: this.doctorId(),
    },
  ): void {
    this.loading.set(true);
    this.api.list(query).subscribe({
      next: (page) => {
        this.payments.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected amount(value: number): string {
    return egp(value);
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected tone(status: PaymentRecordStatus): string {
    return { Paid: 'ok', Pending: 'info', Failed: 'bad', Refunded: 'warn', Cancelled: '' }[status];
  }

  protected refund(payment: DashboardPayment): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'payments.refundTitle',
          messageKey: 'payments.refundMessage',
          messageParams: { amount: egp(payment.amountEgp), name: payment.patient?.fullName ?? '' },
          confirmKey: 'payments.refund',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => {
          this.busyId.set(payment.id);
          return this.api.refund(payment.id);
        }),
      )
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.toast.success('payments.refunded');
          this.load();
        },
        error: () => {
          this.busyId.set(null);
          this.load();
        },
      });
  }
}
