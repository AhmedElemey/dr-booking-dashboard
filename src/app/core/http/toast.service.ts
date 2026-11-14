import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

import { errorCode, errorMessageKey } from './error-codes';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  success(key: string, params?: object): void {
    this.open(this.translate.instant(key, params), 'toast-success');
  }

  /** A client-side problem (not an API failure) shown in the error style. */
  failure(key: string): void {
    this.open(this.translate.instant(key), 'toast-error');
  }

  /** Shows the localized message for an API failure (keyed by its `code`). */
  error(error: unknown): void {
    this.open(this.translate.instant(errorMessageKey(errorCode(error))), 'toast-error');
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
