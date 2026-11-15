import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/** Read-only 1..5 star rating with a text alternative. */
@Component({
  selector: 'app-rating',
  imports: [MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="stars"
      role="img"
      [attr.aria-label]="'reviews.ratingOf' | translate: { rating: value() }"
    >
      @for (on of stars(); track $index) {
        <mat-icon class="star" [class.on]="on" aria-hidden="true">{{
          on ? 'star' : 'star_border'
        }}</mat-icon>
      }
    </span>
  `,
  styles: `
    .stars {
      display: inline-flex;
      vertical-align: middle;
    }
    .star {
      font-size: 18px;
      inline-size: 18px;
      block-size: 18px;
      color: var(--mat-sys-outline);
      &.on {
        color: #e8a100;
      }
    }
  `,
})
export class Rating {
  readonly value = input.required<number>();
  protected readonly stars = computed(() =>
    [1, 2, 3, 4, 5].map((n) => n <= Math.round(this.value())),
  );
}
