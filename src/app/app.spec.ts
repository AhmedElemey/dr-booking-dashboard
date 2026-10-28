import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { App } from './app';
import { LanguageService } from './core/i18n/language.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideTranslateService({ fallbackLang: 'en' })],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      app: { title: 'Moonlight Dashboard', switchLanguage: 'العربية' },
    });
    translate.setTranslation('ar', {
      app: { title: 'لوحة تحكم مون لايت', switchLanguage: 'English' },
    });
    TestBed.inject(LanguageService).use('ar');
  });

  it('starts in Arabic, right to left', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.shell')?.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(root.querySelector('.title')?.textContent).toContain('لوحة تحكم مون لايت');
  });

  it('switches to English, left to right, from the toolbar toggle', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('.shell')?.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(root.querySelector('.title')?.textContent).toContain('Moonlight Dashboard');
  });
});
