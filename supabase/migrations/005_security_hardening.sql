-- Migration 005: Restrictive MFA (aal2) RLS on relational tables, anon revoke, and shortcut token expiry/scope
begin;

-- 1. Add expiration and transfer-scope columns to shortcut_tokens
alter table public.shortcut_tokens
  add column if not exists expires_at timestamptz,
  add column if not exists allow_transfers boolean not null default true;

-- 2. Apply restrictive hishab_assurance_ok() MFA policy and revoke anon grants on all 003/004 relational tables
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename in (
    'app_settings', 'wallets', 'categories', 'transactions', 'budgets',
    'loans', 'movements', 'goals', 'savings', 'regulars',
    'advisor_messages', 'recurring_bills', 'shortcut_tokens'
  )
  loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('drop policy if exists "Require MFA assurance on %I" on public.%I', t, t);
    execute format('create policy "Require MFA assurance on %I" on public.%I as restrictive for all to authenticated using (public.hishab_assurance_ok()) with check (public.hishab_assurance_ok())', t, t);
  end loop;
end $$;

commit;
