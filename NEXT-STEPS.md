# Next steps

Live app: **https://shahin-invoice-studio.vercel.app**

Everything ships and auto-deploys from GitHub. Only two small things are left,
both cosmetic. Nothing is broken.

## State

| | |
|---|---|
| Live URL | `https://shahin-invoice-studio.vercel.app` |
| Repo | `github.com/shaaysystems/invoice-studio` (`main`) |
| Deploys | push to `main` → Vercel builds automatically |
| Database | Supabase `tmsytdvwocegypjgggws`, migration `0002` applied |
| Gates | 319 unit + 25 E2E green, 0 npm vulnerabilities |
| Guest + accounts | verified working in production |

## 1. Point Supabase Site URL at the new domain

**Why it matters:** only password-reset links. Sign-in and signup are fine,
because autoconfirm is on and nothing redirects through email.

**How:**

1. Export a token in your terminal — **not** in chat:

   ```bash
   export SUPABASE_TOKEN=...
   ```

2. Apply it:

   ```bash
   curl -X PATCH "https://api.supabase.com/v1/projects/tmsytdvwocegypjgggws/config/auth" \
     -H "Authorization: Bearer $SUPABASE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"site_url":"https://shahin-invoice-studio.vercel.app",
          "uri_allow_list":["https://shahin-invoice-studio.vercel.app",
                            "https://shahin-invoice-studio-*.vercel.app"]}'
   ```

   Current (wrong) value is `https://invoice-studio-topaz.vercel.app`.

> Note: autoconfirm sends confirmation emails from Supabase's default SMTP with
> a `*.supabase.co` `From` address. Works fine, but shows up as spam. Attach a
> real domain when you get one.

## 2. Delete my test accounts

Every run created throwaway accounts. The rows cascade once the users go:

```sql
delete from auth.users where email like '%@invoice-studio-test.invalid';
```

Needs the Supabase SQL editor, or a token with the same scope as above.

## Optional

- Retire the old `invoice-studiov1.vercel.app` alias once you are happy — it is
  still serving, so there is no rush.
- `npm run dev` before UI work; `git push` is the only deploy step needed.