-- =====================================================================
-- Invoice Studio — initial schema
--
-- Invoices are stored as a versioned jsonb `payload` (the whole nested
-- document) plus a small set of denormalized scalar columns used for
-- listing, searching, uniqueness and RLS. This keeps historical invoices
-- byte-identical when a business profile is later edited, and means schema
-- evolution only needs a new `schema_version` reader.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- utils
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;

$$;

-- --------------------------------------------------- business_profiles
create table if not exists public.business_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  display_name   text not null default 'My business',
  -- The complete BusinessProfile document: nested party, payment, signature,
  -- default terms/notes, default tax rate and numbering. The brand kit lives in
  -- its own table (see below).
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists business_profiles_user_idx
  on public.business_profiles (user_id, updated_at desc);

-- Exactly one profile per user. Without this, `maybeSingle()` in the profile
-- fetch can match two rows and the app has no defined "current profile".
create unique index if not exists business_profiles_one_per_user
  on public.business_profiles (user_id);

-- -------------------------------------------------------- brand_profiles
-- The brand kit lives in its own table so the dashboard can offer a dedicated
-- brand editor. Invoices never read from here — each invoice snapshots the
-- brand it was issued with, so later brand edits never rewrite history.
create table if not exists public.brand_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid references public.business_profiles (id) on delete cascade,
  schema_version      integer not null default 1 check (schema_version > 0),
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists brand_profiles_user_idx
  on public.brand_profiles (user_id);

-- One brand kit per business profile.
create unique index if not exists brand_profiles_one_per_business
  on public.brand_profiles (business_profile_id)
  where business_profile_id is not null;

-- ------------------------------------------------------------ invoices
create table if not exists public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  business_profile_id uuid references public.business_profiles (id) on delete set null,

  invoice_number      text not null,
  issue_date          date not null,
  due_date            date,
  currency            text not null default 'INR' check (currency = 'INR'),
  status              text not null default 'draft'
                        check (status in ('draft', 'sent', 'paid')),
  tax_mode            text not null default 'none'
                        check (tax_mode in ('none', 'gst')),
  schema_version      integer not null default 1 check (schema_version > 0),

  -- Cached, minor-unit (paise) figures for list views and search.
  subtotal_minor      bigint not null default 0,
  discount_minor      bigint not null default 0,
  total_tax_minor     bigint not null default 0,
  shipping_minor      bigint not null default 0,
  grand_total_minor   bigint not null default 0,

  -- The complete Invoice document: parties, items, adjustments, payment,
  -- signature and the brand snapshot exactly as they were when issued.
  payload             jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists invoices_user_updated_idx
  on public.invoices (user_id, updated_at desc);
create index if not exists invoices_status_idx
  on public.invoices (user_id, status);

-- Invoice numbers are unique per business profile, never globally.
create unique index if not exists invoices_number_unique_per_business
  on public.invoices (business_profile_id, lower(invoice_number))
  where business_profile_id is not null;

-- ---------------------------------------------------------- timestamps
drop trigger if exists touch_business_profiles on public.business_profiles;
create trigger touch_business_profiles before update on public.business_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_brand_profiles on public.brand_profiles;
create trigger touch_brand_profiles before update on public.brand_profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_invoices on public.invoices;
create trigger touch_invoices before update on public.invoices
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security — users can only ever reach their own rows.
-- =====================================================================
alter table public.business_profiles enable row level security;
alter table public.brand_profiles     enable row level security;
alter table public.invoices           enable row level security;

create policy "own business profiles" on public.business_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own brand profiles" on public.brand_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- Storage: private bucket, one folder per user.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice-assets', 'invoice-assets', false, 2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- `create policy` has no IF NOT EXISTS, so drop first to keep re-runs green.
drop policy if exists "read own assets"   on storage.objects;
drop policy if exists "upload own assets" on storage.objects;
drop policy if exists "update own assets" on storage.objects;
drop policy if exists "delete own assets" on storage.objects;

create policy "read own assets" on storage.objects for select
  using (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "upload own assets" on storage.objects for insert
  with check (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "update own assets" on storage.objects for update
  using (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own assets" on storage.objects for delete
  using (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = auth.uid()::text);
