# Design Document: Relational PostgreSQL Migration & Instant Expense Saves

**Date:** 2026-11-12  
**Topic:** Relational Database Migration & Performance Optimization  
**Selected Approach:** Approach 1 — Normalized PostgreSQL with Snapshot Sync Adapter  
**Status:** Approved for Implementation Planning  

---

## 1. Intent & The Why

When a user adds or edits an expense in Hishab, the save operation takes several seconds to complete. The root cause is architectural: Hishab currently persists user financial data not as relational rows, but as a single monolithic JSON document (often Fernet-encrypted) in a single column (`public.hishab_workspaces.data`).

On every single write:
1. The FastAPI backend calls Supabase over HTTPS to authenticate the user.
2. The backend downloads the entire historical JSON blob over HTTPS.
3. The backend decrypts the blob, boots an ephemeral in-memory SQLite database (`sqlite://`), validates all historical records with Pydantic, and inserts every historical row into SQLite.
4. The backend inserts the new transaction into SQLite.
5. The backend queries SQLite, re-validates all records, re-serializes the whole workspace to JSON, re-encrypts it, and uploads the entire blob back to Supabase over HTTPS.
6. The React frontend sequentially re-fetches `/api/cloud/status` and `/api/state`, downloading, re-decrypting, and recalculating the entire history a second time.

This project migrates Hishab's cloud persistence to a **true normalized PostgreSQL database** in Supabase, reducing transaction saves from a multi-second whole-history rewrite to an indexed, single-row `INSERT` taking ~15–30 ms, while preserving complete offline Android capabilities.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Sub-50ms cloud write latency:** Saving an expense, wallet change, or loan repayment executes a direct, single-row SQL statement.
- **Normalized PostgreSQL tables in Supabase:** Dedicated tables for `wallets`, `categories`, `transactions`, `budgets`, `movements`, `goals`, `savings`, `loans`, `regulars`, and `app_settings`, with foreign key constraints, composite primary keys `(user_id, id)` matching client-side sequential IDs, and Row Level Security (`auth.uid() = user_id`).
- **Direct SQLAlchemy/SQLModel connection:** FastAPI connects directly to PostgreSQL via `DATABASE_URL` (supporting Supabase transaction pooler on port 6543) with connection pooling.
- **Preserve Android offline capabilities:** Android continues to store financial data locally in SQLite on-device, mutating instantly with zero network. When online, Android synchronizes via the existing `/api/cloud/workspace` endpoint contract.
- **Zero data loss migration:** A one-off batch migration script (`scripts/migrate_to_relational.py`) decrypts and migrates existing user data from `public.hishab_workspaces` into the new normalized tables.
- **Local/Test fallback:** When `DATABASE_URL` is unset or points to SQLite (`sqlite://`), all models and operations fall back to SQLite so local development and automated unit tests run without an external Postgres server.

### Non-Goals
- Rewriting Android's native Java/Kotlin storage layer (`Store.java`) or JavaScript engine (`ledger.js`) into relational SQLite tables on the phone.
- Multi-user collaborative workspaces (every user remains strictly isolated by `user_id`).

### Anti-Goals
- Breaking offline usability on Android.
- Changing the endpoint contract expected by the compiled Android app (`GET/POST /api/cloud/workspace`).
- Introducing breaking API schema changes that require updating frontend UI screens.

---

## 3. Approaches Considered & Trade-offs

### Approach 1: Normalized PostgreSQL with a Snapshot Sync Adapter *(Selected)*
- **Architecture:** Supabase has normalized relational tables with composite PKs `(user_id, id)`. FastAPI connects directly via SQLAlchemy connection pool. Online web & mobile actions execute direct SQL queries. Android continues local offline snapshot storage and syncs via `/api/cloud/workspace`.
- **Trade-offs:** 
  - *Pros:* Blazing fast sub-50ms writes; direct SQL optimization; zero changes required to Android's native Java storage; completely preserves offline capabilities.
  - *Cons:* Backend maintains a translation adapter to export/import between relational tables and Android's offline JSON snapshot.
- **Decision:** Selected because it directly solves the write latency problem, fulfills the direct SQLAlchemy connection requirement, and leaves Android offline functionality intact without a risky mobile rewrite.

### Approach 2: Full Row-Level Change Tracking Across Cloud and Mobile *(Rejected)*
- **Architecture:** Rewrite Android storage from JSON snapshots into normalized local SQLite tables. Implement a row-level changelog protocol (`updated_at`, `deleted_at`, `client_id`).
- **Trade-offs:**
  - *Pros:* Pure row-level delta sync end-to-end.
  - *Cons:* Out of scope for solving backend save latency; requires major rewrite of `Store.java`, `ledger.js`, and conflict resolution on Android.

### Approach 3: PostgREST HTTP Client *(Rejected)*
- **Architecture:** Keep relational tables in Supabase, but query via Supabase's HTTP REST API instead of a direct Postgres connection.
- **Trade-offs:**
  - *Pros:* No TCP connection pool management on serverless.
  - *Cons:* HTTP REST requests still incur HTTP/TLS overhead; user explicitly requested direct PostgreSQL connection string (SQLAlchemy).

---

## 4. Key Architectural Decisions (Builder Check Resolutions)

### 4.1 Primary Key & ID Reconciling: Composite `(user_id, id)`
- In Hishab, the Android offline engine and existing client exports assign 1-based sequential integers per user (`1, 2, 3...`).
- To prevent cross-user ID collisions in PostgreSQL while avoiding any ID re-mapping that would break client foreign keys (`wallet_id`, `loan_id`, `goal_id`), all user-scoped tables use a composite primary key:
  ```sql
  PRIMARY KEY (user_id, id)
  ```
- All foreign keys between user tables reference `(user_id, parent_id)`:
  ```sql
  FOREIGN KEY (user_id, wallet_id) REFERENCES public.wallets(user_id, id) ON DELETE CASCADE
  ```
- When creating a new record online, `id = (SELECT coalesce(max(id), 0) + 1 FROM table WHERE user_id = :user_id)`.
- Existing JSON workspaces can be imported directly into the relational tables without re-keying.

### 4.2 Workspace Revision & Concurrency Tracking in `app_settings`
- A `revision bigint not null default 1` column is added to `public.app_settings`.
- Every mutating cloud transaction increments this counter:
  ```sql
  UPDATE public.app_settings SET revision = revision + 1 WHERE user_id = :user_id RETURNING revision;
  ```
- Android's `Runtime.java` and Web's optimistic lock `X-Workspace-Revision` remain 100% compatible.

### 4.3 Tenant Scoping
- In FastAPI, direct database connections query with explicit `WHERE user_id = :user_id` filtering on all models.
- Database Row-Level Security (RLS) is enabled with `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` for any client connecting with Supabase user JWTs.
- For SQLite tests, `user_id` columns exist on all models, allowing the complete unit test suite to run in-memory with zero external Postgres requirements.

### 4.4 Android Sync Endpoint Contract
- The endpoint paths match Android's compiled native code (`Runtime.java` lines 105 and 120):
  - `GET /api/cloud/workspace` -> returns `{"revision": N, "data": { ...workspace... }}`
  - `POST /api/cloud/workspace` -> receives `{"expected_revision": N, "data": { ...workspace... }}`, validates revision, applies import atomically, and returns `{"revision": N + 1}`.

### 4.5 Data Migration via One-Off Python Script
- A dedicated script `scripts/migrate_to_relational.py` connects to Supabase, iterates through all rows in `public.hishab_workspaces`, decrypts any `hishab-encrypted-v1` records using `HISHAB_SECRET_KEY`, and bulk inserts all historical records into the new relational tables.
- This avoids complex runtime lazy migration branches and ensures a clean cutover.

---

## 5. Database Schema (`003_relational_schema.sql`)

```sql
begin;

-- 1. App Settings (Includes revision counter)
create table if not exists public.app_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
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
    updated_at timestamptz not null default now()
);

-- 2. Wallets
create table if not exists public.wallets (
    user_id uuid not null references auth.users(id) on delete cascade,
    id bigint not null,
    name text not null,
    opening_balance numeric(14,2) not null default 0,
    created_at timestamptz not null default now(),
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
    foreign key (user_id, from_wallet_id) references public.wallets(user_id, id) on delete set null,
    foreign key (user_id, to_wallet_id) references public.wallets(user_id, id) on delete set null,
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

-- Policies for each table
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
```

---

## 6. Implementation Stages

1. **Stage 1: Dependencies & Database Migration SQL**
   - Add `psycopg[binary]>=3.2.0` to `requirements.txt`.
   - Write `supabase/migrations/003_relational_schema.sql`.
   - Write `scripts/migrate_to_relational.py` to copy existing data from `hishab_workspaces` into the new tables.

2. **Stage 2: Model & Database Engine Update**
   - Update `backend/models.py` with `user_id` fields and composite primary keys.
   - Update `backend/database.py` to connect via `DATABASE_URL` with connection pooling, and yield a scoped session bound to `user_id`.

3. **Stage 3: Fast Online Endpoint Rewrites**
   - Update `POST /api/transactions` and other mutation endpoints in `backend/api.py` and `backend/finance.py` to execute direct single-row inserts/updates.
   - Update `backend/workspace.py` export/import methods to map between relational tables and JSON workspace.
   - Keep `/api/cloud/workspace` endpoint contract intact for Android sync.

4. **Stage 4: Verification & Performance Benchmark**
   - Run backend unit tests against SQLite fallback.
   - Benchmark expense save write latency (<50ms).
   - Run Android ledger compatibility test (`node --test mobile/test_ledger.cjs`).
   - Run Playwright browser test (`npm run test:browser`).
