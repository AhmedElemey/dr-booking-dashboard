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

## Rebrand for a clinic

A clinic's identity lives in `clinic.config.json` (schema: `clinic.config.schema.json`, logo: `branding/logo.svg`). Edit it and run `npm run brand`; the script also runs automatically before `npm start`, `build`, `watch`, `test` and `lint`. It validates the file and generates:

- `src/app/core/config/brand.generated.ts`: clinic name (ar/en), tagline, colours, default features
- `src/styles/_brand.generated.scss`: Material palettes from `colors.primary` (primary) and `colors.accent` (tertiary) plus the `--ml-brand-*` CSS variables
- the `<title>` and `theme-color` in `src/index.html` (between the `brand:` markers) and `public/branding/logo.svg`

Commit the generated files; `npm run brand:check` (run in CI) fails when they are stale. Translations use a `{{brand}}` placeholder that is filled with the configured name for the language.

## Feature switches

`GET /api/v1/features` is fetched at startup and every 5 minutes; the last answer is cached in `localStorage` and the defaults in `clinic.config.json` apply until the first answer (or when the backend is unreachable). Effects in the dashboard: `englishLanguage` off hides the language switch and forces Arabic; `multiBranch` off hides the admin "new clinic" button. `patientSelfService` is exposed by `FeaturesService` but staff can always cancel. A `403 FEATURE_DISABLED` problem shows a localized toast and a banner.

## Demo (mock) mode

`npm run ng -- serve --configuration mock` (or `npx ng build --configuration mock`) swaps in an in-memory fake API (a Cairo clinic, 3 doctors, a week of slots, ~12 appointments). Sign in with any phone and code `123456`: `01000000001` is the platform admin, `01000000011` a doctor, anything else clinic staff. The mock API also serves `/features` (the config defaults) and `/branding`. The mock code is excluded from production builds via Angular file replacements.
