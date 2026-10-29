import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint, MatLabel, MatError, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { interval, take } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { homeFor } from '../../core/auth/guards';
import { errorCode, errorMessageKey } from '../../core/http/error-codes';
import { egyptPhoneValidator, normalizeEgyptPhone } from '../../core/validators/phone';
import { LanguageToggle } from '../../shared/language-toggle';

const RESEND_SECONDS = 60;

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatSuffix,
    MatIcon,
    MatInput,
    MatProgressSpinner,
    TranslatePipe,
    LanguageToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly step = signal<'phone' | 'code'>('phone');
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly resendIn = signal(0);

  protected readonly phoneForm = this.fb.nonNullable.group({
    phone: ['', [Validators.required, egyptPhoneValidator]],
  });
  protected readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  private phone = '';

  protected sendCode(): void {
    if (this.phoneForm.invalid || this.busy()) {
      this.phoneForm.markAllAsTouched();
      return;
    }
    this.phone = normalizeEgyptPhone(this.phoneForm.controls.phone.value)!;
    this.busy.set(true);
    this.errorKey.set(null);
    this.auth.requestOtp(this.phone).subscribe({
      next: () => {
        this.busy.set(false);
        this.step.set('code');
        this.startResendTimer();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected verify(): void {
    if (this.codeForm.invalid || this.busy()) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.errorKey.set(null);
    this.auth.verifyOtp(this.phone, this.codeForm.controls.code.value).subscribe({
      next: (user) => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : homeFor(user.role));
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected back(): void {
    this.step.set('phone');
    this.errorKey.set(null);
    this.codeForm.reset();
  }

  protected resend(): void {
    if (this.resendIn() > 0) return;
    this.sendCode();
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.errorKey.set(errorMessageKey(errorCode(error)));
  }

  private startResendTimer(): void {
    this.resendIn.set(RESEND_SECONDS);
    interval(1000)
      .pipe(take(RESEND_SECONDS), takeUntilDestroyed(this.destroyRef))
      .subscribe((tick) => this.resendIn.set(RESEND_SECONDS - tick - 1));
  }
}
