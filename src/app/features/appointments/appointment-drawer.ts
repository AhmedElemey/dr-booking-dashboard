import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observer, filter, map, switchMap } from 'rxjs';

import { AppointmentsApi } from '../../core/api/appointments.api';
import { AuthService } from '../../core/auth/auth.service';
import { DoctorsApi } from '../../core/api/doctors.api';
import { InsuranceApi } from '../../core/api/insurance.api';
import { DashboardAppointment, PaymentStatus, Slot } from '../../core/api/models';
import { PaymentsApi } from '../../core/api/payments.api';
import { FeaturesService } from '../../core/config/features.service';
import { egp } from '../../core/util/format';
import { Rating } from '../../shared/rating';
import { ToastService } from '../../core/http/toast.service';
import { Clock } from '../../core/time/clock';
import { addDays } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';
import { Drawer } from '../../shared/drawer';
import { SlotPicker } from '../../shared/slot-picker';
import { StatusChip } from '../../shared/status-chip';
import { availableActions } from './appointment-actions';

/** Only https links are opened (the host link comes from the API; defence in depth). */
export function isHttpsUrl(value: string | null | undefined): boolean {
  try {
    return !!value && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

type Mode = 'view' | 'cancel' | 'reschedule' | 'reject' | 'correct';

/** Appointment detail with every status action: approve/reject (Pending), reschedule, cancel (with reason), complete, no-show. */
@Component({
  selector: 'app-appointment-drawer',
  imports: [
    FormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatIcon,
    MatProgressSpinner,
    TranslatePipe,
    Drawer,
    SlotPicker,
    StatusChip,
    Rating,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './appointment-drawer.html',
  styleUrl: './appointment-drawer.scss',
})
export class AppointmentDrawer implements OnInit {
  private readonly api = inject(AppointmentsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(Clock);
  private readonly translate = inject(TranslateService);
  private readonly paymentsApi = inject(PaymentsApi);
  private readonly insuranceApi = inject(InsuranceApi);
  private readonly auth = inject(AuthService);
  protected readonly features = inject(FeaturesService);
  protected readonly clinicTime = inject(ClinicTime);

  readonly appointmentId = input.required<string>();
  /** Emitted after any successful change so the parent can refresh its list. */
  readonly changed = output<void>();
  readonly closed = output<void>();

  protected readonly appointment = signal<DashboardAppointment | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly mode = signal<Mode>('view');
  protected cancelReason = '';
  protected rejectReason = '';
  protected insuranceNote = '';
  protected correctReason = '';
  protected readonly correctTarget = signal<'Completed' | 'NoShow' | null>(null);

  protected readonly openSlots = signal<Slot[]>([]);
  protected readonly targetSlot = signal<Slot | null>(null);

  protected readonly actions = computed(() => {
    const a = this.appointment();
    if (!a) return null;
    const actions = availableActions(a.status, a.startsAt, a.endsAt, this.clock.now());
    // Only a clinic admin or the visit's own doctor may correct a closed visit (the server enforces it too).
    return this.canCorrect() ? actions : { ...actions, correct: null };
  });
  private readonly canCorrect = computed(
    () => this.auth.role() === 'Doctor' || this.auth.user()?.isClinicAdmin === true,
  );
  protected readonly hasAnyAction = computed(() => {
    const actions = this.actions();
    return !!actions && Object.values(actions).some(Boolean);
  });
  protected readonly heading = computed(() => this.translate.instant('drawer.title'));

  /** Whether a "Mark paid" (cash) action applies. */
  protected readonly canMarkPaid = computed(() => {
    const a = this.appointment();
    const status: PaymentStatus = a?.paymentStatus ?? 'Unpaid';
    return (
      !!a &&
      a.status !== 'Cancelled' &&
      (status === 'Unpaid' || status === 'Pending') &&
      (a.totalEgp ?? 0) > 0
    );
  });

  /** Refunds are for clinic staff only: the API answers 403 to a doctor. */
  protected readonly canRefund = computed(
    () =>
      this.auth.role() === 'ClinicStaff' &&
      ['Paid', 'DepositPaid'].includes(this.appointment()?.paymentStatus ?? ''),
  );

  /** Deposit paid online; what is left is settled at the clinic. */
  protected readonly depositBalance = computed(() => {
    const a = this.appointment();
    return a && (a.depositPaidEgp ?? 0) > 0
      ? Math.max(0, (a.totalEgp ?? 0) - (a.depositPaidEgp ?? 0))
      : null;
  });

  protected readonly showVideoJoin = computed(() => {
    const a = this.appointment();
    return !!a && a.mode === 'Video' && a.status === 'Confirmed';
  });

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.get(this.appointmentId()).subscribe({
      next: (appointment) => {
        this.appointment.set(appointment);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.closed.emit();
      },
    });
  }

  // ---- actions ----

  /** Approve a Pending booking: straight through, no confirm dialog (nothing is lost). */
  protected approve(): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.busy.set(true);
    this.api.approve(appointment.id).subscribe(this.afterChange('drawer.approved'));
  }

  protected startReject(): void {
    this.rejectReason = '';
    this.mode.set('reject');
  }

  protected submitReject(): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.busy.set(true);
    this.api
      .reject(appointment.id, this.rejectReason.trim())
      .subscribe(this.afterChange('drawer.rejected'));
  }

  protected confirmAndRun(kind: 'complete' | 'noShow', titleKey: string, messageKey: string): void {
    const appointment = this.appointment();
    if (!appointment) return;
    const data: ConfirmDialogData = { titleKey, messageKey, confirmKey: titleKey };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => {
          this.busy.set(true);
          return kind === 'complete'
            ? this.api.complete(appointment.id)
            : this.api.noShow(appointment.id);
        }),
      )
      .subscribe(this.afterChange('drawer.updated'));
  }

  protected startCorrect(target: 'Completed' | 'NoShow'): void {
    this.correctTarget.set(target);
    this.correctReason = '';
    this.mode.set('correct');
  }

  protected submitCorrect(): void {
    const appointment = this.appointment();
    const target = this.correctTarget();
    if (!appointment || !target) return;
    this.busy.set(true);
    this.api
      .correctStatus(appointment.id, target, this.correctReason.trim())
      .subscribe(this.afterChange('drawer.corrected'));
  }

  protected startCancel(): void {
    this.cancelReason = '';
    this.mode.set('cancel');
  }

  protected submitCancel(): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.busy.set(true);
    this.api
      .cancel(appointment.id, this.cancelReason.trim())
      .subscribe(this.afterChange('drawer.cancelled'));
  }

  protected startReschedule(): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.mode.set('reschedule');
    this.targetSlot.set(null);
    this.loadOpenSlots(appointment.doctor.id);
  }

  private loadOpenSlots(doctorId: string): void {
    const today = this.clinicTime.today();
    this.doctorsApi
      .slots(doctorId, { from: today, to: addDays(today, 13), status: 'Open' })
      .subscribe((slots) => this.openSlots.set(slots));
  }

  protected submitReschedule(): void {
    const appointment = this.appointment();
    const target = this.targetSlot();
    if (!appointment || !target) return;
    this.busy.set(true);
    this.api
      .reschedule(appointment.id, target.id)
      .subscribe(this.afterChange('drawer.rescheduled'));
  }

  protected back(): void {
    this.mode.set('view');
  }

  /** Shared observer: toast + refresh on success; resync with the server on failure. */
  private afterChange(successKey: string): Partial<Observer<unknown>> {
    return {
      next: () => {
        this.busy.set(false);
        this.mode.set('view');
        this.toast.success(successKey);
        this.refetch();
      },
      error: () => {
        this.busy.set(false);
        // The slot or status may have changed under us (SLOT_TAKEN, INVALID_TRANSITION).
        const current = this.appointment();
        if (this.mode() === 'reschedule' && current) this.loadOpenSlots(current.doctor.id);
        this.refetch();
      },
    };
  }

  /** Reloads the detail (the action endpoints' bodies are not relied upon) and tells the parent. */
  private refetch(): void {
    this.api.get(this.appointmentId()).subscribe((fresh) => {
      this.appointment.set(fresh);
      this.changed.emit();
    });
  }

  // ---- phase 2 actions ----

  protected money(value: number | null | undefined): string {
    return egp(value);
  }

  /** videoConsultation: opens the host link; the API refuses (VIDEO_NOT_OPEN) outside the window. */
  protected joinVideo(): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.busy.set(true);
    this.api.video(appointment.id).subscribe({
      next: (link) => {
        this.busy.set(false);
        if (isHttpsUrl(link.joinUrl)) window.open(link.joinUrl, '_blank', 'noopener');
        else this.toast.failure('drawer.videoLinkInvalid');
      },
      error: () => this.busy.set(false),
    });
  }

  protected markPaid(): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.busy.set(true);
    // The API answers with the updated appointment, so the drawer can use it directly.
    this.paymentsApi.markPaid(appointment.id).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.toast.success('drawer.paidMarked');
        this.appointment.set(updated);
        this.changed.emit();
      },
      error: () => {
        this.busy.set(false);
        this.refetch();
      },
    });
  }

  protected refund(): void {
    const appointment = this.appointment();
    if (!appointment) return;
    const data: ConfirmDialogData = {
      titleKey: 'payments.refundTitle',
      messageKey: 'drawer.refundMessage',
      messageParams: { amount: egp(appointment.totalEgp) },
      confirmKey: 'payments.refund',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => {
          this.busy.set(true);
          return this.paymentIdOf(appointment);
        }),
        switchMap((paymentId) => {
          if (!paymentId) throw new Error('payment-not-found');
          return this.paymentsApi.refund(paymentId);
        }),
      )
      .subscribe({
        ...this.afterChange('drawer.refunded'),
        error: (e) => {
          this.busy.set(false);
          if (e instanceof Error) this.toast.failure('drawer.paymentNotFound');
          this.refetch();
        },
      });
  }

  /**
   * The API's appointment payload has no payment id, so look the Paid payment up. `from`/`to`
   * filter on the payment's creation date, which is normally close to the visit.
   */
  private paymentIdOf(a: DashboardAppointment) {
    const day = this.clinicTime.dateKey(a.startsAt, a.timezone);
    return this.paymentsApi
      .list({ from: addDays(day, -365), to: addDays(day, 60), status: 'Paid' })
      .pipe(map((page) => page.items.find((p) => p.appointmentId === a.id)?.id ?? null));
  }

  protected decideInsurance(status: 'Approved' | 'Rejected'): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.busy.set(true);
    this.insuranceApi
      .decide(appointment.id, status, this.insuranceNote.trim() || null)
      .subscribe(
        this.afterChange(
          status === 'Approved' ? 'drawer.insuranceApproved' : 'drawer.insuranceRejected',
        ),
      );
  }
}
