# Handoff

Last updated **after the payment-QR session (28 Sep 2026)**. Resume from here.

## How to resume cheaply — read this first

You do not need to re-read the codebase to make a small change. In order of
value:

1. **Read this file.** ~1.5k tokens, and it carries every decision that is *not*
   recoverable by reading the code.
2. **Grep, don't browse.** The code is cheap to locate (`grep -rn 'resolvePaymentQr'`)
   and expensive to read wholesale. Start from the symbol named below.
3. **Re-run the gates** (below) to confirm the tree is still green before you
   change anything. ~30s, and it tells you whether you inherited a broken tree.

What is genuinely expensive is *rediscovering decisions*, not *reading files*.
That is what this document is for.

If you only need "what did I change today", that is the one thing this project
still cannot answer — see **Not a git repo** below. It is the highest-value
remaining improvement.

## Current state

All gates green at time of writing:

```
npx tsc --noEmit        0 errors
npm run lint            0 problems
npx vitest run          264 tests, 14 files   (was 230/12 before the QR work)
npm run build           clean, 18 routes
npx playwright test     15 passed
```

The production artifact was smoke-tested directly with `next start` (all routes
200, 404 correct, no server-log errors, fonts served as `font/ttf` with correct
sfnt magic bytes).

## Re-verify any time

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test
```

## The on-disk tree is authoritative

There is an **older pasted snapshot** of this project floating around that
disagrees with the real code. It is stale. If you compare against it you will
chase ghosts — it references `Card`, `fetchBrandAction`, a `loading` prop and a
`Field` signature that do not exist here, and shows a truncated
`BusinessProfileClient.tsx` (the real one is 510 lines and complete).

Reality: `SectionCard` / render-prop `Field` / `BrandProfile` /
`fetchBrandProfileAction`, and `globals.css` defines the `shell-*` tokens
(277 references, 0 `slate-*`).

Do not "fix" things based on that snapshot.

## Already fixed — do not redo

- **Inter fonts 404'd.** `scripts/install-fonts.mjs` pulled from
  `gh/rsms/inter@v4.0/docs/font-files/`, a path that 404s in every Inter
  release. Repointed to `@expo-google-fonts/inter@0.2.3` with sfnt magic-byte
  validation. Every exported PDF had been silently printing `Rs.` instead of
  `₹`. Also made the fallback `console.warn` in `lib/export/pdf-document.tsx`.
- **`/dashboard/settings` shipped 237 kB of Supabase browser client** — a
  `"use server"` passthrough (`fetchCurrentUserAction`) pulled `GoTrueClient` +
  realtime into the bundle. Deleted. Now 4.8 kB page / 121 kB First Load.
- **`SITE_URL` resolved to `localhost:3000` on Vercel**, so canonical URLs,
  `og:url`, `robots.txt` and `sitemap.xml` would all have advertised localhost.
  Fixed in `lib/supabase/env.ts` (`resolveSiteUrl()`), with
  `tests/site-url.test.ts` covering it. `robots.ts`/`sitemap.ts` were each
  duplicating the fallback — they now import the single source of truth.
- **ESLint flat config migration.** `.eslintrc.json` deleted,
  `eslint.config.mjs` added (FlatCompat — `eslint-config-next` 15.1.6 has no
  native flat entry), `lint` script is `eslint .`. `next lint` is **removed in
  Next 16**; you're on 15.1.6.
- **Fonts vendored** — `public/fonts/*.ttf` un-ignored so builds don't depend
  on a CDN at build time.

Note: the old `next lint` reported zero problems while two real errors existed
(dead `readFile` import in `e2e/exports.spec.ts`, dead `page` fixture in
`e2e/routes.spec.ts`). Both fixed. Don't trust a clean lint as proof of
anything without knowing which config produced it.

## Deploy steps — manual, in this order

1. **Env vars, before the first build.** `NEXT_PUBLIC_*` values are inlined at
   build time, so setting them afterwards has no effect.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_BUCKET` (optional, defaults to `invoice-assets`)
   - `NEXT_PUBLIC_SITE_URL` (optional — the Vercel fallback covers it)
2. **Supabase → Authentication → URL Configuration → Redirect URLs**: add
   `https://<your-domain>/auth/callback`. `supabase/config.toml:36` only has
   `http://localhost:3000/auth/callback` today.
3. **`supabase db push`** — applies `supabase/migrations/0001_init.sql`
   (tables, the `invoice-assets` bucket, and its `storage.objects` RLS
   policies).
4. **This is not a git repo yet.** `git init` + push for Vercel's Git
   integration, or just use the `vercel` CLI.

The app deliberately boots in **guest mode** when Supabase is unconfigured, so
it will deploy and run with zero secrets — you just get no sign-in and no cloud
sync. That is not a crash; don't misread it as a broken deploy.

## Payment QR — read before touching this feature

An invoice can carry a scannable code, printed beside the bank details in the
**live preview, the PDF and the JPEG**. Two ways to get one:

- `mode: "upi"` — we build a `upi://pay?pa=…&am=…&cu=INR&tn=…` deep link from the
  invoice's own UPI ID. `includeAmount` locks the grand total in, so the payer
  only confirms. It re-encodes whenever the total changes.
- `mode: "upload"` — a raster image the user supplied.

`mode: "none"` prints nothing.

### Where it lives

| Concern | File |
|---|---|
| UPI deep link, VPA validation, `%20`-not-`+` encoding | `lib/payment/upi.ts` |
| Matrix → PNG (canvas), caching, single resolver | `lib/payment/qr.ts` |
| Post-mount hook (SSR has no canvas) | `lib/payment/use-payment-qr.ts` |
| Preview block | `components/invoice/PaymentQrBlock.tsx` |
| PDF block | `PdfPaymentQr` in `lib/export/pdf-document.tsx` |
| Editor UI | `components/editor/PaymentQrField.tsx` |
| Per-upload file rules (shared with the API route) | `ASSET_RULES` in `lib/validation/file.ts` |
| Back-compat for stored payloads | `lib/invoice/normalize.ts` |
| Tests | `tests/upi.test.ts`, `tests/normalize.test.ts`, `tests/file.test.ts` |

### Invariants — do not break these

- **One resolver.** Preview, PDF and JPEG all call `resolvePaymentQr`. That is
  why the three exports encode an identical payload. If you add a fourth
  renderer, route it through the same function rather than re-deriving.
- **PNG, not SVG, for generated codes.** react-pdf has no SVG rasteriser; a
  data-URL PNG embeds directly.
- **No `document` during render.** The rasteriser needs a canvas, which the
  server does not have. `usePaymentQr` resolves in an effect so SSR and first
  client paint agree. Calling `resolvePaymentQr` directly in a component breaks
  the build with `ReferenceError: document is not defined` — this actually
  happened, on `/dev/long-invoice`.
- **Print size is 84pt** (`QR_SIZE` in `lib/invoice/layout-metrics.ts`), and
  `layout-metrics` reserves that height so the footer cannot overflow a page.
  A 4-module quiet zone is baked into the generated PNG.
- **SVG is rejected for QR uploads only** (`ASSET_RULES["payment-qr"]`), capped
  at 512 KB. Logos and signatures still allow SVG at 2 MB. The client, the file
  picker and `app/api/upload/route.ts` all read the same table.
- **Stored payloads pass through `normalizeInvoice`.** Adding a field means
  adding it to `lib/invoice/normalize.ts` too, or old invoices render with
  `undefined` in the new slot. Invoices are whole-JSON documents, so there is no
  migration to write.
- A **zero or negative total deliberately omits `am=`** rather than encoding
  `am=0.00`. That is intended, not a bug.

### Verified how

The codes were decoded with a real scanner (OpenCV `QRCodeDetector`) out of the
live preview, out of the PDF rasterised through pdfium, and out of the exported
JPEG — all three returned the identical payload. If you change the encoder, keep
that check; a QR that renders but does not scan is invisible in a screenshot.

## Silent-failure traps

These all pass CI and the build, then break only in production:

| Symptom | Cause |
|---|---|
| No sign-in, no errors | `NEXT_PUBLIC_*` unset at build time (guest mode) |
| `/auth/callback` bounces wrong | Redirect URLs not updated in Supabase |
| Uploads fail at runtime | Migration not applied to hosted project |
| PDFs print `Rs.` not `₹` | Fonts unreachable — now `console.warn`s |
| Canonical = localhost | `SITE_URL` — verify with `curl /sitemap.xml` post-deploy |
| Random 500s after running a build | `next build` and `next dev` share `.next`. Kill the dev server, `rm -rf .next`, restart. Hit this twice in one session. |
| Build dies on `document is not defined` | Server-rendered component touching the canvas — see the QR invariants above |
| Preview says N pages, PDF has N+1 | **Pre-existing**, see below — not QR-related |

## Known bug — preview/PDF pagination diverges

At ~27+ line items the live preview paginates to 2 pages but the exported PDF
renders 3. Confirmed **identical with and without** the payment QR, so it is a
divergence between the DOM preview and react-pdf's layout engine, not a QR
regression. Left unfixed deliberately. If you pick it up: compare
`paginateInvoiceItems` in `lib/invoice/paginate.ts` against the height
accounting in `lib/invoice/layout-metrics.ts` — the two engines round row
heights differently.

## Not a git repo

Still true, and it is the main reason a resumed session costs more than it
should: there is no way to ask "what changed since yesterday" without re-reading
files. `git init` + a first commit would make that a `git diff`, and would also
unblock Vercel's Git integration (see Deploy steps). Not done here because it is
a project-setup decision, not a code change.

## Test plan

Automated (15 e2e + 264 unit) already covers: guest invoice flow, PDF + JPEG
export, palette repaint, 404, robots/sitemap, all routes, UPI URI construction,
payload normalization, and per-upload asset rules. Re-run before deploying.

Still needs a human with real Supabase credentials:

- Sign in / sign up end-to-end
- Create an invoice in the cloud, reload, confirm persistence
- Export a PDF and **visually confirm the ₹ glyph renders** (not `Rs.` — this
  is the one thing CI cannot assert)
- Upload a logo (exercises storage RLS)
- Upload a **payment QR** through the real API route (exercises the 512 KB and
  no-SVG rules server-side — the browser check only proves the client path)
- After deploy: `curl https://<domain>/sitemap.xml` and confirm the `<loc>` is
  the real domain

## Useful commands

```bash
npm run dev            # dev server
npm run build          # fonts:install && next build
npm run fonts:install  # re-fetch Inter (no-ops if present)
npm run test:e2e       # playwright
npx next start -p 3210   # run the real production build locally
```

Never run `npm run build` while `npm run dev` is up — they share `.next` and the
dev server 500s until you restart it.
