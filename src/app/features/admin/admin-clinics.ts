import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';

import { AdminApi } from '../../core/api/admin.api';
import { AdminUser, Clinic } from '../../core/api/models';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ClinicDialog } from './clinic-dialog';
import { UserDialog } from './user-dialog';

/** Platform admin: clinics list with create / activate, plus account creation and deactivation. */
@Component({
  selector: 'app-admin-clinics',
  imports: [
    FormsModule,
    MatButton,
    MatIcon,
    MatInput,
    MatFormField,
    MatLabel,
    MatHint,
    MatPaginator,
    MatProgressBar,
    MatSlideToggle,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-clinics.html',
  styleUrl: './admin-clinics.scss',
})
export class AdminClinics {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly languages = inject(LanguageService);

  protected readonly clinics = signal<Clinic[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly loading = signal(true);
  /** There is no "list users" endpoint, so accounts created in this session are tracked here. */
  protected readonly createdUsers = signal<(AdminUser & { clinicName: string })[]>([]);
  protected userIdToToggle = '';

  constructor() {
    this.load();
  }

  protected name(c: Clinic): string {
    return localized(this.languages.language(), c.nameAr, c.nameEn);
  }

  protected load(): void {
    this.loading.set(true);
    this.api.clinics(this.page(), this.pageSize()).subscribe({
      next: (res) => {
        this.clinics.set(res.items);
        this.total.set(res.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  protected addClinic(): void {
    this.dialog
      .open(ClinicDialog)
      .afterClosed()
      .pipe(filter((clinic): clinic is Clinic => !!clinic))
      .subscribe(() => {
        this.toast.success('admin.clinicCreated');
        this.load();
      });
  }

  protected setActive(clinic: Clinic, isActive: boolean): void {
    this.api.setClinicActive(clinic.id, isActive).subscribe({
      next: () => {
        this.clinics.update((list) =>
          list.map((c) => (c.id === clinic.id ? { ...c, isActive } : c)),
        );
        this.toast.success(isActive ? 'admin.clinicActivated' : 'admin.clinicDeactivated');
      },
      error: () => this.load(),
    });
  }

  protected addUser(clinic: Clinic): void {
    this.dialog
      .open(UserDialog, { data: { clinicId: clinic.id, clinicName: this.name(clinic) } })
      .afterClosed()
      .pipe(filter((user): user is AdminUser => !!user))
      .subscribe((user) => {
        this.toast.success('admin.userCreated');
        this.createdUsers.update((list) => [
          { ...user, isActive: user.isActive ?? true, clinicName: this.name(clinic) },
          ...list,
        ]);
      });
  }

  protected setUserActive(user: AdminUser, isActive: boolean): void {
    this.api.setUserActive(user.id, isActive).subscribe(() => {
      this.createdUsers.update((list) =>
        list.map((u) => (u.id === user.id ? { ...u, isActive } : u)),
      );
      this.toast.success(isActive ? 'admin.userReactivated' : 'admin.userDeactivated');
    });
  }

  protected toggleById(isActive: boolean): void {
    const id = this.userIdToToggle.trim();
    if (!id) return;
    this.api.setUserActive(id, isActive).subscribe(() => {
      this.toast.success(isActive ? 'admin.userReactivated' : 'admin.userDeactivated');
      this.userIdToToggle = '';
    });
  }
}
