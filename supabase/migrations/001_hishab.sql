-- Run once in this Supabase project's SQL Editor. No service-role key is needed by the app.
begin;
create table if not exists public.hishab_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint hishab_workspace_object check (jsonb_typeof(data) = 'object')
);
alter table public.hishab_workspaces enable row level security;
revoke all on public.hishab_workspaces from anon, authenticated;
grant select, insert, update on public.hishab_workspaces to authenticated;
drop policy if exists "Read own Hishab workspace" on public.hishab_workspaces;
create policy "Read own Hishab workspace" on public.hishab_workspaces for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Create own Hishab workspace" on public.hishab_workspaces;
create policy "Create own Hishab workspace" on public.hishab_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own Hishab workspace" on public.hishab_workspaces;
create policy "Update own Hishab workspace" on public.hishab_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.hishab_ai_configs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_config text not null,
  updated_at timestamptz not null default now()
);
alter table public.hishab_ai_configs enable row level security;
revoke all on public.hishab_ai_configs from anon, authenticated;
grant select, insert, update on public.hishab_ai_configs to authenticated;
drop policy if exists "Read own AI config" on public.hishab_ai_configs;
create policy "Read own AI config" on public.hishab_ai_configs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Create own AI config" on public.hishab_ai_configs;
create policy "Create own AI config" on public.hishab_ai_configs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Update own AI config" on public.hishab_ai_configs;
create policy "Update own AI config" on public.hishab_ai_configs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Compare-and-swap: conflicting devices cannot silently overwrite each other's changes.
create or replace function public.save_hishab_workspace(expected_revision bigint, workspace_data jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare new_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(workspace_data) <> 'object' or octet_length(workspace_data::text) > 8000000 then
    raise exception 'Invalid workspace' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.hishab_workspaces(user_id, data, revision)
      values(auth.uid(), workspace_data, 1) on conflict do nothing returning revision into new_revision;
  else
    update public.hishab_workspaces set data = workspace_data, revision = revision + 1, updated_at = now()
      where user_id = auth.uid() and revision = expected_revision returning revision into new_revision;
  end if;
  if new_revision is null then raise exception 'Workspace changed; reload before retrying' using errcode = '40001'; end if;
  return new_revision;
end $$;
revoke all on function public.save_hishab_workspace(bigint, jsonb) from public, anon;
grant execute on function public.save_hishab_workspace(bigint, jsonb) to authenticated;
commit;
