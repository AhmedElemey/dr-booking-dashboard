import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { provideTestTranslations } from '../testing/test-providers';
import { App } from './app';
import { LanguageService } from './core/i18n/language.service';
import { LanguageToggle } from './shared/language-toggle';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App, LanguageToggle],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTestTranslations('ar'),
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).use('ar');
  });

  it('starts in Arabic, right to left', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.shell')?.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('switches to English, left to right, from the language toggle', async () => {
    const app = TestBed.createComponent(App);
    const toggle = TestBed.createComponent(LanguageToggle);
    await toggle.whenStable();
    toggle.detectChanges();
    expect(toggle.nativeElement.textContent).toContain('English');

    toggle.nativeElement.querySelector('button').click();
    await app.whenStable();
    app.detectChanges();

    expect(app.nativeElement.querySelector('.shell')?.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
