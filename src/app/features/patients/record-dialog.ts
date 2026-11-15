import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, of, switchMap } from 'rxjs';

import { PatientsApi } from '../../core/api/patients.api';
import { PatientAppointment, RecordEntry, RecordKind } from '../../core/api/phase2.models';
import { ToastService } from '../../core/http/toast.service';
import { ClinicTime } from '../../core/time/clinic-time.service';

export const RECORD_KINDS: RecordKind[] = ['Note', 'Diagnosis', 'Prescription', 'Attachment'];
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export interface RecordDialogData {
  userId: string;
  familyMemberId: string | null;
  entry?: RecordEntry;
  appointments: PatientAppointment[];
}

/** Add or edit a record entry (note, diagnosis, prescription, attachment). Closes with `true`. */
@Component({
  selector: 'app-record-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatIcon,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ (data.entry ? 'records.editTitle' : 'records.addTitle') | translate }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="dialog-form">
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'records.kind' | translate }}</mat-label>
              <mat-select formControlName="kind">
                @for (k of kinds; track k) {
                  <mat-option [value]="k">{{ 'records.kinds.' + k | translate }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'records.appointment' | translate }}</mat-label>
              <mat-select formControlName="appointmentId">
                <mat-option value="">{{ 'records.noAppointment' | translate }}</mat-option>
                @for (a of data.appointments; track a.id) {
                  <mat-option [value]="a.id">{{ appointmentLabel(a) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>{{ 'records.entryTitle' | translate }}</mat-label>
              <input matInput formControlName="title" maxlength="160" />
              @if (form.controls.title.hasError('required')) {
                <mat-error>{{ 'validation.required' | translate }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" class="full">
              <mat-label>{{ 'records.body' | translate }}</mat-label>
              <textarea matInput rows="4" formControlName="body" maxlength="4000"></textarea>
            </mat-form-field>
          </div>

          <div class="attach">
            <input
              #file
              type="file"
              hidden
              accept="application/pdf,image/jpeg,image/png"
              (change)="onFile($event)"
            />
            <button mat-stroked-button type="button" (click)="file.click()">
              <mat-icon>attach_file</mat-icon>{{ 'records.attach' | translate }}
            </button>
            <span class="muted" aria-live="polite">
              {{
                pickedFile()?.name ||
                  (data.entry?.attachmentUrl
                    ? ('records.hasAttachment' | translate)
                    : ('records.attachHint' | translate))
              }}
            </span>
          </div>

          <mat-slide-toggle formControlName="visibleToPatient">
            {{ 'records.visibleToPatient' | translate }}
          </mat-slide-toggle>
          <p class="muted hint">{{ 'records.visibleHint' | translate }}</p>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ 'common.save' | translate }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .attach {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-block: 4px 16px;
    }
    .hint {
      margin: 4px 0 0;
      font-size: 12px;
    }
  `,
})
export class RecordDialog {
  protected readonly data = inject<RecordDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<RecordDialog, boolean>>(MatDialogRef);
  private readonly api = inject(PatientsApi);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly clinicTime = inject(ClinicTime);

  protected readonly kinds = RECORD_KINDS;
  protected readonly saving = signal(false);
  protected readonly pickedFile = signal<File | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    kind: [this.data.entry?.kind ?? ('Note' as RecordKind)],
    title: [this.data.entry?.title ?? '', Validators.required],
    body: [this.data.entry?.body ?? ''],
    visibleToPatient: [this.data.entry?.visibleToPatient ?? false],
    appointmentId: [this.data.entry?.appointmentId ?? ''],
  });

  protected appointmentLabel(a: PatientAppointment): string {
    return `${this.clinicTime.date(a.startsAt)} - ${a.doctor.name}`;
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!ATTACHMENT_TYPES.includes(file.type) || file.size > MAX_ATTACHMENT_BYTES) {
      this.toast.failure('records.attachmentInvalid');
      return;
    }
    this.pickedFile.set(file);
    if (!this.form.controls.title.value) this.form.controls.title.setValue(file.name);
    if (this.form.controls.kind.value === 'Note') this.form.controls.kind.setValue('Attachment');
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      kind: v.kind,
      title: v.title.trim(),
      body: v.body.trim() || null,
      visibleToPatient: v.visibleToPatient,
      appointmentId: v.appointmentId || null,
      familyMemberId: this.data.familyMemberId,
    };
    const file = this.pickedFile();
    this.saving.set(true);
    const saved$: Observable<RecordEntry> = this.data.entry
      ? this.api.updateRecord(this.data.entry.id, body)
      : this.api.createRecord(this.data.userId, body);
    saved$
      .pipe(switchMap((entry) => (file ? this.api.uploadAttachment(entry.id, file) : of(entry))))
      .subscribe({
        next: () => this.ref.close(true),
        error: () => this.saving.set(false),
      });
  }
}
