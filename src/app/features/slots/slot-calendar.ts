import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, forkJoin, switchMap } from 'rxjs';

import { DoctorsApi } from '../../core/api/doctors.api';
import { HolidaysApi } from '../../core/api/holidays.api';
import { Holiday } from '../../core/api/phase2.models';
import { AuthService } from '../../core/auth/auth.service';
import { FeaturesService } from '../../core/config/features.service';
import { Doctor, Service, Slot, SlotStatus } from '../../core/api/models';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { Clock } from '../../core/time/clock';
import { addDays, dateRange, startOfWeek } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { AppointmentDrawer } from '../appointments/appointment-drawer';
import { AddSlotDialog } from './add-slot-dialog';
import { ApplyTemplateDialog } from './apply-template-dialog';
import { BulkDialog } from './bulk-dialog';

interface Column {
  key: string;
  slots: Slot[];
  /** Name of the clinic holiday on this day (holidayCalendar), if any. */
  holiday?: string;
}

const STATUSES: SlotStatus[] = ['Open', 'Reserved', 'Blocked'];

/** Day/week slot calendar for one doctor: Open / Reserved / Blocked slots in the clinic timezone. */
@Component({
  selector: 'app-slot-calendar',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    MatMenuModule,
    MatProgressBar,
    TranslatePipe,
    AppointmentDrawer,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './slot-calendar.html',
  styleUrl: './slot-calendar.scss',
})
export class SlotCalendar {
  private readonly api = inject(DoctorsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly clock = inject(Clock);
  private readonly languages = inject(LanguageService);
  private readonly holidaysApi = inject(HolidaysApi);
  private readonly auth = inject(AuthService);
  protected readonly features = inject(FeaturesService);
  protected readonly clinicTime = inject(ClinicTime);

  /** Optional `?doctorId=` query parameter. */
  readonly doctorId = input<string>();

  protected readonly legend = STATUSES;
  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly selectedDoctorId = signal<string | null>(null);
  protected readonly services = signal<Service[]>([]);
  protected readonly view = signal<'day' | 'week'>('week');
  protected readonly anchor = signal(this.clinicTime.today());
  protected readonly slots = signal<Slot[]>([]);
  protected readonly loading = signal(false);
  private readonly holidays = signal<Holiday[]>([]);
  protected readonly drawerAppointmentId = signal<string | null>(null);

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

  protected readonly columns = computed<Column[]>(() => {
    const { from, to } = this.range();
    const byDay = new Map<string, Slot[]>();
    for (const slot of [...this.slots()].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const key = this.clinicTime.dateKey(slot.startsAt);
      byDay.set(key, [...(byDay.get(key) ?? []), slot]);
    }
    const holidayByDay = new Map(
      this.holidays().map((h) => [
        h.date,
        localized(this.languages.language(), h.nameAr, h.nameEn),
      ]),
    );
    return dateRange(from, to).map((key) => ({
      key,
      slots: byDay.get(key) ?? [],
      holiday: holidayByDay.get(key),
    }));
  });

  constructor() {
    this.api.list().subscribe((doctors) => {
      this.doctors.set(doctors);
      const wanted = this.doctorId();
      const initial = doctors.find((d) => d.id === wanted) ?? doctors[0];
      if (initial) this.selectedDoctorId.set(initial.id);
    });

    // Reload whenever the doctor or the visible range changes.
    effect(() => {
      const doctorId = this.selectedDoctorId();
      const { from, to } = this.range();
      if (doctorId) this.load(doctorId, from, to);
    });
    // Clinic holidays (holidayCalendar) are labelled on their day.
    effect(() => {
      const clinicId = this.auth.user()?.clinicId;
      const { from, to } = this.range();
      if (!clinicId || !this.features.isOn('holidayCalendar')) {
        this.holidays.set([]);
        return;
      }
      const years = [...new Set([from.slice(0, 4), to.slice(0, 4)])].map(Number);
      forkJoin(years.map((y) => this.holidaysApi.list(clinicId, y))).subscribe({
        next: (lists) => this.holidays.set(lists.flat()),
        error: () => this.holidays.set([]),
      });
    });
    effect(() => {
      const doctorId = this.selectedDoctorId();
      if (doctorId) {
        this.api
          .services(doctorId)
          .subscribe((s) => this.services.set(s.filter((x) => x.isActive)));
      }
    });
  }

  private load(doctorId: string, from: string, to: string): void {
    this.loading.set(true);
    this.api.slots(doctorId, { from, to }).subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected reload(): void {
    const doctorId = this.selectedDoctorId();
    if (!doctorId) return;
    const { from, to } = this.range();
    this.load(doctorId, from, to);
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected isPast(slot: Slot): boolean {
    return new Date(slot.startsAt).getTime() < this.clock.now().toMillis();
  }

  protected countOf(column: Column, status: SlotStatus): number {
    return column.slots.filter((s) => s.status === status).length;
  }

  protected shift(direction: 1 | -1): void {
    this.anchor.update((key) => addDays(key, direction * (this.view() === 'day' ? 1 : 7)));
  }

  protected goToday(): void {
    this.anchor.set(this.clinicTime.today());
  }

  protected selectDay(key: string): void {
    this.anchor.set(key);
    this.view.set('day');
  }

  // ---- slot actions ----

  protected openSlot(slot: Slot): void {
    if (slot.status === 'Reserved' && slot.appointmentId) {
      this.drawerAppointmentId.set(slot.appointmentId);
    }
  }

  protected block(slot: Slot): void {
    this.run(this.api.blockSlot(this.selectedDoctorId()!, slot.id), 'slots.blocked');
  }

  protected unblock(slot: Slot): void {
    this.run(this.api.unblockSlot(this.selectedDoctorId()!, slot.id), 'slots.unblocked');
  }

  protected remove(slot: Slot): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'slots.removeTitle',
          messageKey: 'slots.removeMessage',
          messageParams: {
            time: `${this.clinicTime.date(slot.startsAt)} ${this.clinicTime.time(slot.startsAt)}`,
          },
          confirmKey: 'slots.remove',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.deleteSlot(this.selectedDoctorId()!, slot.id)),
      )
      .subscribe({
        next: () => {
          this.toast.success('slots.removed');
          this.reload();
        },
        error: () => this.reload(),
      });
  }

  private run(request$: ReturnType<DoctorsApi['blockSlot']>, successKey: string): void {
    request$.subscribe({
      next: () => {
        this.toast.success(successKey);
        this.reload();
      },
      // SLOT_RESERVED etc. are toasted globally; resync with the server's truth.
      error: () => this.reload(),
    });
  }

  protected addSlot(): void {
    const doctorId = this.selectedDoctorId();
    if (!doctorId) return;
    this.dialog
      .open(AddSlotDialog, { data: { doctorId, date: this.anchor() } })
      .afterClosed()
      .pipe(filter((created) => created === true))
      .subscribe(() => {
        this.toast.success('slots.added');
        this.reload();
      });
  }

  protected openBulk(): void {
    const doctorId = this.selectedDoctorId();
    if (!doctorId) return;
    this.dialog
      .open(BulkDialog, {
        data: { doctorId, startDate: this.anchor(), services: this.services() },
        maxWidth: '96vw',
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed === true) this.reload();
      });
  }

  protected openApplyTemplate(): void {
    const doctorId = this.selectedDoctorId();
    if (!doctorId) return;
    this.dialog
      .open(ApplyTemplateDialog, {
        data: { doctorId, startDate: this.anchor() },
        maxWidth: '96vw',
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed === true) this.reload();
      });
  }
}
