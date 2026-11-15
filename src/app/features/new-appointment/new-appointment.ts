import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AppointmentsApi } from '../../core/api/appointments.api';
import { DoctorsApi } from '../../core/api/doctors.api';
import {
  AppointmentMode,
  DashboardAppointment,
  Doctor,
  Service,
  Slot,
} from '../../core/api/models';
import { FeaturesService } from '../../core/config/features.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { addDays } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { egyptPhoneValidator, normalizeEgyptPhone } from '../../core/validators/phone';
import { SlotPicker } from '../../shared/slot-picker';

const LOOKAHEAD_DAYS = 14;

/** Phone-in booking: staff or doctor books an open slot on behalf of a patient. */
@Component({
  selector: 'app-new-appointment',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
    MatButtonToggleGroup,
    MatButtonToggle,
    TranslatePipe,
    SlotPicker,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './new-appointment.html',
  styleUrl: './new-appointment.scss',
})
export class NewAppointment {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentsApi = inject(AppointmentsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly languages = inject(LanguageService);
  protected readonly features = inject(FeaturesService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly services = signal<Service[]>([]);
  protected readonly openSlots = signal<Slot[]>([]);
  protected readonly selectedSlot = signal<Slot | null>(null);
  protected readonly slotsLoaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly created = signal<DashboardAppointment | null>(null);
  protected readonly slotMissing = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    doctorId: ['', Validators.required],
    serviceId: [''],
    patientPhone: ['', [Validators.required, egyptPhoneValidator]],
    patientName: ['', [Validators.required, Validators.maxLength(120)]],
    patientNote: ['', Validators.maxLength(500)],
    mode: ['InPerson' as AppointmentMode],
  });

  constructor() {
    this.doctorsApi.list().subscribe((doctors) => {
      this.doctors.set(doctors);
      if (doctors.length === 1) this.chooseDoctor(doctors[0].id);
    });
  }

  /** Video is offered only when the feature is on and the chosen doctor has it enabled. */
  protected offersVideo(): boolean {
    const id = this.form.controls.doctorId.value;
    return (
      this.features.isOn('videoConsultation') &&
      this.doctors().some((d) => d.id === id && d.offersVideo === true)
    );
  }

  protected doctorName(doctor: Doctor): string {
    return localized(this.languages.language(), doctor.nameAr, doctor.nameEn);
  }

  protected serviceName(service: Service): string {
    return localized(this.languages.language(), service.nameAr, service.nameEn);
  }

  protected chooseDoctor(doctorId: string): void {
    this.form.controls.doctorId.setValue(doctorId);
    this.form.controls.serviceId.setValue('');
    this.form.controls.mode.setValue('InPerson');
    this.selectedSlot.set(null);
    this.slotMissing.set(false);
    this.services.set([]);
    this.openSlots.set([]);
    this.slotsLoaded.set(false);
    this.loadSlots(doctorId);
    this.doctorsApi
      .services(doctorId)
      .subscribe((services) => this.services.set(services.filter((s) => s.isActive)));
  }

  private loadSlots(doctorId: string): void {
    const today = this.clinicTime.today();
    this.doctorsApi
      .slots(doctorId, { from: today, to: addDays(today, LOOKAHEAD_DAYS - 1), status: 'Open' })
      .subscribe((slots) => {
        this.openSlots.set(slots);
        this.slotsLoaded.set(true);
      });
  }

  protected selectSlot(slot: Slot): void {
    this.selectedSlot.set(slot);
    this.slotMissing.set(false);
  }

  protected submit(): void {
    const slot = this.selectedSlot();
    this.slotMissing.set(!slot);
    if (this.form.invalid || !slot || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.appointmentsApi
      .create({
        slotId: slot.id,
        serviceId: value.serviceId || null,
        patientPhone: normalizeEgyptPhone(value.patientPhone)!,
        patientName: value.patientName.trim(),
        patientNote: value.patientNote.trim() || null,
        // Only sent when the doctor offers video, so a switched-off feature never sees the field.
        ...(this.offersVideo() ? { mode: value.mode } : {}),
      })
      .subscribe({
        next: (appointment) => {
          this.saving.set(false);
          this.created.set(appointment);
        },
        error: () => {
          this.saving.set(false);
          // Most likely SLOT_TAKEN / SLOT_UNAVAILABLE: refresh what is really open.
          this.selectedSlot.set(null);
          this.loadSlots(value.doctorId);
        },
      });
  }

  protected another(): void {
    const doctorId = this.form.controls.doctorId.value;
    this.created.set(null);
    this.form.reset({ doctorId });
    this.selectedSlot.set(null);
    this.chooseDoctor(doctorId);
  }
}
