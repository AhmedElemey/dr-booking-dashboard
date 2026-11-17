import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor, Service } from '../../core/api/models';
import {
  PageResult,
  RecallCampaign,
  RecallChannel,
  RecallMode,
  RecallPreview,
  RecallSend,
} from '../../core/api/phase2.models';
import { RecallApi } from '../../core/api/recall.api';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';

const CHANNELS: RecallChannel[] = ['Auto', 'Sms', 'WhatsApp', 'Push'];

interface CampaignDialogData {
  campaign?: RecallCampaign;
  doctors: Doctor[];
}

/** Create or edit a recall campaign. Closes with the saved campaign. */
@Component({
  selector: 'app-campaign-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ (data.campaign ? 'recall.editTitle' : 'recall.addTitle') | translate }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid dialog-form">
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ 'recall.name' | translate }}</mat-label>
            <input matInput formControlName="name" maxlength="120" />
            @if (form.controls.name.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'recall.messageAr' | translate }}</mat-label>
            <textarea
              matInput
              rows="4"
              formControlName="messageAr"
              dir="rtl"
              maxlength="600"
            ></textarea>
            @if (form.controls.messageAr.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'recall.messageEn' | translate }}</mat-label>
            <textarea
              matInput
              rows="4"
              formControlName="messageEn"
              dir="ltr"
              maxlength="600"
            ></textarea>
            @if (form.controls.messageEn.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <p class="muted full placeholders">{{ 'recall.placeholders' | translate }}</p>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'recall.channel' | translate }}</mat-label>
            <mat-select formControlName="channel">
              @for (c of channels; track c) {
                <mat-option [value]="c">{{ 'recall.channels.' + c | translate }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'recall.months' | translate }}</mat-label>
            <input matInput type="number" formControlName="monthsSinceLastVisit" min="1" max="60" />
            <mat-hint>{{ 'recall.monthsHint' | translate }}</mat-hint>
            @if (form.controls.monthsSinceLastVisit.invalid) {
              <mat-error>{{ 'recall.monthsInvalid' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'agenda.doctor' | translate }}</mat-label>
            <mat-select formControlName="doctorId" (selectionChange)="doctorChanged($event.value)">
              <mat-option value="">{{ 'coupons.anyDoctor' | translate }}</mat-option>
              @for (d of data.doctors; track d.id) {
                <mat-option [value]="d.id">{{ doctorName(d) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'newAppointment.service' | translate }}</mat-label>
            <mat-select formControlName="serviceId">
              <mat-option value="">{{ 'coupons.anyService' | translate }}</mat-option>
              @for (s of services(); track s.id) {
                <mat-option [value]="s.id">{{ serviceName(s) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'recall.mode' | translate }}</mat-label>
            <mat-select formControlName="mode">
              <mat-option value="OneOff">{{ 'recall.modes.OneOff' | translate }}</mat-option>
              <mat-option value="Recurring">{{ 'recall.modes.Recurring' | translate }}</mat-option>
            </mat-select>
            <mat-hint>{{ 'recall.modeHint.' + form.controls.mode.value | translate }}</mat-hint>
          </mat-form-field>
          <mat-checkbox formControlName="isActive">{{ 'recall.active' | translate }}</mat-checkbox>
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
    .placeholders {
      margin: -8px 0 12px;
      font-size: 12px;
    }
  `,
})
export class CampaignDialog {
  protected readonly data = inject<CampaignDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CampaignDialog, RecallCampaign>>(MatDialogRef);
  private readonly api = inject(RecallApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly languages = inject(LanguageService);
  private readonly fb = inject(FormBuilder);

  protected readonly channels = CHANNELS;
  protected readonly saving = signal(false);
  protected readonly services = signal<Service[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    name: [this.data.campaign?.name ?? '', Validators.required],
    messageAr: [this.data.campaign?.messageAr ?? '', Validators.required],
    messageEn: [this.data.campaign?.messageEn ?? '', Validators.required],
    channel: [this.data.campaign?.channel ?? ('Auto' as RecallChannel)],
    monthsSinceLastVisit: [
      this.data.campaign?.monthsSinceLastVisit ?? 6,
      [Validators.required, Validators.min(1), Validators.max(60)],
    ],
    doctorId: [this.data.campaign?.doctorId ?? ''],
    serviceId: [this.data.campaign?.serviceId ?? ''],
    mode: [this.data.campaign?.mode ?? ('OneOff' as RecallMode)],
    isActive: [this.data.campaign?.isActive ?? true],
  });

  constructor() {
    if (this.data.campaign?.doctorId) this.doctorChanged(this.data.campaign.doctorId, true);
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected serviceName(s: Service): string {
    return localized(this.languages.language(), s.nameAr, s.nameEn);
  }

  protected doctorChanged(doctorId: string, keepService = false): void {
    if (!keepService) this.form.controls.serviceId.setValue('');
    this.services.set([]);
    if (doctorId) {
      this.doctorsApi
        .services(doctorId)
        .subscribe((list) => this.services.set(list.filter((s) => s.isActive)));
    }
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      name: v.name.trim(),
      messageAr: v.messageAr.trim(),
      messageEn: v.messageEn.trim(),
      channel: v.channel,
      monthsSinceLastVisit: Number(v.monthsSinceLastVisit),
      doctorId: v.doctorId || null,
      serviceId: v.doctorId && v.serviceId ? v.serviceId : null,
      mode: v.mode,
      isActive: v.isActive,
    };
    this.saving.set(true);
    (this.data.campaign
      ? this.api.update(this.data.campaign.id, body)
      : this.api.create(body)
    ).subscribe({
      next: (campaign) => this.ref.close(campaign),
      error: () => this.saving.set(false),
    });
  }
}

/** Audience preview: how many patients would get the message, and a sample. */
@Component({
  selector: 'app-recall-preview-dialog',
  imports: [MatDialogModule, MatButton, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'recall.previewTitle' | translate: { name: data.name } }}</h2>
    <mat-dialog-content>
      <div class="dialog-form">
        @if (preview(); as p) {
          <p class="count" role="status">
            <strong>{{ p.audienceCount }}</strong>
            {{ 'recall.audience' | translate }}
          </p>
          @if (p.sample.length > 0) {
            <h3>{{ 'recall.sample' | translate }}</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'agenda.col.patient' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.phone' | translate }}</th>
                  <th scope="col">{{ 'patients.lastVisit' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of p.sample; track s.phone) {
                  <tr>
                    <td dir="auto">{{ s.name }}</td>
                    <td>
                      <span class="ltr-text">{{ s.phone }}</span>
                    </td>
                    <td>{{ s.lastVisitAt ? clinicTime.date(s.lastVisitAt) : '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        } @else {
          <p class="muted">...</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .count {
      font: var(--mat-sys-title-medium);
      strong {
        font-size: 28px;
        color: var(--mat-sys-primary);
      }
    }
    h3 {
      font: var(--mat-sys-title-small);
    }
  `,
})
export class RecallPreviewDialog {
  protected readonly data = inject<RecallCampaign>(MAT_DIALOG_DATA);
  protected readonly clinicTime = inject(ClinicTime);
  protected readonly preview = signal<RecallPreview | null>(null);

  constructor() {
    inject(RecallApi)
      .preview(this.data.id)
      .subscribe((p) => this.preview.set(p));
  }
}

/** The campaign's sends log. */
@Component({
  selector: 'app-recall-sends-dialog',
  imports: [MatDialogModule, MatButton, MatIconButton, MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'recall.sendsTitle' | translate: { name: data.name } }}</h2>
    <mat-dialog-content>
      <div class="dialog-form">
        @if (!loaded()) {
          <p class="muted">...</p>
        } @else if (result().items.length === 0) {
          <p class="empty-state">{{ 'recall.noSends' | translate }}</p>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">{{ 'payments.col.date' | translate }}</th>
                <th scope="col">{{ 'agenda.col.patient' | translate }}</th>
                <th scope="col">{{ 'recall.channel' | translate }}</th>
                <th scope="col">{{ 'agenda.col.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of result().items; track s.id) {
                <tr>
                  <td>
                    {{ clinicTime.date(s.sentAt) }}
                    <span class="ltr-text muted">{{ clinicTime.time(s.sentAt) }}</span>
                  </td>
                  <td dir="auto">{{ s.patientName || '-' }}</td>
                  <td>{{ 'recall.channels.' + s.channel | translate }}</td>
                  <td>
                    <span class="pill" [class]="'pill ' + tone(s)">{{
                      'recall.sendStatus.' + s.status | translate
                    }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (page() > 1 || hasNext()) {
            <div class="pager">
              <button
                mat-icon-button
                type="button"
                [disabled]="page() <= 1"
                [attr.aria-label]="'agenda.previous' | translate"
                (click)="load(page() - 1)"
              >
                <mat-icon class="mirror">chevron_left</mat-icon>
              </button>
              <span class="num">{{ page() }}</span>
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasNext()"
                [attr.aria-label]="'agenda.next' | translate"
                (click)="load(page() + 1)"
              >
                <mat-icon class="mirror">chevron_right</mat-icon>
              </button>
            </div>
          }
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.close' | translate }}</button>
    </mat-dialog-actions>
  `,
})
export class RecallSendsDialog {
  protected readonly data = inject<RecallCampaign>(MAT_DIALOG_DATA);
  private readonly api = inject(RecallApi);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly loaded = signal(false);
  protected readonly page = signal(1);
  protected readonly result = signal<PageResult<RecallSend>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 0,
  });

  constructor() {
    this.load(1);
  }

  protected load(page: number): void {
    this.api.sends(this.data.id, page).subscribe({
      next: (result) => {
        this.result.set(result);
        this.page.set(page);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  protected hasNext(): boolean {
    const r = this.result();
    return r.pageSize > 0 && r.page * r.pageSize < r.totalCount;
  }

  protected tone(s: RecallSend): string {
    return { Sent: 'ok', Failed: 'bad', Skipped: '' }[s.status];
  }
}

/** recallCampaigns: win back patients who have not visited for a while. */
@Component({
  selector: 'app-recall',
  imports: [MatButton, MatIconButton, MatIcon, MatProgressBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'recall.title' | translate }}</h1>
        <button mat-flat-button type="button" (click)="open()">
          <mat-icon>add</mat-icon>{{ 'recall.add' | translate }}
        </button>
      </div>
      <p class="muted">{{ 'recall.intro' | translate }}</p>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (campaigns().length === 0 && !loading()) {
          <p class="empty-state">{{ 'recall.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'recall.name' | translate }}</th>
                  <th scope="col">{{ 'recall.channel' | translate }}</th>
                  <th scope="col">{{ 'recall.months' | translate }}</th>
                  <th scope="col">{{ 'recall.mode' | translate }}</th>
                  <th scope="col">{{ 'recall.lastRun' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.status' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (c of campaigns(); track c.id) {
                  <tr [class.inactive]="!c.isActive">
                    <td>
                      <strong dir="auto">{{ c.name }}</strong>
                    </td>
                    <td>{{ 'recall.channels.' + c.channel | translate }}</td>
                    <td class="num">{{ c.monthsSinceLastVisit }}</td>
                    <td>{{ 'recall.modes.' + c.mode | translate }}</td>
                    <td>{{ c.lastRunAt ? clinicTime.date(c.lastRunAt) : '-' }}</td>
                    <td>
                      <span class="pill" [class.ok]="c.isActive">{{
                        (c.isActive ? 'recall.active' : 'recall.inactive') | translate
                      }}</span>
                    </td>
                    <td class="end">
                      <span class="row-actions">
                        <button mat-stroked-button type="button" (click)="preview(c)">
                          <mat-icon>groups</mat-icon>{{ 'recall.preview' | translate }}
                        </button>
                        <button
                          mat-flat-button
                          type="button"
                          [disabled]="busyId() === c.id"
                          (click)="sendNow(c)"
                        >
                          <mat-icon>send</mat-icon>{{ 'recall.sendNow' | translate }}
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'recall.sends' | translate"
                          (click)="sends(c)"
                        >
                          <mat-icon>history</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.edit' | translate"
                          (click)="open(c)"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.delete' | translate"
                          (click)="remove(c)"
                        >
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </span>
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
})
export class Recall {
  private readonly api = inject(RecallApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly campaigns = signal<RecallCampaign[]>([]);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);
  private readonly doctors = signal<Doctor[]>([]);

  constructor() {
    this.doctorsApi.list().subscribe((d) => this.doctors.set(d));
    this.load();
  }

  private load(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.campaigns.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(campaign?: RecallCampaign): void {
    this.dialog
      .open(CampaignDialog, { data: { campaign, doctors: this.doctors() }, maxWidth: '96vw' })
      .afterClosed()
      .pipe(filter((saved): saved is RecallCampaign => !!saved))
      .subscribe(() => {
        this.toast.success('recall.saved');
        this.load();
      });
  }

  protected preview(c: RecallCampaign): void {
    this.dialog.open(RecallPreviewDialog, { data: c, maxWidth: '96vw' });
  }

  protected sends(c: RecallCampaign): void {
    this.dialog.open(RecallSendsDialog, { data: c, maxWidth: '96vw' });
  }

  protected sendNow(c: RecallCampaign): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'recall.sendNowTitle',
          messageKey: 'recall.sendNowMessage',
          messageParams: { name: c.name },
          confirmKey: 'recall.sendNow',
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => {
          this.busyId.set(c.id);
          return this.api.sendNow(c.id);
        }),
      )
      .subscribe({
        next: (result) => {
          this.busyId.set(null);
          this.toast.success('recall.sendResult', result);
          this.load();
        },
        error: () => this.busyId.set(null),
      });
  }

  protected remove(c: RecallCampaign): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'recall.deleteTitle',
          messageKey: 'recall.deleteMessage',
          messageParams: { name: c.name },
          confirmKey: 'common.delete',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.delete(c.id)),
      )
      .subscribe(() => {
        this.toast.success('recall.deleted');
        this.load();
      });
  }
}
