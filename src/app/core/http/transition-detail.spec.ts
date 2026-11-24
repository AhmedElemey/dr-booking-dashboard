import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import { TRANSITION_DETAILS, transitionDetailKey } from './error-codes';

describe('transitionDetail translations', () => {
  const arKeys = Object.keys(ar.transitionDetail).sort();
  const enKeys = Object.keys(en.transitionDetail).sort();

  it('has the same keys in Arabic and English', () => {
    expect(arKeys).toEqual(enKeys);
  });

  it('has a text in both languages for every detail the dashboard maps', () => {
    const mapped = [...Object.values(TRANSITION_DETAILS), 'alreadyStatus'];
    for (const key of mapped) {
      expect(arKeys, `ar.json is missing transitionDetail.${key}`).toContain(key);
      expect(enKeys, `en.json is missing transitionDetail.${key}`).toContain(key);
    }
  });

  it('has no unused transitionDetail keys', () => {
    const mapped = new Set([...Object.values(TRANSITION_DETAILS), 'alreadyStatus']);
    expect(enKeys.filter((key) => !mapped.has(key))).toEqual([]);
  });

  it('maps "already <status>" to the status text key', () => {
    expect(transitionDetailKey('The appointment is already Completed.')).toEqual({
      key: 'transitionDetail.alreadyStatus',
      status: 'Completed',
    });
  });
});
