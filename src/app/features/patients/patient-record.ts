import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { PatientsApi } from '../../core/api/patients.api';
import { PatientDetail, RecordEntry } from '../../core/api/phase2.models';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/http/toast.service';
import { saveBlob } from '../../core/util/download';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { StatusChip } from '../../shared/status-chip';
import { RecordDialog } from './record-dialog';

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/** A download name from the record title and the blob's type, e.g. `Panoramic X-ray.pdf`. */
export function attachmentFileName(entry: RecordEntry, blob: Blob): string {
  const base = entry.title.replace(/[\\/:*?"<>|\s]+/g, ' ').trim() || 'attachment';
  const ext = EXTENSIONS[blob.type];
  return ext ? `${base}.${ext}` : base;
}

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const KIND_ICONS: Record<string, string> = {
  Note: 'sticky_note_2',
  Diagnosis: 'diagnosis',
  Prescription: 'medication',
  Attachment: 'attach_file',
};

/** patientRecords: medical info, appointment timeline and record entries of one patient. */
@Component({
  selector: 'app-patient-record',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatSelect,
    MatOption,
    MatIcon,
    MatProgressBar,
    TranslatePipe,
    StatusChip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <a mat-icon-button routerLink="/patients" [attr.aria-label]="'common.back' | translate">
          <mat-icon class="mirror">arrow_back</mat-icon>
        </a>
        <h1>
          {{
            detail()?.patient?.fullName ||
              detail()?.patient?.phone ||
              ('patients.record' | translate)
          }}
          @if (detail(); as d) {
            <span class="phone ltr-text muted">{{ d.patient.phone }}</span>
          }
          @if (detail()?.noShowCount; as noShows) {
            @if (noShows > 0) {
              <span class="chip warn">{{ 'patients.noShowCount' | translate: { count: noShows } }}</span>
            }
          }
        </h1>
        @if ((detail()?.familyMembers ?? []).length > 0) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'records.recordOf' | translate }}</mat-label>
            <mat-select [value]="memberId()" (selectionChange)="memberId.set($event.value)">
              <mat-option value="">{{ 'records.theAccountHolder' | translate }}</mat-option>
              @for (m of detail()?.familyMembers ?? []; track m.id) {
                <mat-option [value]="m.id"
                  ><span dir="auto">{{ m.fullName }}</span> ({{
                    'family.relation.' + m.relation | translate
                  }})</mat-option
                >
              }
            </mat-select>
          </mat-form-field>
        }
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (detail(); as d) {
        <div class="layout">
          <section class="panel box" aria-labelledby="medical-h">
            <h2 id="medical-h">{{ 'records.medicalInfo' | translate }}</h2>
            <form [formGroup]="medical" (ngSubmit)="saveMedical()">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'records.bloodType' | translate }}</mat-label>
                <mat-select formControlName="bloodType">
                  <mat-option value="">-</mat-option>
                  @for (b of bloodTypes; track b) {
                    <mat-option [value]="b">{{ b }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'records.allergies' | translate }}</mat-label>
                <textarea matInput rows="2" formControlName="allergies" maxlength="1000"></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'records.chronic' | translate }}</mat-label>
                <textarea
                  matInput
                  rows="2"
                  formControlName="chronicConditions"
                  maxlength="1000"
                ></textarea>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'records.medications' | translate }}</mat-label>
                <textarea
                  matInput
                  rows="2"
                  formControlName="medications"
                  maxlength="1000"
                ></textarea>
              </mat-form-field>
              <div class="row">
                @if (d.medicalInfo?.updatedAt; as updated) {
                  <span class="muted small">
                    {{ 'records.updatedAt' | translate: { date: clinicTime.date(updated) } }}
                  </span>
                }
                <span class="grow"></span>
                <button mat-flat-button type="submit" [disabled]="savingMedical()">
                  {{ 'common.save' | translate }}
                </button>
              </div>
            </form>

            <h2 id="timeline-h">{{ 'records.timeline' | translate }}</h2>
            @if (d.appointments.length === 0) {
              <p class="muted">{{ 'records.noAppointments' | translate }}</p>
            } @else {
              <ol class="timeline" aria-labelledby="timeline-h">
                @for (a of d.appointments; track a.id) {
                  <li>
                    <span class="when">{{ clinicTime.date(a.startsAt, a.timezone) }}</span>
                    <span class="what">
                      <span dir="auto">{{ a.doctor.name }}</span>
                      @if (a.service) {
                        <span class="muted"
                          >- <span dir="auto">{{ a.service.name }}</span></span
                        >
                      }
                      @if (a.familyMember; as m) {
                        <span class="muted"
                          >(<span dir="auto">{{ m.fullName }}</span
                          >)</span
                        >
                      }
                    </span>
                    <app-status-chip [status]="a.status" />
                  </li>
                }
              </ol>
            }
          </section>

          <section class="panel box" aria-labelledby="entries-h">
            <div class="row between">
              <h2 id="entries-h">{{ 'records.entries' | translate }}</h2>
              <button mat-flat-button type="button" (click)="open()">
                <mat-icon>add</mat-icon>{{ 'records.add' | translate }}
              </button>
            </div>
            @if (d.records.length === 0) {
              <p class="muted">{{ 'records.empty' | translate }}</p>
            }
            @for (r of d.records; track r.id) {
              <article class="entry">
                <mat-icon class="kind" aria-hidden="true">{{ icon(r) }}</mat-icon>
                <div class="content">
                  <div class="entry-head">
                    <strong dir="auto">{{ r.title }}</strong>
                    <span class="pill info">{{ 'records.kinds.' + r.kind | translate }}</span>
                    <span
                      class="pill"
                      [class.ok]="r.visibleToPatient"
                      [attr.title]="'records.visibleToPatient' | translate"
                    >
                      <mat-icon class="mini" aria-hidden="true">{{
                        r.visibleToPatient ? 'visibility' : 'visibility_off'
                      }}</mat-icon>
                      {{ (r.visibleToPatient ? 'records.visible' : 'records.private') | translate }}
                    </span>
                  </div>
                  @if (r.body) {
                    <p class="body" dir="auto">{{ r.body }}</p>
                  }
                  @if (r.attachmentUrl) {
                    <button
                      mat-button
                      type="button"
                      class="attachment"
                      [disabled]="downloadingId() === r.id"
                      (click)="openAttachment(r)"
                    >
                      <mat-icon aria-hidden="true">attach_file</mat-icon
                      >{{ 'records.openAttachment' | translate }}
                    </button>
                  }
                  <div class="muted small">
                    {{ clinicTime.date(r.createdAt) }}
                    @if (r.authorName || r.doctorName) {
                      · <span dir="auto">{{ r.authorName || r.doctorName }}</span>
                    }
                  </div>
                </div>
                @if (canEdit(r)) {
                  <span class="row-actions">
                    <button
                      mat-icon-button
                      type="button"
                      [attr.aria-label]="'common.edit' | translate"
                      (click)="open(r)"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      type="button"
                      [attr.aria-label]="'common.delete' | translate"
                      (click)="remove(r)"
                    >
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </span>
                }
              </article>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    .phone {
      font: var(--mat-sys-body-large);
      margin-inline-start: 8px;
    }
    .chip {
      display: inline-block;
      padding-block: 2px;
      padding-inline: 10px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      margin-inline-start: 8px;
    }
    .chip.warn {
      background: var(--ml-noshow-bg);
      color: var(--ml-noshow);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 1000px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    .box {
      padding: 20px;
      overflow: visible;
    }
    h2 {
      margin: 0 0 12px;
      font: var(--mat-sys-title-medium);
    }
    form mat-form-field {
      inline-size: 100%;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      &.between {
        justify-content: space-between;
      }
    }
    .grow {
      flex: 1;
    }
    .small {
      font-size: 12px;
    }
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
      li {
        display: grid;
        grid-template-columns: 150px 1fr auto;
        gap: 8px;
        align-items: center;
        padding-block: 8px;
        border-block-end: 1px solid var(--mat-sys-outline-variant);
      }
      .when {
        font-variant-numeric: tabular-nums;
        color: var(--mat-sys-on-surface-variant);
      }
    }
    .entry {
      display: flex;
      gap: 12px;
      padding-block: 12px;
      border-block-start: 1px solid var(--mat-sys-outline-variant);
      .content {
        flex: 1;
        min-inline-size: 0;
      }
      .kind {
        color: var(--mat-sys-primary);
      }
    }
    .entry-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .mini {
      font-size: 14px;
      inline-size: 14px;
      block-size: 14px;
      vertical-align: -2px;
    }
    .body {
      margin: 6px 0;
      white-space: pre-wrap;
    }
    .attachment {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-end: 4px;
    }
  `,
})
export class PatientRecord {
  private readonly api = inject(PatientsApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  protected readonly clinicTime = inject(ClinicTime);

  /** Route parameter `:id` (the patient's user id). */
  readonly id = input.required<string>();

  protected readonly bloodTypes = BLOOD_TYPES;
  protected readonly detail = signal<PatientDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly savingMedical = signal(false);
  /** '' = the account holder; otherwise a family member id. */
  protected readonly memberId = signal('');
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly canEditAll = computed(() => this.auth.role() === 'ClinicStaff');

  protected readonly medical = this.fb.nonNullable.group({
    bloodType: [''],
    allergies: [''],
    chronicConditions: [''],
    medications: [''],
  });

  constructor() {
    effect(() => {
      this.load(this.id(), this.memberId());
    });
  }

  private load(id: string, member: string): void {
    this.loading.set(true);
    this.api.get(id, member || null).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.medical.reset({
          bloodType: detail.medicalInfo?.bloodType ?? '',
          allergies: detail.medicalInfo?.allergies ?? '',
          chronicConditions: detail.medicalInfo?.chronicConditions ?? '',
          medications: detail.medicalInfo?.medications ?? '',
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private reload(): void {
    this.load(this.id(), this.memberId());
  }

  protected icon(entry: RecordEntry): string {
    return KIND_ICONS[entry.kind] ?? 'description';
  }

  protected canEdit(entry: RecordEntry): boolean {
    return this.canEditAll() || entry.authorUserId === this.auth.user()?.id;
  }

  /** The attachment sits behind the API's authorization, so fetch it with the token as a blob. */
  protected openAttachment(entry: RecordEntry): void {
    if (!entry.attachmentUrl || this.downloadingId()) return;
    this.downloadingId.set(entry.id);
    this.api.fetchAttachment(entry.attachmentUrl).subscribe({
      next: (blob) => {
        this.downloadingId.set(null);
        saveBlob(blob, attachmentFileName(entry, blob));
      },
      error: () => this.downloadingId.set(null),
    });
  }

  protected saveMedical(): void {
    if (this.savingMedical()) return;
    const v = this.medical.getRawValue();
    this.savingMedical.set(true);
    this.api
      .saveMedicalInfo(
        this.id(),
        {
          bloodType: v.bloodType || null,
          allergies: v.allergies.trim() || null,
          chronicConditions: v.chronicConditions.trim() || null,
          medications: v.medications.trim() || null,
        },
        this.memberId() || null,
      )
      .subscribe({
        next: () => {
          this.savingMedical.set(false);
          this.toast.success('records.medicalSaved');
          this.reload();
        },
        error: () => this.savingMedical.set(false),
      });
  }

  protected open(entry?: RecordEntry): void {
    this.dialog
      .open(RecordDialog, {
        data: {
          userId: this.id(),
          familyMemberId: this.memberId() || null,
          entry,
          appointments: this.detail()?.appointments ?? [],
        },
        maxWidth: '96vw',
      })
      .afterClosed()
      .pipe(filter((saved) => saved === true))
      .subscribe(() => {
        this.toast.success('records.saved');
        this.reload();
      });
  }

  protected remove(entry: RecordEntry): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'records.deleteTitle',
          messageKey: 'records.deleteMessage',
          messageParams: { name: entry.title },
          confirmKey: 'common.delete',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.deleteRecord(entry.id)),
      )
      .subscribe(() => {
        this.toast.success('records.deleted');
        this.reload();
      });
  }
}
