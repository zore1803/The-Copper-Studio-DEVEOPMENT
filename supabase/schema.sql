-- The Copper Studio — Supabase schema
-- Run this ONCE in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Design: every former MongoDB collection becomes a table holding the whole
-- document in a `jsonb` column. `id` is `text` (defaulting to a UUID) so that a
-- one-time migration can preserve existing MongoDB ObjectId references as-is.
--
-- RLS is enabled with no policies. The API connects with the service-role key,
-- which bypasses RLS; the public anon/publishable key therefore cannot read or
-- write these tables directly.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'users', 'orders', 'leads', 'contacts', 'companies', 'crm_leads',
    'deals', 'projects', 'tasks', 'meetings', 'documents', 'invoices',
    'payments', 'coupons'
  ];
begin
  foreach t in array tables loop
    execute format(
      'create table if not exists public.%I (
         id text primary key default gen_random_uuid()::text,
         doc jsonb not null default ''{}''::jsonb,
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now()
       );', t);

    execute format('alter table public.%I enable row level security;', t);

    -- Speeds up the common "filter by a field inside the document" lookups.
    execute format('create index if not exists %I on public.%I using gin (doc);', t || '_doc_gin', t);

    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end
$$;
