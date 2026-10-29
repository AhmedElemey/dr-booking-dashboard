import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Clock } from '../../core/time/clock';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { SingleSlotIssue, buildSingleSlot } from './single-slot';

export interface AddSlotDialogData {
  doctorId: string;
  date: string;
}

/** Create one slot from clinic-local date, start time and length. Closes with `true` when created. */
@Component({
  selector: 'app-add-slot-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'slots.addTitle' | translate }}</h2>
    <form (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'slots.date' | translate }}</mat-label>
            <input matInput type="date" name="date" [(ngModel)]="date" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'slots.startTime' | translate }}</mat-label>
            <input matInput type="time" step="900" name="time" [(ngModel)]="time" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'bulk.slotMinutes' | translate }}</mat-label>
            <mat-select name="minutes" [(ngModel)]="minutes">
              @for (m of lengths; track m) {
                <mat-option [value]="m">{{ m }} {{ 'common.min' | translate }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
        @if (issue(); as i) {
          <p class="error" role="alert">{{ 'slots.error.' + i | translate }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
        <button mat-flat-button type="submit" [disabled]="saving()">
          {{ 'slots.addAction' | translate }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0 12px;
      padding-block-start: 8px;
      min-inline-size: min(560px, 78vw);
    }
    .error {
      color: var(--mat-sys-error);
      margin: 0;
    }
    @media (max-width: 600px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AddSlotDialog {
  private readonly data = inject<AddSlotDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AddSlotDialog, boolean>>(MatDialogRef);
  private readonly api = inject(DoctorsApi);
  private readonly clinicTime = inject(ClinicTime);
  private readonly clock = inject(Clock);

  protected readonly lengths = [15, 30, 45, 60, 90, 120, 180, 240];
  protected date = this.data.date;
  protected time = '09:00';
  protected minutes = 30;

  protected readonly issue = signal<SingleSlotIssue | null>(null);
  protected readonly saving = signal(false);

  protected save(): void {
    const built = buildSingleSlot(
      this.date,
      this.time,
      Number(this.minutes),
      this.clinicTime.timezone(),
      this.clock.now(),
    );
    if ('issue' in built) {
      this.issue.set(built.issue);
      return;
    }
    this.issue.set(null);
    this.saving.set(true);
    this.api.createSlot(this.data.doctorId, built.request).subscribe({
      next: () => this.ref.close(true),
      error: () => this.saving.set(false), // SLOT_OVERLAP etc. are toasted globally
    });
  }
}
