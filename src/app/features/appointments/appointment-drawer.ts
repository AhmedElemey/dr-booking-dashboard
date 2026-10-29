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
import { Observer, filter, switchMap } from 'rxjs';

import { AppointmentsApi } from '../../core/api/appointments.api';
import { DoctorsApi } from '../../core/api/doctors.api';
import { DashboardAppointment, Slot } from '../../core/api/models';
import { ToastService } from '../../core/http/toast.service';
import { Clock } from '../../core/time/clock';
import { addDays } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/confirm-dialog';
import { Drawer } from '../../shared/drawer';
import { SlotPicker } from '../../shared/slot-picker';
import { StatusChip } from '../../shared/status-chip';
import { availableActions } from './appointment-actions';

type Mode = 'view' | 'cancel' | 'reschedule';

/** Appointment detail with every status action: reschedule, cancel (with reason), complete, no-show. */
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

  protected readonly openSlots = signal<Slot[]>([]);
  protected readonly targetSlot = signal<Slot | null>(null);

  protected readonly actions = computed(() => {
    const a = this.appointment();
    return a ? availableActions(a.status, a.startsAt, this.clock.now()) : null;
  });
  protected readonly hasAnyAction = computed(() => {
    const actions = this.actions();
    return !!actions && Object.values(actions).some(Boolean);
  });
  protected readonly heading = computed(() => this.translate.instant('drawer.title'));

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
}
