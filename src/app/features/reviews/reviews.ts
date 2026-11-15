import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

import { DoctorsApi } from '../../core/api/doctors.api';
import { Doctor } from '../../core/api/models';
import { DashboardReview, PageResult, ReviewStatus } from '../../core/api/phase2.models';
import { ReviewsApi } from '../../core/api/reviews.api';
import { ToastService } from '../../core/http/toast.service';
import { LanguageService } from '../../core/i18n/language.service';
import { localized } from '../../core/i18n/localized';
import { ClinicTime } from '../../core/time/clinic-time.service';
import { Rating } from '../../shared/rating';

/** reviews: moderate patient reviews (hide / publish) and reply as the clinic. */
@Component({
  selector: 'app-reviews',
  imports: [
    FormsModule,
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
    Rating,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-title">
        <h1>{{ 'reviews.title' | translate }}</h1>
      </div>

      <div class="filters">
        @if (doctors().length > 1) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'agenda.doctor' | translate }}</mat-label>
            <mat-select [value]="doctorId()" (selectionChange)="setDoctor($event.value)">
              <mat-option value="">{{ 'common.all' | translate }}</mat-option>
              @for (d of doctors(); track d.id) {
                <mat-option [value]="d.id">{{ doctorName(d) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'agenda.status' | translate }}</mat-label>
          <mat-select [value]="status()" (selectionChange)="setStatus($event.value)">
            <mat-option value="">{{ 'common.all' | translate }}</mat-option>
            <mat-option value="Published">{{ 'reviews.status.Published' | translate }}</mat-option>
            <mat-option value="Hidden">{{ 'reviews.status.Hidden' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (result().items.length === 0 && !loading()) {
        <p class="panel empty-state">{{ 'reviews.empty' | translate }}</p>
      }

      <div class="list">
        @for (r of result().items; track r.id) {
          <article class="panel review" [class.hidden-review]="r.status === 'Hidden'">
            <header>
              <app-rating [value]="r.rating" />
              <span class="pill" [class.ok]="r.status === 'Published'">{{
                'reviews.status.' + r.status | translate
              }}</span>
              <span class="grow"></span>
              <span class="muted small">{{ clinicTime.date(r.createdAt) }}</span>
            </header>
            <p class="who">
              <strong>{{ r.doctor.name }}</strong>
              <span class="muted"> - {{ patientLabel(r) }}</span>
            </p>
            @if (r.comment) {
              <p class="comment">{{ r.comment }}</p>
            } @else {
              <p class="muted">{{ 'reviews.noComment' | translate }}</p>
            }

            @if (r.reply && replyingId() !== r.id) {
              <div class="reply">
                <strong>{{ 'reviews.yourReply' | translate }}</strong>
                <p>{{ r.reply }}</p>
              </div>
            }

            @if (replyingId() === r.id) {
              <form class="reply-form" (ngSubmit)="sendReply(r)">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'reviews.reply' | translate }}</mat-label>
                  <textarea
                    matInput
                    name="reply"
                    rows="3"
                    maxlength="1000"
                    [ngModel]="draft()"
                    (ngModelChange)="draft.set($event)"
                  ></textarea>
                </mat-form-field>
                <div class="actions">
                  <button mat-button type="button" (click)="replyingId.set(null)">
                    {{ 'common.cancel' | translate }}
                  </button>
                  <button
                    mat-flat-button
                    type="submit"
                    [disabled]="!draft().trim() || busyId() === r.id"
                  >
                    {{ 'reviews.sendReply' | translate }}
                  </button>
                </div>
              </form>
            } @else {
              <div class="actions">
                <button mat-button type="button" (click)="startReply(r)">
                  <mat-icon>reply</mat-icon
                  >{{ (r.reply ? 'reviews.editReply' : 'reviews.reply') | translate }}
                </button>
                @if (r.status === 'Published') {
                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="busyId() === r.id"
                    (click)="hide(r)"
                  >
                    <mat-icon>visibility_off</mat-icon>{{ 'reviews.hide' | translate }}
                  </button>
                } @else {
                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="busyId() === r.id"
                    (click)="publish(r)"
                  >
                    <mat-icon>visibility</mat-icon>{{ 'reviews.publish' | translate }}
                  </button>
                }
              </div>
            }
          </article>
        }
      </div>

      @if (page() > 1 || hasNext()) {
        <div class="pager">
          <button
            mat-icon-button
            type="button"
            [disabled]="page() <= 1"
            [attr.aria-label]="'agenda.previous' | translate"
            (click)="page.set(page() - 1)"
          >
            <mat-icon class="mirror">chevron_left</mat-icon>
          </button>
          <span class="num">{{ page() }}</span>
          <button
            mat-icon-button
            type="button"
            [disabled]="!hasNext()"
            [attr.aria-label]="'agenda.next' | translate"
            (click)="page.set(page() + 1)"
          >
            <mat-icon class="mirror">chevron_right</mat-icon>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
    }
    .review {
      padding: 16px 20px;
    }
    .hidden-review {
      opacity: 0.75;
    }
    header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .grow {
      flex: 1;
    }
    .small {
      font-size: 12px;
    }
    .who {
      margin: 8px 0 4px;
    }
    .comment {
      margin: 4px 0 8px;
      white-space: pre-wrap;
    }
    .reply {
      margin-block: 8px;
      padding-block: 8px;
      padding-inline: 12px;
      border-inline-start: 3px solid var(--mat-sys-primary);
      background: var(--mat-sys-surface-container-low);
      p {
        margin: 4px 0 0;
        white-space: pre-wrap;
      }
    }
    .reply-form mat-form-field {
      inline-size: 100%;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class Reviews {
  private readonly api = inject(ReviewsApi);
  private readonly doctorsApi = inject(DoctorsApi);
  private readonly toast = inject(ToastService);
  private readonly languages = inject(LanguageService);
  protected readonly clinicTime = inject(ClinicTime);

  protected readonly doctors = signal<Doctor[]>([]);
  protected readonly doctorId = signal('');
  protected readonly status = signal<ReviewStatus | ''>('');
  protected readonly page = signal(1);
  protected readonly result = signal<PageResult<DashboardReview>>({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 0,
  });
  protected readonly loading = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly replyingId = signal<string | null>(null);
  protected readonly draft = signal('');

  constructor() {
    this.doctorsApi.list().subscribe((d) => this.doctors.set(d));
    effect(() => {
      this.load({ doctorId: this.doctorId(), status: this.status(), page: this.page() });
    });
  }

  private load(
    query = { doctorId: this.doctorId(), status: this.status(), page: this.page() },
  ): void {
    this.loading.set(true);
    this.api.list(query).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected setDoctor(id: string): void {
    this.page.set(1);
    this.doctorId.set(id);
  }

  protected setStatus(status: ReviewStatus | ''): void {
    this.page.set(1);
    this.status.set(status);
  }

  protected hasNext(): boolean {
    const r = this.result();
    return r.pageSize > 0 && r.page * r.pageSize < r.totalCount;
  }

  protected doctorName(d: Doctor): string {
    return localized(this.languages.language(), d.nameAr, d.nameEn);
  }

  protected patientLabel(r: DashboardReview): string {
    return r.patient?.fullName || r.patientFirstName || '';
  }

  private run(review: DashboardReview, request$: ReturnType<ReviewsApi['hide']>, key: string) {
    this.busyId.set(review.id);
    request$.subscribe({
      next: () => {
        this.busyId.set(null);
        this.replyingId.set(null);
        this.toast.success(key);
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected hide(r: DashboardReview): void {
    this.run(r, this.api.hide(r.id), 'reviews.hidden');
  }

  protected publish(r: DashboardReview): void {
    this.run(r, this.api.publish(r.id), 'reviews.published');
  }

  protected startReply(r: DashboardReview): void {
    this.draft.set(r.reply ?? '');
    this.replyingId.set(r.id);
  }

  protected sendReply(r: DashboardReview): void {
    const text = this.draft().trim();
    if (!text) return;
    this.run(r, this.api.reply(r.id, text), 'reviews.replied');
  }
}
