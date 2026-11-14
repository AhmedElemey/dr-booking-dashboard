import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { AppLang } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-account',
  imports: [MatButton, MatIcon, MatButtonToggleGroup, MatButtonToggle, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page narrow">
      <div class="page-title">
        <h1>{{ 'nav.account' | translate }}</h1>
      </div>
      <section class="panel box">
        <dl>
          <dt>{{ 'account.name' | translate }}</dt>
          <dd>{{ auth.user()?.fullName || '-' }}</dd>
          <dt>{{ 'account.phone' | translate }}</dt>
          <dd>
            <span class="ltr-text">{{ auth.user()?.phone }}</span>
          </dd>
          <dt>{{ 'account.role' | translate }}</dt>
          <dd>{{ 'roles.' + auth.role() | translate }}</dd>
        </dl>

        <h2>{{ 'account.language' | translate }}</h2>
        <mat-button-toggle-group
          [value]="languages.language()"
          (change)="setLanguage($event.value)"
          [attr.aria-label]="'account.language' | translate"
        >
          <mat-button-toggle value="ar">العربية</mat-button-toggle>
          <mat-button-toggle value="en">English</mat-button-toggle>
        </mat-button-toggle-group>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="auth.logout().subscribe()">
            <mat-icon>logout</mat-icon>
            {{ 'nav.logout' | translate }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .narrow {
      max-inline-size: 640px;
    }
    .box {
      padding: 24px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 24px;
      margin: 0 0 24px;
    }
    dt {
      color: var(--mat-sys-on-surface-variant);
    }
    dd {
      margin: 0;
    }
    h2 {
      font: var(--mat-sys-title-medium);
    }
    .actions {
      margin-block-start: 32px;
    }
  `,
})
export class Account {
  protected readonly auth = inject(AuthService);
  protected readonly languages = inject(LanguageService);

  protected setLanguage(language: AppLang): void {
    this.languages.use(language);
    this.auth.savePreferredLanguage(language);
  }
}
