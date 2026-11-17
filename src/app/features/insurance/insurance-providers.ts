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
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, switchMap } from 'rxjs';

import { InsuranceApi } from '../../core/api/insurance.api';
import { InsuranceProvider } from '../../core/api/phase2.models';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ConfirmDialog } from '../../shared/confirm-dialog';

/** Create or edit an insurance provider. Closes with the saved provider. */
@Component({
  selector: 'app-insurance-provider-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ (data ? 'insurance.editTitle' : 'insurance.addTitle') | translate }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content>
        <div class="form-grid dialog-form">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'insurance.nameAr' | translate }}</mat-label>
            <input matInput formControlName="nameAr" dir="rtl" maxlength="120" />
            @if (form.controls.nameAr.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'insurance.nameEn' | translate }}</mat-label>
            <input matInput formControlName="nameEn" dir="ltr" maxlength="120" />
            @if (form.controls.nameEn.hasError('required')) {
              <mat-error>{{ 'validation.required' | translate }}</mat-error>
            }
          </mat-form-field>
          <mat-checkbox class="full" formControlName="isActive">
            {{ 'insurance.active' | translate }}
          </mat-checkbox>
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
})
export class InsuranceProviderDialog {
  protected readonly data = inject<InsuranceProvider | null>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<InsuranceProviderDialog, InsuranceProvider>>(MatDialogRef);
  private readonly api = inject(InsuranceApi);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    nameAr: [this.data?.nameAr ?? '', Validators.required],
    nameEn: [this.data?.nameEn ?? '', Validators.required],
    isActive: [this.data?.isActive ?? true],
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = { nameAr: v.nameAr.trim(), nameEn: v.nameEn.trim(), isActive: v.isActive };
    this.saving.set(true);
    (this.data ? this.api.update(this.data.id, body) : this.api.create(body)).subscribe({
      next: (provider) => this.ref.close(provider),
      error: () => this.saving.set(false),
    });
  }
}

/** insurance: the insurance companies the clinic works with. */
@Component({
  selector: 'app-insurance-providers',
  imports: [MatButton, MatIconButton, MatIcon, MatProgressBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'insurance.title' | translate }}</h1>
        <button mat-flat-button type="button" (click)="open()">
          <mat-icon>add</mat-icon>{{ 'insurance.add' | translate }}
        </button>
      </div>
      <p class="muted">{{ 'insurance.intro' | translate }}</p>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (providers().length === 0 && !loading()) {
          <p class="empty-state">{{ 'insurance.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'insurance.name' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.status' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (p of providers(); track p.id) {
                  <tr [class.inactive]="!p.isActive">
                    <td [attr.data-label]="'insurance.name' | translate">{{ name(p) }}</td>
                    <td [attr.data-label]="'agenda.col.status' | translate">
                      <span class="pill" [class.ok]="p.isActive">{{
                        (p.isActive ? 'insurance.active' : 'insurance.inactive') | translate
                      }}</span>
                    </td>
                    <td class="end">
                      <span class="row-actions">
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.edit' | translate"
                          (click)="open(p)"
                        >
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          type="button"
                          [attr.aria-label]="'common.delete' | translate"
                          (click)="remove(p)"
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
export class InsuranceProviders {
  private readonly api = inject(InsuranceApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly languages = inject(LanguageService);

  protected readonly providers = signal<InsuranceProvider[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.load();
  }

  private load(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.providers.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected name(p: InsuranceProvider): string {
    return localized(this.languages.language(), p.nameAr, p.nameEn);
  }

  protected open(provider?: InsuranceProvider): void {
    this.dialog
      .open(InsuranceProviderDialog, { data: provider ?? null })
      .afterClosed()
      .pipe(filter((saved): saved is InsuranceProvider => !!saved))
      .subscribe(() => {
        this.toast.success('insurance.saved');
        this.load();
      });
  }

  protected remove(provider: InsuranceProvider): void {
    this.dialog
      .open(ConfirmDialog, {
        data: {
          titleKey: 'insurance.deleteTitle',
          messageKey: 'insurance.deleteMessage',
          messageParams: { name: this.name(provider) },
          confirmKey: 'common.delete',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((ok) => ok === true),
        switchMap(() => this.api.delete(provider.id)),
      )
      .subscribe(() => {
        this.toast.success('insurance.deleted');
        this.load();
      });
  }
}
