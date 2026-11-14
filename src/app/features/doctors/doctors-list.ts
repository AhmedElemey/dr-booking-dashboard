import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor, Specialty } from '../../core/api/models';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';

/** Clinic doctors with their published flag (staff: all clinic doctors; doctor: self only). */
@Component({
  selector: 'app-doctors-list',
  imports: [RouterLink, MatButton, MatIcon, MatProgressBar, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'doctors.title' | translate }}</h1>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <div class="grid">
        @for (d of doctors(); track d.id) {
          <article class="panel card">
            <div class="avatar" aria-hidden="true">
              @if (d.photoUrl) {
                <img [src]="d.photoUrl" alt="" />
              } @else {
                <mat-icon>person</mat-icon>
              }
            </div>
            <div class="info">
              <h2>{{ name(d) }}</h2>
              <p class="muted">{{ specialtyName(d) }}</p>
              <span class="flag" [class.on]="d.isPublished">
                <mat-icon>{{ d.isPublished ? 'visibility' : 'visibility_off' }}</mat-icon>
                {{ (d.isPublished ? 'doctors.published' : 'doctors.unpublished') | translate }}
              </span>
              @if ((d.consultationFeeEgp ?? null) !== null) {
                <p class="fee muted">
                  {{ 'doctors.fee' | translate }}: {{ d.consultationFeeEgp }}
                  {{ 'common.egp' | translate }}
                </p>
              }
            </div>
            <div class="actions">
              <a mat-stroked-button [routerLink]="['/doctors', d.id]">
                <mat-icon>edit</mat-icon>{{ 'doctors.edit' | translate }}
              </a>
              <a mat-button [routerLink]="['/slots']" [queryParams]="{ doctorId: d.id }">
                <mat-icon>event_available</mat-icon>{{ 'nav.slots' | translate }}
              </a>
            </div>
          </article>
        } @empty {
          @if (!loading()) {
            <p class="muted">{{ 'doctors.empty' | translate }}</p>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      margin-block-start: 8px;
    }
    .card {
      display: grid;
      grid-template-columns: 72px 1fr;
      gap: 16px;
      padding: 20px;
    }
    .avatar {
      inline-size: 72px;
      block-size: 72px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--mat-sys-secondary-container);
      display: grid;
      place-items: center;
      mat-icon {
        font-size: 40px;
        inline-size: 40px;
        block-size: 40px;
      }
      img {
        inline-size: 100%;
        block-size: 100%;
        object-fit: cover;
      }
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    p {
      margin: 4px 0;
    }
    .flag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--ml-cancelled);
      mat-icon {
        font-size: 16px;
        inline-size: 16px;
        block-size: 16px;
      }
      &.on {
        color: var(--ml-completed);
      }
    }
    .actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `,
})
export class DoctorsList {
  private readonly api = inject(DoctorsApi);
  private readonly languages = inject(LanguageService);

  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly loading = signal(true);
  private readonly specialties = signal<Specialty[]>([]);
  private readonly specialtyById = computed(
    () => new Map(this.specialties().map((s) => [s.id, s])),
  );

  constructor() {
    // Names come localized from the API, so reload them when the language changes.
    effect(() => {
      this.languages.language();
      this.api.specialties().subscribe((s) => this.specialties.set(s));
    });
    this.api.list().subscribe({
      next: (doctors) => {
        this.doctors.set(doctors);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected name(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected specialtyName(d: Doctor): string {
    return this.specialtyById().get(d.specialtyId)?.name ?? '';
  }
}
