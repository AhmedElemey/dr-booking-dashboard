import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { PatientsApi } from '../../core/api/patients.api';
import { PageResult, PatientRow } from '../../core/api/phase2.models';
import { ClinicTime } from '../../core/time/clinic-time.service';

/** patientRecords: searchable list of the patients who have visited the clinic. */
@Component({
  selector: 'app-patients',
  imports: [
    FormsModule,
    RouterLink,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatIcon,
    MatProgressBar,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'patients.title' | translate }}</h1>
      </div>

      <form class="filters" role="search" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
          <mat-label>{{ 'patients.search' | translate }}</mat-label>
          <input
            matInput
            type="search"
            name="search"
            autocomplete="off"
            [ngModel]="draft()"
            (ngModelChange)="draft.set($event)"
          />
          <mat-icon matSuffix aria-hidden="true">search</mat-icon>
        </mat-form-field>
        <button mat-flat-button type="submit">{{ 'patients.searchAction' | translate }}</button>
      </form>

      <section class="panel">
        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @if (result().items.length === 0 && !loading()) {
          <p class="empty-state">{{ 'patients.empty' | translate }}</p>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">{{ 'agenda.col.patient' | translate }}</th>
                  <th scope="col">{{ 'agenda.col.phone' | translate }}</th>
                  <th scope="col">{{ 'patients.lastVisit' | translate }}</th>
                  <th scope="col">{{ 'patients.visits' | translate }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ 'common.actions' | translate }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (p of result().items; track p.id) {
                  <tr>
                    <td>
                      <a class="name" [routerLink]="['/patients', p.id]">{{
                        p.fullName || p.phone
                      }}</a>
                    </td>
                    <td>
                      <span class="ltr-text">{{ p.phone }}</span>
                    </td>
                    <td>{{ p.lastVisitAt ? clinicTime.date(p.lastVisitAt) : '-' }}</td>
                    <td class="num">{{ p.appointmentsCount }}</td>
                    <td class="end">
                      <a mat-stroked-button [routerLink]="['/patients', p.id]">
                        <mat-icon>folder_open</mat-icon>{{ 'patients.open' | translate }}
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (hasPages()) {
            <div class="pager">
              <button
                mat-icon-button
                type="button"
                [disabled]="page() <= 1"
                [attr.aria-label]="'agenda.previous' | translate"
                (click)="go(page() - 1)"
              >
                <mat-icon class="mirror">chevron_left</mat-icon>
              </button>
              <span class="num">{{ page() }}</span>
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasNext()"
                [attr.aria-label]="'agenda.next' | translate"
                (click)="go(page() + 1)"
              >
                <mat-icon class="mirror">chevron_right</mat-icon>
              </button>
            </div>
          }
        }
      </section>
    </div>
  `,
  styles: `
    .search {
      flex: 1 1 320px;
      max-inline-size: 480px;
    }
    .name {
      font-weight: 500;
      color: var(--mat-sys-primary);
      text-decoration: none;
    }
  `,
})
export class Patients {
  private readonly api = inject(PatientsApi);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly draft = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly result = signal<PageResult<PatientRow>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 0,
  });
  protected readonly loading = signal(false);

  constructor() {
    effect(() => {
      const search = this.search();
      const page = this.page();
      this.loading.set(true);
      this.api.list(search, page).subscribe({
        next: (result) => {
          this.result.set(result);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });
  }

  protected submit(): void {
    this.page.set(1);
    this.search.set(this.draft().trim());
  }

  protected hasPages(): boolean {
    return this.page() > 1 || this.hasNext();
  }

  protected hasNext(): boolean {
    const r = this.result();
    return r.pageSize > 0 && r.page * r.pageSize < r.totalCount;
  }

  protected go(page: number): void {
    this.page.set(page);
  }
}
