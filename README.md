# Invoice Studio

GST-compliant invoice builder for Indian businesses. Live A4 preview, brand colours, and
text-selectable PDF export. Works without an account; signing in adds saved invoices, a reusable
business profile, and sequential numbering.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Zustand · Zod · Supabase (Postgres, Auth,
Storage) · @react-pdf/renderer · Vitest · Playwright

## Getting started

```bash
npm install          # postinstall downloads the Inter fonts into public/fonts
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The editor at `/invoices/new` works immediately; Supabase is only
required for authentication and persistence.

### Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin, used for auth redirects and metadata |
| `SUPABASE_BUCKET` | Storage bucket for logos and signatures |

### Database

```bash
supabase start
supabase db push          # applies supabase/migrations/0001_init.sql
```

Create a private storage bucket matching `SUPABASE_BUCKET`. Row-level security policies in the
migration scope every table to `auth.uid()`.

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest unit tests
npm run test:e2e     # playwright
npm run fonts:install
```

## Architecture notes

Money is stored as integer paise everywhere; quantities are integers scaled by 1000. Nothing is
kept as a float, so totals never drift by a rupee. Conversions live in `lib/money.ts` and all
display formatting in `lib/formatting/inr.ts`.

The preview is the export. `lib/invoice/layout-metrics.ts` defines A4 geometry in points, and
`lib/invoice/paginate.ts` uses those same metrics for both the on-screen preview and the
`@react-pdf/renderer` document, so pagination matches exactly.

Editor state lives in a single Zustand store (`lib/store/invoice-store.ts`) that recalculates
totals on every mutation. Autosave debounces at 1.5s via `lib/hooks/use-autosave.ts`; guests get
a localStorage draft instead of a network write.

Invoices persist a snapshot of the business and client details at issue time, so editing your
profile later never rewrites history on invoices already sent.

## Testing

Unit tests cover the money layer, GST calculation, pagination, Indian identifier validation,
numbering, contrast, and filenames. Playwright covers the guest flow end to end and the
`/dev/long-invoice` harness that verifies multi-page layout.

## Disclaimer

Invoice Studio helps you produce documents; it is not tax advice. Verify GST treatment,
place-of-supply rules, and reverse-charge applicability with your accountant.
