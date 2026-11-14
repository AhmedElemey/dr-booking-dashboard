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
