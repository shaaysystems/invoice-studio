-- =====================================================================
-- Invoice Studio — multiple business profiles
--
-- 0001 constrained a user to exactly one profile, which the app read with
-- `maybeSingle()`. That has to go: a user may run several businesses (or a
-- personal and a company one), invoice from any of them, and keep a default
-- for the fast path on /invoices/new.
--
-- "Default" is expressed as a flag rather than a pointer table so that the
-- invariant "at most one default per user" is enforced by a partial unique
-- index instead of application code.
-- =====================================================================

-- ------------------------------------------------------- drop the 1:1 lock
drop index if exists public.business_profiles_one_per_user;

-- ------------------------------------------------------------- new column
alter table public.business_profiles
  add column if not exists is_default boolean not null default false;

-- At most one default per user. The flag is cleared in the same transaction by
-- `setDefaultBusinessProfileAction`, so this index never sees two true rows.
create unique index if not exists business_profiles_one_default_per_user
  on public.business_profiles (user_id)
  where is_default;

-- ------------------------------------------------------- listing order
-- The list page shows the default first, then most recently touched.
create index if not exists business_profiles_user_default_idx
  on public.business_profiles (user_id, is_default desc, updated_at desc);

-- =====================================================================
-- Seed a default for users created under 0001, before anything reads the flag.
-- =====================================================================
insert into public.business_profiles (user_id, is_default)
select p.user_id, true
from (
  select distinct on (user_id) user_id
  from public.business_profiles
  order by user_id, updated_at desc
) as p
where not exists (
  select 1
  from public.business_profiles existing
  where existing.user_id = p.user_id and existing.is_default
);

-- =====================================================================
-- Invoice numbering
--
-- `invoices.business_profile_id` was left NULL by the app until now, so
-- `invoices_number_unique_per_business` never applied to existing rows. New
-- writes are linked (see `saveInvoiceAction`), and historical rows stay NULL
-- rather than being backfilled: guessing which profile an old invoice belongs
-- to could collide two invoices that legitimately share a number.
-- =====================================================================
