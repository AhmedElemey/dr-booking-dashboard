import { Component, inject } from '@angular/core';
import { Dir } from '@angular/cdk/bidi';
import { RouterOutlet } from '@angular/router';

import { LanguageService } from './core/i18n/language.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Dir],
  template: `
    <div class="shell" [dir]="languages.direction()">
      <router-outlet />
    </div>
  `,
})
export class App {
  protected readonly languages = inject(LanguageService);
}
