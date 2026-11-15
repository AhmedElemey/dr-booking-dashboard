import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { flushDoctors, internals, pendingGet, setupPage } from '../../testing/phase2';
import { ApplyTemplateDialog } from './slots/apply-template-dialog';
import { CampaignDialog, Recall } from './recall/recall';
import { RecordDialog } from './patients/record-dialog';
import { TemplateDialog } from './working-hours/template-dialog';
import { WorkingHours } from './working-hours/working-hours';

const dialogProviders = (data: unknown) => {
  const close = vi.fn();
  return {
    close,
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  };
};

describe('TemplateDialog', () => {
  const open = (template?: unknown) => {
    const d = dialogProviders({ template });
    const h = setupPage(TemplateDialog, { providers: d.providers });
    h.fixture.detectChanges();
    return { h, d, c: internals(h.fixture) };
  };

  it('needs a name before it saves', () => {
    const { h, c } = open();
    c['save']();
    expect(c['submitted']()).toBe(true);
    expect(c['problems']()).toContain('name');
    h.backend.expectNone(() => true);
  });

  it('fills the usual Egyptian week in one click', () => {
    const { c } = open();
    c['addWorkWeek']();
    expect(c['rules']().map((r: { dayOfWeek: string }) => r.dayOfWeek)).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
    ]);
  });

  it('reports overlapping and empty rule sets and blocks saving', () => {
    const { h, c } = open();
    c['name'].set('Mornings');
    c['rules'].update((r: unknown[]) => [...r, ...r]);
    expect(c['problems']()).toContain('overlap');
    c['save']();
    h.backend.expectNone(() => true);
    c['rules'].set([]);
    expect(c['problems']()).toContain('none');
  });

  it('posts the template without the editor ids', () => {
    const { h, d, c } = open();
    c['name'].set(' Mornings ');
    c['slotMinutes'].set(20);
    c['save']();
    const req = h.backend.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toEqual({
      name: 'Mornings',
      slotMinutes: 20,
      rules: [{ dayOfWeek: 'Sunday', start: '09:00', end: '14:00' }],
    });
    req.flush({ id: 't1', rules: [] });
    expect(d.close).toHaveBeenCalled();
  });

  it('updates an existing template', () => {
    const { h, c } = open({
      id: 't9',
      name: 'Old',
      slotMinutes: 30,
      rules: [{ dayOfWeek: 'Monday', start: '10:00', end: '12:00' }],
    });
    c['save']();
    h.backend.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/t9')).flush({ rules: [] });
  });
});

describe('WorkingHours', () => {
  it('lists templates with summarized hours and deletes one', async () => {
    const h = setupPage(WorkingHours);
    h.fixture.detectChanges();
    const t = {
      id: 't1',
      name: 'Standard week',
      slotMinutes: 30,
      rules: [
        { dayOfWeek: 'Sunday', start: '09:00', end: '14:00' },
        { dayOfWeek: 'Monday', start: '09:00', end: '14:00' },
      ],
    };
    pendingGet(h.backend, '/dashboard/working-hours-templates').flush([t]);
    await h.settle();
    expect(h.el.textContent).toContain('Standard week');
    expect(h.el.textContent).toContain('09:00-14:00');
    internals(h.fixture)['remove'](t);
    h.backend.expectOne((r) => r.method === 'DELETE').flush(null);
    pendingGet(h.backend, '/dashboard/working-hours-templates').flush([]);
  });
});

describe('ApplyTemplateDialog', () => {
  const open = (templates: unknown[]) => {
    const d = dialogProviders({ doctorId: 'd1', startDate: '2026-11-15' });
    const h = setupPage(ApplyTemplateDialog, { providers: d.providers });
    h.fixture.detectChanges();
    pendingGet(h.backend, '/dashboard/working-hours-templates').flush(templates);
    return { h, c: internals(h.fixture) };
  };
  const tpl = (id: string) => ({ id, name: id, slotMinutes: 30, rules: [] });

  it('preselects the only template and applies it to a 4 week range', () => {
    const { h, c } = open([tpl('t1')]);
    expect(c['templateId']()).toBe('t1');
    expect(c['toDate']()).toBe('2026-12-12');
    c['apply']();
    const req = h.backend.expectOne((r) => r.method === 'POST');
    expect(req.request.url).toContain('/dashboard/doctors/d1/slots/apply-template');
    expect(req.request.body).toEqual({
      templateId: 't1',
      fromDate: '2026-11-15',
      toDate: '2026-12-12',
    });
    req.flush({
      created: 20,
      skipped: 2,
      skippedSlots: [{ startsAt: 'x', reason: 'holiday' }],
    });
    expect(c['holidaySkips']()).toBe(1);
    expect(c['changed']()).toBe(true);
  });

  it('refuses without a chosen template or with a range over 92 days', () => {
    const { h, c } = open([tpl('a'), tpl('b')]);
    expect(c['templateId']()).toBe('');
    c['apply']();
    h.backend.expectNone(() => true);
    c['templateId'].set('a');
    c['toDate'].set('2027-03-01');
    expect(c['rangeValid']()).toBe(false);
    c['apply']();
    h.backend.expectNone(() => true);
  });
});

describe('CampaignDialog', () => {
  const open = (campaign?: unknown) => {
    const d = dialogProviders({ campaign, doctors: [] });
    const h = setupPage(CampaignDialog, { providers: d.providers });
    h.fixture.detectChanges();
    return { h, d, c: internals(h.fixture) };
  };

  it('validates the message and the month range', () => {
    const { h, c } = open();
    c['save']();
    h.backend.expectNone(() => true);
    c['form'].patchValue({ name: 'n', messageAr: 'ا', messageEn: 'a', monthsSinceLastVisit: 0 });
    expect(c['form'].valid).toBe(false);
    c['form'].patchValue({ monthsSinceLastVisit: 61 });
    expect(c['form'].valid).toBe(false);
    c['form'].patchValue({ monthsSinceLastVisit: 12 });
    expect(c['form'].valid).toBe(true);
  });

  it('creates the campaign', () => {
    const { h, d, c } = open();
    c['form'].patchValue({ name: ' Check-up ', messageAr: 'ا', messageEn: 'a' });
    c['save']();
    const req = h.backend.expectOne((r) => r.method === 'POST');
    expect(req.request.body).toMatchObject({
      name: 'Check-up',
      channel: 'Auto',
      monthsSinceLastVisit: 6,
      mode: 'OneOff',
      doctorId: null,
      serviceId: null,
    });
    req.flush({ id: 'k1' });
    expect(d.close).toHaveBeenCalled();
  });
});

describe('Recall', () => {
  const campaign = {
    id: 'k1',
    name: 'Check-up',
    messageAr: 'ا',
    messageEn: 'a',
    channel: 'Auto',
    monthsSinceLastVisit: 6,
    mode: 'OneOff',
    isActive: true,
  };

  it('lists campaigns and sends one now after confirmation', async () => {
    const h = setupPage(Recall);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/recall-campaigns').flush([campaign]);
    await h.settle();
    expect(h.el.textContent).toContain('Check-up');
    internals(h.fixture)['sendNow'](campaign);
    h.backend
      .expectOne((r) => r.method === 'POST' && r.url.endsWith('/recall-campaigns/k1/send-now'))
      .flush({ sent: 4, failed: 0 });
    pendingGet(h.backend, '/dashboard/recall-campaigns').flush([campaign]);
    expect(h.snackOpen).toHaveBeenCalled();
  });

  it('does not send when the confirmation is dismissed', async () => {
    const h = setupPage(Recall, { dialogResults: [false] });
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/recall-campaigns').flush([campaign]);
    internals(h.fixture)['sendNow'](campaign);
    h.backend.expectNone((r) => r.method === 'POST');
  });

  it('opens the preview and the sends log in dialogs', async () => {
    const h = setupPage(Recall);
    h.fixture.detectChanges();
    flushDoctors(h.backend);
    pendingGet(h.backend, '/dashboard/recall-campaigns').flush([campaign]);
    internals(h.fixture)['preview'](campaign);
    internals(h.fixture)['sends'](campaign);
    expect(h.dialogOpen).toHaveBeenCalledTimes(2);
  });
});

describe('RecordDialog', () => {
  const open = (entry?: unknown) => {
    const d = dialogProviders({ userId: 'u1', familyMemberId: null, entry, appointments: [] });
    const h = setupPage(RecordDialog, { providers: d.providers });
    h.fixture.detectChanges();
    return { h, d, c: internals(h.fixture) };
  };
  const pick = (c: ReturnType<typeof open>['c'], file: File) => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    c['onFile']({ target: input } as unknown as Event);
  };

  it('requires a title', () => {
    const { h, c } = open();
    c['save']();
    h.backend.expectNone(() => true);
  });

  it('creates an entry and then uploads the chosen attachment', () => {
    const { h, d, c } = open();
    pick(c, new File(['x'], 'scan.pdf', { type: 'application/pdf' }));
    expect(c['form'].controls.title.value).toBe('scan.pdf');
    expect(c['form'].controls.kind.value).toBe('Attachment');
    c['save']();
    const post = h.backend.expectOne((r) => r.method === 'POST');
    expect(post.request.url).toContain('/dashboard/patients/u1/records');
    post.flush({ id: 'e1' });
    const put = h.backend.expectOne((r) => r.method === 'PUT');
    expect(put.request.url).toContain('/dashboard/records/e1/attachment');
    put.flush({ id: 'e1' });
    expect(d.close).toHaveBeenCalledWith(true);
  });

  it('rejects unsupported types and files over 10 MB', () => {
    const { c, h } = open();
    pick(c, new File(['x'], 'run.exe', { type: 'application/x-msdownload' }));
    expect(c['pickedFile']()).toBeNull();
    const big = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    pick(c, big);
    expect(c['pickedFile']()).toBeNull();
    expect(h.snackOpen).toHaveBeenCalledTimes(2);
  });
});
