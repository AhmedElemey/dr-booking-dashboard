# moonlight-dashboard

Clinic and admin dashboard for Moonlight, a dentist reservation platform. Angular 21 (standalone components + signals), Angular Material, and `@ngx-translate/core` for Arabic and English with RTL. The product spec lives in [moonlight-backend/docs/SPEC.md](https://github.com/AhmedElemey/moonlight-backend/blob/main/docs/SPEC.md).

## Develop

```bash
npm ci
npm start        # http://localhost:4200
npm run lint
npm test         # Vitest
npm run build    # production build
```

Translations are in `public/i18n/{ar,en}.json`. The app starts in Arabic (RTL); the toolbar button switches language and direction.

API base URLs are in `src/environments/` (`environment.prod.ts` is swapped in for production builds).

## Demo (mock) mode

`npm run ng -- serve --configuration mock` (or `npx ng build --configuration mock`) swaps in an in-memory fake API (a Cairo clinic, 3 doctors, a week of slots, ~12 appointments). Sign in with any phone and code `123456`: `01000000000` is the platform admin, `01011111111` a doctor, anything else clinic staff. The mock code is excluded from production builds via Angular file replacements.
