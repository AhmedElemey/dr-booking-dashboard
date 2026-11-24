import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

import { FeaturesService } from '../config/features.service';
import {
  couponReasonKey,
  errorCode,
  errorMessageKey,
  problemOf,
  transitionDetailKey,
  validationMessages,
} from './error-codes';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly features = inject(FeaturesService);

  success(key: string, params?: object): void {
    this.open(this.translate.instant(key, params), 'toast-success');
  }

  /** A client-side problem (not an API failure) shown in the error style. */
  failure(key: string): void {
    this.open(this.translate.instant(key), 'toast-error');
  }

  /** Shows the localized message for an API failure (keyed by its `code`). */
  error(error: unknown): void {
    const code = errorCode(error);
    if (code === 'FEATURE_DISABLED') {
      const feature = problemOf(error)?.feature;
      this.features.reportDisabled(feature);
      const name = this.translate.instant(`features.names.${feature}`);
      this.open(
        this.translate.instant(errorMessageKey(code), {
          feature: name.startsWith('features.names.') ? (feature ?? '') : name,
        }),
        'toast-error',
      );
      return;
    }
    if (code === 'INVALID_TRANSITION') {
      // The API says why (for example "The visit has not started yet."). Known reasons are shown
      // in the UI language; any other reason is shown as the API wrote it.
      const detail = problemOf(error)?.detail;
      if (typeof detail === 'string' && detail.trim().length > 0) {
        const known = transitionDetailKey(detail);
        if (known) {
          const params = known.status
            ? { status: this.translate.instant(`status.${known.status}`) }
            : undefined;
          this.open(this.translate.instant(known.key, params), 'toast-error');
        } else {
          this.open(detail, 'toast-error');
        }
        return;
      }
    }
    const key = (code === 'COUPON_INVALID' && couponReasonKey(error)) || errorMessageKey(code);
    let message = this.translate.instant(key);
    if (code === 'VALIDATION_FAILED') {
      // The API names the offending field (e.g. "This date is already a holiday.").
      const details = validationMessages(error);
      if (details.length > 0) message = `${message} ${details.join(' ')}`;
    }
    this.open(message, 'toast-error');
  }

  private open(message: string, panelClass: string): void {
    this.snackBar.open(message, this.translate.instant('common.close'), {
      duration: 5000,
      panelClass,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
