-- VANTAGE foundation: run in a dedicated Supabase project.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 account_type text not null default 'candidate' check (account_type in ('candidate','employer','referrer')),
 created_at timestamptz not null default now()
);
create table if not exists public.organisations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 name text not null,
 verified boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.vacancies (
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id),
 title text not null,
 sector text not null check (sector in ('Legal','Technology & AI','Finance')),
 location text not null,
 salary text not null default 'Competitive',
 employment_type text not null default 'Permanent',
 remote_policy text not null default 'Hybrid',
 description text not null,
 referral_tokens integer not null default 0 check(referral_tokens between 0 and 1000000),
 status text not null default 'draft' check(status in ('draft','pending_review','live','closed')),
 created_at timestamptz not null default now()
);
create table if not exists public.applications (
 id uuid primary key default gen_random_uuid(),
 vacancy_id uuid not null references public.vacancies(id),
 candidate_id uuid not null references auth.users(id),
 cover_note text,
 status text not null default 'submitted' check(status in ('submitted','in_review','interview','offered','hired','rejected','withdrawn')),
 created_at timestamptz not null default now(),
 unique(vacancy_id,candidate_id)
);
create table if not exists public.referrals (
 id uuid primary key default gen_random_uuid(),
 vacancy_id uuid not null references public.vacancies(id),
 referrer_id uuid not null references auth.users(id),
 candidate_email_hash text not null,
 candidate_name text not null,
 candidate_contact_email text,
 consent_confirmed boolean not null default false,
 status text not null default 'invited' check(status in ('invited','consented','in_review','hired','approved','rejected')),
 created_at timestamptz not null default now(),
 unique(vacancy_id,candidate_email_hash)
);
create table if not exists public.reward_ledger (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references auth.users(id),
 referral_id uuid references public.referrals(id),
 amount integer not null check(amount <> 0),
 event_type text not null check(event_type in ('award','redeem','reverse')),
 reference text not null unique,
 created_at timestamptz not null default now()
);
create table if not exists public.reward_catalogue (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 category text not null,
 tokens integer not null check(tokens > 0),
 is_active boolean not null default false
);
alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.vacancies enable row level security;
alter table public.applications enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_ledger enable row level security;
alter table public.reward_catalogue enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "organisation owner read" on public.organisations for select to authenticated using ((select auth.uid()) = owner_id);
create policy "organisation owner insert" on public.organisations for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "organisation owner update" on public.organisations for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "published jobs public" on public.vacancies for select to anon, authenticated using (status = 'live');
create policy "employer own jobs read" on public.vacancies for select to authenticated using (exists(select 1 from public.organisations o where o.id=organisation_id and o.owner_id=(select auth.uid())));
create policy "employer create draft jobs" on public.vacancies for insert to authenticated with check (status = 'draft' and exists(select 1 from public.organisations o where o.id=organisation_id and o.owner_id=(select auth.uid())));
create policy "employer edit draft jobs" on public.vacancies for update to authenticated using (status = 'draft' and exists(select 1 from public.organisations o where o.id=organisation_id and o.owner_id=(select auth.uid()))) with check (status in ('draft','pending_review') and exists(select 1 from public.organisations o where o.id=organisation_id and o.owner_id=(select auth.uid())));
create policy "candidate applications read" on public.applications for select to authenticated using ((select auth.uid())=candidate_id);
create policy "candidate applications insert" on public.applications for insert to authenticated with check ((select auth.uid())=candidate_id and exists(select 1 from public.vacancies v where v.id=vacancy_id and v.status='live'));
create policy "referrer submissions read" on public.referrals for select to authenticated using ((select auth.uid())=referrer_id);
create policy "referrer submissions insert" on public.referrals for insert to authenticated with check ((select auth.uid())=referrer_id and status='invited' and consent_confirmed=true and exists(select 1 from public.vacancies v where v.id=vacancy_id and v.status='live'));
create policy "member ledger read" on public.reward_ledger for select to authenticated using ((select auth.uid())=member_id);
create policy "active rewards catalogue" on public.reward_catalogue for select to anon,authenticated using (is_active=true);
-- Crucially: no authenticated client can insert ledger entries, approve referrals, or publish vacancies.
-- These privileged operations require separately secured, server-side admin actions.
create index if not exists vacancies_status_sector on public.vacancies(status,sector);
create index if not exists applications_candidate on public.applications(candidate_id);
create index if not exists referrals_referrer on public.referrals(referrer_id);
create index if not exists reward_member on public.reward_ledger(member_id);
