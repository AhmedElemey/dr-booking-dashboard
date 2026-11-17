import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { TranslatePipe } from '@ngx-translate/core';

import { DoctorsApi } from '../../core/api/doctors.api';
import { BulkSlotsResult, DeleteSlotsResult, Service } from '../../core/api/models';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { addDays } from '../../core/time/clinic-time';
import { ClinicTime } from '../../core/time/clinic-time.service';
import {
  BulkFormValue,
  BulkIssue,
  WEEKDAYS,
  estimateBulk,
  slotLengthForService,
  toBulkRequest,
  validateBulk,
  validateRemoveRange,
} from './bulk-slots';
import { DateField } from '../../shared/date-field';

export interface BulkDialogData {
  doctorId: string;
  /** Clinic-local date key the dialog starts from. */
  startDate: string;
  services: Service[];
}

const LENGTHS = [15, 30, 45, 60, 90, 120, 180, 240];

/** Repeat helper: bulk add slots over a date range, or remove open slots in a range (day off). */
@Component({
  selector: 'app-bulk-dialog',
  imports: [
    DateField,
    FormsModule,
    MatDialogModule,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
    MatTabGroup,
    MatTab,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bulk-dialog.html',
  styleUrl: './bulk-dialog.scss',
})
export class BulkDialog {
  protected readonly data = inject<BulkDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(DoctorsApi);
  private readonly clinicTime = inject(ClinicTime);
  private readonly languages = inject(LanguageService);

  protected readonly weekdays = WEEKDAYS;
  protected readonly lengths = LENGTHS;

  // ---- add ----
  protected readonly fromDate = signal(this.data.startDate);
  protected readonly toDate = signal(addDays(this.data.startDate, 27));
  protected readonly days = signal<number[]>([6, 0, 1, 2, 3, 4]);
  protected readonly startTime = signal('09:00');
  protected readonly endTime = signal('14:00');
  protected readonly slotMinutes = signal(30);
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly addResult = signal<BulkSlotsResult | null>(null);

  protected readonly value = computed<BulkFormValue>(() => ({
    fromDate: this.fromDate(),
    toDate: this.toDate(),
    daysOfWeek: this.days(),
    startTime: this.startTime(),
    endTime: this.endTime(),
    slotMinutes: Number(this.slotMinutes()),
  }));
  protected readonly issues = computed<BulkIssue[]>(() =>
    validateBulk(this.value(), this.clinicTime.today()),
  );
  protected readonly estimate = computed(() => estimateBulk(this.value()));

  // ---- remove ----
  protected readonly removeFrom = signal(this.data.startDate);
  protected readonly removeTo = signal(this.data.startDate);
  protected readonly removing = signal(false);
  protected readonly removeResult = signal<DeleteSlotsResult | null>(null);
  protected readonly removeValid = computed(() =>
    validateRemoveRange(this.removeFrom(), this.removeTo()),
  );

  /** True once any call succeeded, so the calendar knows to reload. */
  protected readonly changed = signal(false);

  protected serviceLabel(s: Service): string {
    return `${localized(this.languages.language(), s.nameAr, s.nameEn)} (${s.durationMinutes})`;
  }

  protected toggleDay(day: number, on: boolean): void {
    this.days.update((days) => (on ? [...new Set([...days, day])] : days.filter((d) => d !== day)));
  }

  protected applyService(service: Service): void {
    this.slotMinutes.set(slotLengthForService(service.durationMinutes));
  }

  protected hasIssue(issue: BulkIssue): boolean {
    return this.issues().includes(issue);
  }

  protected add(): void {
    this.submitted.set(true);
    if (this.issues().length > 0 || this.saving()) return;
    this.saving.set(true);
    this.api.bulkCreateSlots(this.data.doctorId, toBulkRequest(this.value())).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.addResult.set(result);
        this.changed.set(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(): void {
    if (!this.removeValid() || this.removing()) return;
    this.removing.set(true);
    this.api.deleteSlotsInRange(this.data.doctorId, this.removeFrom(), this.removeTo()).subscribe({
      next: (result) => {
        this.removing.set(false);
        this.removeResult.set(result);
        this.changed.set(true);
      },
      error: () => this.removing.set(false),
    });
  }
}
