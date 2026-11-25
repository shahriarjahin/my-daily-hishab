-- Migration 004: Recurring Bills & iOS Shortcut API Tokens
begin;

-- 1. Recurring Bills & Scheduled Income
create table if not exists public.recurring_bills (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    name text not null,
    amount numeric(14,2) not null check (amount > 0),
    type text not null default 'expense' check (type in ('income', 'expense')),
    category text not null,
    wallet_id bigint not null,
    frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
    next_due_date text not null,
    note text not null default '',
    active boolean not null default true,
    last_paid_date text,
    primary key (user_id, id),
    foreign key (user_id, wallet_id) references public.wallets(user_id, id) on delete cascade
);
create index if not exists idx_recurring_bills_user_due on public.recurring_bills(user_id, next_due_date);

-- 2. iOS Shortcut / Automation Tokens (stores SHA-256 hash only)
create table if not exists public.shortcut_tokens (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    label text not null,
    token_hash text not null unique,
    token_prefix text not null,
    default_wallet_id bigint,
    created_at timestamptz not null default now(),
    last_used_at timestamptz,
    primary key (user_id, id),
    foreign key (user_id, default_wallet_id) references public.wallets(user_id, id) on delete set null
);
create index if not exists idx_shortcut_tokens_hash on public.shortcut_tokens(token_hash);

-- Enable RLS
alter table public.recurring_bills enable row level security;
alter table public.shortcut_tokens enable row level security;

do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename in ('recurring_bills', 'shortcut_tokens')
  loop
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);
    execute format('create policy "Users manage own %I" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

commit;
