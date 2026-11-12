-- Migration 003: Normalized Relational Tables for Hishab
-- Fast single-row transactions, indexed queries, and composite PKs matching client sequential IDs.
begin;

-- 1. App Settings (Includes revision counter for optimistic locking / sync)
create table if not exists public.app_settings (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null default 1,
    revision bigint not null default 1 check (revision > 0),
    name text not null default '',
    theme text not null default 'dark',
    language text not null default 'en',
    currency text not null default 'BDT',
    review_before_saving boolean not null default true,
    tutorial_seen boolean not null default false,
    ai_enabled boolean not null default false,
    bottom_nav text not null default 'wallets',
    monthly_budget numeric(14,2) not null default 0,
    planned_income numeric(14,2) not null default 0,
    savings_target numeric(14,2) not null default 0,
    needs_percent int not null default 50,
    wants_percent int not null default 30,
    savings_percent int not null default 20,
    updated_at timestamptz not null default now(),
    primary key (user_id, id)
);

-- 2. Wallets
create table if not exists public.wallets (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    name text not null,
    opening_balance numeric(14,2) not null default 0,
    created_at timestamptz default now(),
    primary key (user_id, id),
    constraint uq_wallet_user_name unique (user_id, name)
);

-- 3. Categories
create table if not exists public.categories (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    name text not null,
    kind text not null default 'expense',
    bucket text not null default 'needs',
    color text not null default '#93b4a0',
    icon text not null default 'other',
    archived boolean not null default false,
    primary key (user_id, id),
    constraint uq_category_user_name unique (user_id, name)
);

-- 4. Transactions
create table if not exists public.transactions (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    wallet_id bigint not null,
    description text not null,
    amount numeric(14,2) not null check (amount > 0),
    category text not null,
    type text not null check (type in ('income', 'expense')),
    date timestamptz not null default now(),
    quantity numeric(10,2),
    unit text not null default '',
    legacy_key text,
    primary key (user_id, id),
    foreign key (user_id, wallet_id) references public.wallets(user_id, id) on delete cascade
);
create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);
create index if not exists idx_transactions_user_wallet on public.transactions(user_id, wallet_id);

-- 5. Budgets
create table if not exists public.budgets (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    category text not null,
    amount numeric(14,2) not null check (amount >= 0),
    primary key (user_id, id),
    constraint uq_budget_user_category unique (user_id, category)
);

-- 6. Loans
create table if not exists public.loans (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    party text not null,
    direction text not null check (direction in ('borrowed', 'lent')),
    amount numeric(14,2) not null check (amount > 0),
    repaid numeric(14,2) not null default 0 check (repaid >= 0),
    due_date text,
    note text not null default '',
    date timestamptz not null default now(),
    primary key (user_id, id)
);

-- 7. Money Movements (Transfers & Repayments)
create table if not exists public.movements (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    description text not null,
    amount numeric(14,2) not null check (amount > 0),
    from_wallet_id bigint,
    to_wallet_id bigint,
    kind text not null check (kind in ('transfer', 'loan', 'repayment')),
    loan_id bigint,
    date timestamptz not null default now(),
    primary key (user_id, id),
    foreign key (user_id, from_wallet_id) references public.wallets(user_id, id) on delete cascade,
    foreign key (user_id, to_wallet_id) references public.wallets(user_id, id) on delete cascade,
    foreign key (user_id, loan_id) references public.loans(user_id, id) on delete cascade
);

-- 8. Goals
create table if not exists public.goals (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    name text not null,
    target numeric(14,2) not null check (target > 0),
    due_date text,
    color text not null default '#93ddba',
    primary key (user_id, id)
);

-- 9. Savings (Reservations)
create table if not exists public.savings (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    wallet_id bigint not null,
    goal_id bigint,
    category text not null,
    amount numeric(14,2) not null check (amount > 0),
    note text not null default '',
    date timestamptz not null default now(),
    primary key (user_id, id),
    foreign key (user_id, wallet_id) references public.wallets(user_id, id) on delete cascade,
    foreign key (user_id, goal_id) references public.goals(user_id, id) on delete set null
);

-- 10. Regular Trackers
create table if not exists public.regulars (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    name text not null,
    category text not null,
    daily_limit numeric(14,2) not null default 0,
    unit text not null default 'pcs',
    primary key (user_id, id),
    constraint uq_regular_user_category unique (user_id, category)
);

-- 11. Advisor Messages
create table if not exists public.advisor_messages (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    provider text not null default '',
    date timestamptz not null default now(),
    primary key (user_id, id)
);

-- Enable RLS on all tables
alter table public.app_settings enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.loans enable row level security;
alter table public.movements enable row level security;
alter table public.goals enable row level security;
alter table public.savings enable row level security;
alter table public.regulars enable row level security;
alter table public.advisor_messages enable row level security;

-- RLS Policies: Authenticated users manage only their own rows
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename in
    ('app_settings','wallets','categories','transactions','budgets','loans','movements','goals','savings','regulars','advisor_messages')
  loop
    execute format('drop policy if exists "Users manage own %I" on public.%I', t, t);
    execute format('create policy "Users manage own %I" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

commit;
