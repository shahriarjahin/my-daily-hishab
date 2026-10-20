-- Optional per-account MFA, enforced even for direct Supabase requests.
-- Users without a verified second factor keep normal email/password access.
begin;
create or replace function public.hishab_assurance_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    (auth.jwt()->>'aal') = 'aal2'
    or not exists(select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
  );
$$;
revoke all on function public.hishab_assurance_ok() from public, anon;
grant execute on function public.hishab_assurance_ok() to authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='hishab_workspaces' and policyname='Hishab optional MFA assurance') then
  create policy "Hishab optional MFA assurance" on public.hishab_workspaces as restrictive for all to authenticated using ((select public.hishab_assurance_ok())) with check ((select public.hishab_assurance_ok()));
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='hishab_ai_configs' and policyname='Hishab optional MFA assurance') then
  create policy "Hishab optional MFA assurance" on public.hishab_ai_configs as restrictive for all to authenticated using ((select public.hishab_assurance_ok())) with check ((select public.hishab_assurance_ok()));
 end if;
end $$;
commit;
