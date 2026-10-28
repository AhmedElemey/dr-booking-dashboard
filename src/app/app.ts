import { Component, inject } from '@angular/core';
import { Dir } from '@angular/cdk/bidi';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Dir, MatToolbarModule, MatButtonModule, TranslatePipe],
  template: `
    <div class="shell" [dir]="languages.direction()">
      <mat-toolbar>
        <span class="title">{{ 'app.title' | translate }}</span>
        <button mat-button type="button" (click)="languages.toggle()">
          {{ 'app.switchLanguage' | translate }}
        </button>
      </mat-toolbar>
      <main>
        <p>{{ 'app.welcome' | translate }}</p>
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .title {
      flex: 1;
    }
    main {
      padding-block: 24px;
      padding-inline: 24px;
    }
  `,
})
export class App {
  protected readonly languages = inject(LanguageService);
}
