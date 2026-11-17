import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { HolidaysApi } from '../../core/api/holidays.api';
import { DashboardAppointment } from '../../core/api/models';
import { Holiday } from '../../core/api/phase2.models';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { ConfirmDialog } from '../../shared/confirm-dialog';
import { DateField } from '../../shared/date-field';

/** holidayCalendar: clinic closed days by year, Egyptian public-holiday import, conflict warning. */
@Component({
  selector: 'app-holidays',
  imports: [
    DateField,
    ReactiveFormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatIcon,
    MatProgressBar,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'holidays.title' | translate }}</h1>
        <button mat-stroked-button type="button" [disabled]="importing()" (click)="importEgypt()">
          <mat-icon>flag</mat-icon>{{ 'holidays.import' | translate }}
        </button>
      </div>
      <p class="muted intro">{{ 'holidays.intro' | translate }}</p>

      <form class="panel add" [formGroup]="form" (ngSubmit)="add()" novalidate>
        <h2>{{ 'holidays.add' | translate }}</h2>
        <div class="fields">
          <app-date-field
            [label]="'holidays.date' | translate"
            subscriptSizing="dynamic"
            formControlName="date"
          />
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'holidays.nameAr' | translate }}</mat-label>
            <input matInput formControlName="nameAr" dir="rtl" maxlength="120" />
            @if (form.controls.nameAr.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'holidays.nameEn' | translate }}</mat-label>
            <input matInput formControlName="nameEn" dir="ltr" maxlength="120" />
            @if (form.controls.nameEn.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="saving()">
            <mat-icon>add</mat-icon>{{ 'holidays.addAction' | translate }}
          </button>
        </div>
      </form>

      @if (conflicts(); as c) {
        <div class="warning-box" role="alert">
          <mat-icon aria-hidden="true">warning</mat-icon>
          <div>
            <strong>{{ 'holidays.conflictsTitle' | translate: { count: c.list.length } }}</strong>
            <p class="note">{{ 'holidays.conflictsNote' | translate }}</p>
            <ul>
              @for (a of c.list; track a.id) {
                <li>
                  <span class="ltr-text">{{ clinicTime.time(a.startsAt, a.timezone) }}</span>
                  · <span dir="auto">{{ a.patient.fullName || a.patient.phone }}</span> ·
                  <span dir="auto">{{ a.doctor.name }}</span>
                </li>
              }
            </ul>
          </div>
          <button
            mat-icon-button
            type="button"
            [attr.aria-label]="'common.close' | translate"
            (click)="conflicts.set(null)"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }

      <div class="year-row">
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="'holidays.previousYear' | translate"
          (click)="shiftYear(-1)"
        >
          <mat-icon class="mirror">chevron_left</mat-icon>
        </button>
        <h2 class="year ltr-text">{{ year() }}</h2>
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="'holidays.nextYear' | translate"
          (click)="shiftYear(1)"
        >
          <mat-icon class="mirror">chevron_right</mat-icon>
        </button>
      </div>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (holidays().length === 0 && !loading()) {
          <p class="empty-state">{{ 'holidays.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'holidays.date' | translate }}</th>
                  <th scope="col">{{ 'holidays.name' | translate }}</th>
                  <th scope="col">{{ 'holidays.source' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (h of holidays(); track h.id) {
                  <tr>
                    <td [attr.data-label]="'holidays.date' | translate">
                      {{ clinicTime.keyLabel(h.date, 'cccc, d LLLL') }}
                    </td>
                    <td [attr.data-label]="'holidays.name' | translate">{{ name(h) }}</td>
                    <td [attr.data-label]="'holidays.source' | translate">
                      <span class="pill" [class.info]="h.source === 'EgyptPublic'">{{
                        'holidays.sources.' + h.source | translate
                      }}</span>
                    </td>
                    <td class="end">
                      <span class="row-actions">
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'holidays.checkConflicts' | translate"
                          (click)="checkConflicts(h)"
                        >
                          <mat-icon>event_busy</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.delete' | translate"
                          (click)="remove(h)"
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
  styles: `
    .intro {
      margin-block: -8px 16px;
    }
    .add {
      padding: 16px 20px;
      margin-block-end: 16px;
      overflow: visible;
    }
    h2 {
      margin: 0 0 12px;
      font: var(--mat-sys-title-medium);
    }
    .fields {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      mat-form-field {
        flex: 1 1 200px;
      }
      button {
        margin-block-start: 8px;
      }
    }
    .note {
      margin: 4px 0 0;
    }
    .warning-box > div {
      flex: 1;
    }
    .year-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-block-end: 8px;
      .year {
        margin: 0;
      }
    }
  `,
})
export class Holidays {
  private readonly api = inject(HolidaysApi);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly languages = inject(LanguageService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly year = signal(Number(this.clinicTime.today().slice(0, 4)));
  protected readonly holidays = signal<Holiday[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly importing = signal(false);
  protected readonly conflicts = signal<{ list: DashboardAppointment[] } | null>(null);
  protected readonly clinicId = computed(() => this.auth.user()?.clinicId ?? '');

  protected readonly form = this.fb.nonNullable.group({
    date: ['', Validators.required],
    nameAr: ['', Validators.required],
    nameEn: ['', Validators.required],
  });

  constructor() {
    this.load();
  }

  protected name(h: Holiday): string {
    return localized(this.languages.language(), h.nameAr, h.nameEn);
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(this.clinicId(), this.year()).subscribe({
      next: (list) => {
        this.holidays.set([...list].sort((a, b) => a.date.localeCompare(b.date)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected shiftYear(delta: number): void {
    this.year.update((y) => y + delta);
    this.conflicts.set(null);
    this.load();
  }

  protected add(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .create({
        clinicId: this.clinicId(),
        date: v.date,
        nameAr: v.nameAr.trim(),
        nameEn: v.nameEn.trim(),
      })
      .subscribe({
        next: (holiday) => {
          this.saving.set(false);
          this.toast.success('holidays.added');
          this.form.reset({ date: '', nameAr: '', nameEn: '' });
          if (holiday.date.startsWith(String(this.year()))) this.load();
          this.checkConflicts(holiday, true);
        },
        error: () => this.saving.set(false),
      });
  }

  /** Lists the appointments already booked on the holiday; they stay untouched. */
  protected checkConflicts(holiday: Holiday, quietWhenNone = false): void {
    this.api.conflicts(holiday.id).subscribe((list) => {
      if (list.length > 0) this.conflicts.set({ list });
      else {
        this.conflicts.set(null);
        if (!quietWhenNone) this.toast.success('holidays.noConflicts');
      }
    });
  }

  protected remove(holiday: Holiday): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'holidays.deleteTitle',
          messageKey: 'holidays.deleteMessage',
          messageParams: { name: this.name(holiday) },
          confirmKey: 'common.delete',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.delete(holiday.id)),
      )
      .subscribe(() => {
        this.toast.success('holidays.deleted');
        this.load();
      });
  }

  protected importEgypt(): void {
    this.importing.set(true);
    this.api.importEgypt(this.clinicId(), this.year()).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.toast.success('holidays.imported', result);
        this.load();
      },
      error: () => this.importing.set(false),
    });
  }
}
