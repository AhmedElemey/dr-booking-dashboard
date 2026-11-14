import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { FeaturesService } from '../core/config/features.service';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/i18n/language.service';

/** Switches between Arabic (RTL) and English (LTR); also saves it to the profile when signed in. */
@Component({
  selector: 'app-language-toggle',
  imports: [MatButton, MatIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (features.englishLanguage()) {
      <button mat-button type="button" class="language-toggle" (click)="toggle()">
        <mat-icon>translate</mat-icon>
        {{ 'app.switchLanguage' | translate }}
      </button>
    }
  `,
})
export class LanguageToggle {
  private readonly languages = inject(LanguageService);
  private readonly auth = inject(AuthService);
  protected readonly features = inject(FeaturesService);

  protected toggle(): void {
    this.languages.toggle();
    this.auth.savePreferredLanguage(this.languages.language());
  }
}
