-- Bootstrap ONCE in a NEW dedicated Supabase project (Postgres 15+).
-- This does not upgrade the former browser demo schema. Expose public, never private.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  -- Interface preference only: this is NEVER an authorization role.
  account_type text not null default 'candidate' check (account_type in ('candidate','employer','referrer')),
  company_name text not null default '' check (char_length(company_name) <= 160),
  headline text not null default '' check (char_length(headline) <= 240),
  location text not null default '' check (char_length(location) <= 160),
  website text not null default '' check (website = '' or (char_length(website) <= 2048 and website ~ '^https?://')),
  bio text not null default '' check (char_length(bio) <= 5000),
  created_at timestamptz not null default now()
);
create table private.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table private.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null, entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null default auth.uid() references public.profiles(id),
  title text not null check (char_length(trim(title)) between 3 and 180),
  company text not null check (char_length(trim(company)) between 2 and 160),
  sector text not null check (sector in ('Legal','Technology & AI','Finance')),
  location text not null check (char_length(trim(location)) between 2 and 160),
  salary text not null default 'Competitive' check (char_length(trim(salary)) between 1 and 160),
  type text not null default 'Permanent' check (type in ('Permanent','Contract','Part-time','Internship','Executive')),
  remote text not null default 'Hybrid' check (remote in ('Hybrid','Remote','On-site')),
  description text not null check (char_length(trim(description)) between 20 and 20000),
  referral_tokens integer not null default 0 check (referral_tokens between 0 and 1000000),
  status text not null default 'draft' check (status in ('draft','pending_review','live','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.saved_jobs (
  member_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(member_id,job_id)
);
-- No third-party contact data: only a candidate can claim a shared referral link.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  referrer_id uuid not null references public.profiles(id),
  candidate_id uuid references public.profiles(id),
  candidate_name text check (char_length(candidate_name) <= 120),
  status text not null default 'shared' check (status in ('shared','applied','in_review','hired','approved','rejected')),
  created_at timestamptz not null default now(),
  check (candidate_id is null or candidate_id <> referrer_id),
  check ((candidate_id is null and status = 'shared' and candidate_name is null)
    or (candidate_id is not null and status <> 'shared'))
);
create unique index referrals_one_candidate_per_job on public.referrals(job_id,candidate_id) where candidate_id is not null;
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id),
  candidate_id uuid not null references public.profiles(id),
  name text not null check (char_length(trim(name)) between 1 and 120),
  email text not null check (char_length(email) between 3 and 320),
  cover_note text not null default '' check (char_length(cover_note) <= 10000),
  resume_url text check (resume_url is null or (char_length(resume_url) <= 2048 and resume_url ~ '^https://')),
  status text not null default 'submitted' check (status in ('submitted','in_review','interview','offered','hired','rejected','withdrawn')),
  referral_id uuid unique references public.referrals(id),
  created_at timestamptz not null default now(), unique(job_id,candidate_id)
);
create table public.reward_catalogue (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 180),
  category text not null check (char_length(trim(category)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 5000),
  tokens integer not null check (tokens between 1 and 1000000),
  is_active boolean not null default false, created_at timestamptz not null default now()
);
create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  reward_id uuid not null references public.reward_catalogue(id),
  -- Immutable price snapshot: later catalogue edits cannot change this debit.
  tokens integer not null check (tokens > 0),
  status text not null default 'requested' check (status in ('requested','fulfilled','rejected')),
  created_at timestamptz not null default now()
);
create unique index redemptions_one_pending_reward on public.redemptions(member_id,reward_id) where status = 'requested';
create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  referral_id uuid references public.referrals(id), redemption_id uuid references public.redemptions(id),
  amount integer not null check (amount <> 0),
  event_type text not null check (event_type in ('award','redeem','refund','adjustment')),
  reference text not null unique, created_at timestamptz not null default now(),
  check ((event_type = 'award' and amount > 0 and referral_id is not null and redemption_id is null)
    or (event_type = 'redeem' and amount < 0 and redemption_id is not null and referral_id is null)
    or (event_type = 'refund' and amount > 0 and redemption_id is not null and referral_id is null)
    or event_type = 'adjustment')
);
create unique index ledger_one_referral_award on public.reward_ledger(referral_id) where event_type = 'award';
create unique index ledger_one_redemption_debit on public.reward_ledger(redemption_id) where event_type = 'redeem';
create unique index ledger_one_redemption_refund on public.reward_ledger(redemption_id) where event_type = 'refund';
create index jobs_status_created on public.jobs(status,created_at desc);
create index jobs_employer on public.jobs(employer_id);
create index jobs_sector on public.jobs(sector) where status = 'live';
create index saved_jobs_job on public.saved_jobs(job_id);
create index applications_candidate on public.applications(candidate_id,created_at desc);
create index applications_job on public.applications(job_id,created_at desc);
create index referrals_referrer on public.referrals(referrer_id,created_at desc);
create index referrals_candidate on public.referrals(candidate_id) where candidate_id is not null;
create index referrals_job on public.referrals(job_id);
create index referrals_admin_queue on public.referrals(created_at desc) where status = 'hired';
create index redemptions_member on public.redemptions(member_id,created_at desc);
create index redemptions_reward on public.redemptions(reward_id);
create index redemptions_admin_queue on public.redemptions(created_at desc) where status = 'requested';
create index reward_ledger_member on public.reward_ledger(member_id,created_at desc);
create index audit_actor on private.audit_log(actor_id,created_at desc);

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_catalogue enable row level security;
alter table public.redemptions enable row level security;
alter table public.reward_ledger enable row level security;
alter table private.admin_members enable row level security;
alter table private.audit_log enable row level security;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all sequences in schema private from public,anon,authenticated;

create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from private.admin_members where user_id = auth.uid());
$$;
create function private.can_read_job(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (exists(select 1 from public.applications where job_id = p_id and candidate_id = auth.uid())
    or exists(select 1 from public.referrals where job_id = p_id and referrer_id = auth.uid()));
$$;
create function private.can_read_reward(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.redemptions where reward_id = p_id and member_id = auth.uid());
$$;
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_schema <> 'auth' or tg_table_name <> 'users' or tg_op <> 'INSERT' then raise exception 'Internal auth trigger only'; end if;
  insert into public.profiles(id,display_name,account_type) values(new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name',''),120),
    case when new.raw_user_meta_data ->> 'account_type' in ('candidate','employer','referrer')
      then new.raw_user_meta_data ->> 'account_type' else 'candidate' end);
  return new;
end;
$$;
create trigger vantage_auth_profile after insert on auth.users for each row execute function private.handle_new_user();
insert into public.profiles(id,display_name) select id,left(coalesce(raw_user_meta_data ->> 'display_name',''),120)
from auth.users on conflict(id) do nothing;
create function private.touch_job() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger jobs_updated before update on public.jobs for each row execute function private.touch_job();

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy jobs_read_public on public.jobs for select to anon,authenticated using (status = 'live');
create policy jobs_read_member on public.jobs for select to authenticated
using (employer_id = (select auth.uid()) or (select private.is_admin()) or private.can_read_job(id));
create policy jobs_insert_owner on public.jobs for insert to authenticated with check (employer_id = (select auth.uid()) and status = 'draft');
create policy jobs_update_owner on public.jobs for update to authenticated
using (employer_id = (select auth.uid()) and status = 'draft') with check (employer_id = (select auth.uid()) and status = 'draft');
create policy saved_read on public.saved_jobs for select to authenticated using (member_id = (select auth.uid()));
create policy saved_insert on public.saved_jobs for insert to authenticated
with check (member_id = (select auth.uid()) and exists(select 1 from public.jobs j where j.id = job_id and j.status = 'live'));
create policy saved_delete on public.saved_jobs for delete to authenticated using (member_id = (select auth.uid()));
create policy applications_read on public.applications for select to authenticated using (candidate_id = (select auth.uid())
  or (select private.is_admin()) or exists(select 1 from public.jobs j where j.id = job_id and j.employer_id = (select auth.uid())));
create policy referrals_read on public.referrals for select to authenticated
using (referrer_id = (select auth.uid()) or candidate_id = (select auth.uid()) or (select private.is_admin()));
create policy rewards_read on public.reward_catalogue for select to anon,authenticated using (is_active);
create policy rewards_member_read on public.reward_catalogue for select to authenticated using ((select private.is_admin()) or private.can_read_reward(id));
create policy redemptions_read on public.redemptions for select to authenticated using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy ledger_read on public.reward_ledger for select to authenticated using (member_id = (select auth.uid()) or (select private.is_admin()));

-- Explicit grants also support new Supabase projects without default API exposure.
revoke all on public.profiles,public.jobs,public.saved_jobs,public.applications,public.referrals,
  public.reward_catalogue,public.redemptions,public.reward_ledger from public,anon,authenticated;
grant usage on schema public to anon,authenticated;
grant select on public.jobs,public.reward_catalogue to anon,authenticated;
grant select on public.profiles,public.saved_jobs,public.applications,public.referrals,public.redemptions,public.reward_ledger to authenticated;
grant update(display_name,account_type,company_name,headline,location,website,bio) on public.profiles to authenticated;
grant insert(employer_id,title,company,sector,location,salary,type,remote,description,referral_tokens,status) on public.jobs to authenticated;
grant update(title,company,sector,location,salary,type,remote,description,referral_tokens) on public.jobs to authenticated;
grant insert(member_id,job_id),delete on public.saved_jobs to authenticated;

create function private.create_referral(p_job_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_job public.jobs; v_result public.referrals;
begin
  if v_uid is null then raise exception 'Sign in to share a referral' using errcode = '42501'; end if;
  select * into v_job from public.jobs where id = p_job_id and status = 'live' for share;
  if not found then raise exception 'This job is no longer available'; end if;
  if v_job.employer_id = v_uid then raise exception 'You cannot refer candidates to your own job'; end if;
  insert into public.referrals(job_id,referrer_id) values(p_job_id,v_uid) returning * into v_result;
  return to_jsonb(v_result);
end;
$$;
create function private.submit_application(p_job_id uuid,p_name text,p_cover_note text,p_resume_url text,p_referral_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_email text; v_job public.jobs; v_ref public.referrals; v_result public.applications;
begin
  if v_uid is null then raise exception 'Sign in to apply' using errcode = '42501'; end if;
  select email into v_email from auth.users where id = v_uid and deleted_at is null and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirm your email address before applying'; end if;
  select * into v_result from public.applications where job_id = p_job_id and candidate_id = v_uid;
  if found then return to_jsonb(v_result); end if;
  select * into v_job from public.jobs where id = p_job_id and status = 'live' for share;
  if not found then raise exception 'This job is no longer available'; end if;
  if v_job.employer_id = v_uid then raise exception 'You cannot apply to your own job'; end if;
  if p_referral_id is not null then
    select * into v_ref from public.referrals where id = p_referral_id for update;
    if not found or v_ref.job_id <> p_job_id or v_ref.status <> 'shared' or v_ref.candidate_id is not null
      or v_ref.referrer_id = v_uid or v_ref.referrer_id = v_job.employer_id then
      raise exception 'This referral link is invalid or has already been used';
    end if;
    update public.referrals set candidate_id = v_uid,candidate_name = trim(p_name),status = 'applied' where id = p_referral_id;
  end if;
  insert into public.applications(job_id,candidate_id,name,email,cover_note,resume_url,referral_id)
  values(p_job_id,v_uid,trim(p_name),v_email,coalesce(p_cover_note,''),nullif(trim(p_resume_url),''),p_referral_id) returning * into v_result;
  insert into private.audit_log(actor_id,action,entity_id,detail)
  values(v_uid,'application.submitted',v_result.id,jsonb_build_object('job_id',p_job_id,'referral_consent',p_referral_id is not null));
  return to_jsonb(v_result);
exception when unique_violation then
  select * into v_result from public.applications where job_id = p_job_id and candidate_id = v_uid;
  if found then return to_jsonb(v_result); end if;
  raise;
end;
$$;
create function private.update_application_status(p_application_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_app public.applications; v_owner uuid;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_app from public.applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  select employer_id into v_owner from public.jobs where id = v_app.job_id;
  if v_app.candidate_id = v_uid then
    if p_status <> 'withdrawn' or v_app.status in ('hired','rejected') then raise exception 'Only an open application can be withdrawn'; end if;
  elsif v_owner = v_uid then
    if p_status not in ('in_review','interview','offered','hired','rejected') or v_app.status in ('withdrawn','hired','rejected') then
      raise exception 'This application cannot be changed to that status'; end if;
  else raise exception 'You cannot change this application' using errcode = '42501'; end if;
  update public.applications set status = p_status where id = p_application_id returning * into v_app;
  if v_app.referral_id is not null then
    update public.referrals set status = case when p_status = 'hired' then 'hired'
      when p_status in ('withdrawn','rejected') then 'rejected' else 'in_review' end
    where id = v_app.referral_id and status not in ('approved','rejected');
  end if;
  insert into private.audit_log(actor_id,action,entity_id,detail) values(v_uid,'application.status',v_app.id,jsonb_build_object('status',p_status));
  return to_jsonb(v_app);
end;
$$;
create function private.submit_job(p_job_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_job public.jobs;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_job from public.jobs where id = p_job_id and employer_id = v_uid for update;
  if not found then raise exception 'Job not found' using errcode = '42501'; end if;
  if v_job.status = 'pending_review' then return to_jsonb(v_job); end if;
  if v_job.status <> 'draft' then raise exception 'Only a draft job can be submitted'; end if;
  update public.jobs set status = 'pending_review' where id = p_job_id returning * into v_job;
  insert into private.audit_log(actor_id,action,entity_id) values(v_uid,'job.submitted',p_job_id);
  return to_jsonb(v_job);
end;
$$;
create function private.close_job(p_job_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_job public.jobs;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_job from public.jobs where id = p_job_id and employer_id = v_uid for update;
  if not found then raise exception 'Job not found' using errcode = '42501'; end if;
  if v_job.status = 'closed' then return to_jsonb(v_job); end if;
  update public.jobs set status = 'closed' where id = p_job_id returning * into v_job;
  insert into private.audit_log(actor_id,action,entity_id) values(v_uid,'job.closed',p_job_id);
  return to_jsonb(v_job);
end;
$$;
create function private.request_redemption(p_reward_id uuid,p_request_id uuid default gen_random_uuid()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_reward public.reward_catalogue; v_result public.redemptions; v_balance bigint;
begin
  if v_uid is null then raise exception 'Sign in to redeem rewards' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'A request identifier is required'; end if;
  -- All awards, debits and refunds lock this same member row to prevent overspending.
  perform 1 from public.profiles where id = v_uid for update;
  if not found then raise exception 'Member profile not found'; end if;
  select * into v_result from public.redemptions where id = p_request_id;
  if found then
    if v_result.member_id <> v_uid or v_result.reward_id <> p_reward_id then raise exception 'Request identifier already used'; end if;
    return to_jsonb(v_result);
  end if;
  select * into v_result from public.redemptions where member_id = v_uid and reward_id = p_reward_id and status = 'requested';
  if found then return to_jsonb(v_result); end if;
  select * into v_reward from public.reward_catalogue where id = p_reward_id and is_active for share;
  if not found then raise exception 'This reward is not currently available'; end if;
  select coalesce(sum(amount),0) into v_balance from public.reward_ledger where member_id = v_uid;
  if v_balance < v_reward.tokens then raise exception 'You do not have enough tokens for this reward'; end if;
  insert into public.redemptions(id,member_id,reward_id,tokens)
  values(p_request_id,v_uid,p_reward_id,v_reward.tokens) returning * into v_result;
  insert into public.reward_ledger(member_id,redemption_id,amount,event_type,reference)
  values(v_uid,v_result.id,-v_result.tokens,'redeem','redemption:' || v_result.id::text);
  insert into private.audit_log(actor_id,action,entity_id) values(v_uid,'redemption.requested',v_result.id);
  return to_jsonb(v_result);
end;
$$;
create function private.admin_action(p_kind text,p_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_job public.jobs; v_ref public.referrals; v_red public.redemptions; v_tokens integer;
begin
  if v_uid is null or not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_kind = 'job' and p_action in ('approve','reject') then
    select * into v_job from public.jobs where id = p_id for update;
    if not found then raise exception 'Job not found'; end if;
    if p_action = 'approve' and v_job.status = 'live' then return to_jsonb(v_job); end if;
    if p_action = 'reject' and v_job.status = 'draft' then return to_jsonb(v_job); end if;
    if v_job.status <> 'pending_review' then raise exception 'Only a submitted job can be reviewed'; end if;
    update public.jobs set status = case when p_action = 'approve' then 'live' else 'draft' end where id = p_id returning * into v_job;
    insert into private.audit_log(actor_id,action,entity_id) values(v_uid,'job.' || p_action,p_id);
    return to_jsonb(v_job);
  elsif p_kind = 'referral' and p_action in ('approve','reject') then
    select * into v_ref from public.referrals where id = p_id for update;
    if not found then raise exception 'Referral not found'; end if;
    if v_ref.referrer_id = v_uid or v_ref.candidate_id = v_uid then raise exception 'Another administrator must review this referral'; end if;
    select * into v_job from public.jobs where id = v_ref.job_id;
    if v_job.employer_id = v_uid then raise exception 'Another administrator must verify this hire'; end if;
    if p_action = 'approve' and v_ref.status = 'approved' then return to_jsonb(v_ref); end if;
    if p_action = 'reject' and v_ref.status = 'rejected' then return to_jsonb(v_ref); end if;
    if v_ref.status = 'approved' or v_ref.candidate_id is null then raise exception 'This referral cannot be reviewed'; end if;
    if p_action = 'approve' then
      if v_ref.status <> 'hired' or not exists(select 1 from public.applications where referral_id = p_id
        and candidate_id = v_ref.candidate_id and job_id = v_ref.job_id and status = 'hired') then
        raise exception 'Confirm a completed hire before approving tokens';
      end if;
      perform 1 from public.profiles where id = v_ref.referrer_id for update;
      v_tokens := v_job.referral_tokens;
      if v_tokens > 0 then
        insert into public.reward_ledger(member_id,referral_id,amount,event_type,reference)
        values(v_ref.referrer_id,p_id,v_tokens,'award','referral:' || p_id::text) on conflict(reference) do nothing;
      end if;
    end if;
    update public.referrals set status = case when p_action = 'approve' then 'approved' else 'rejected' end where id = p_id returning * into v_ref;
    insert into private.audit_log(actor_id,action,entity_id,detail)
    values(v_uid,'referral.' || p_action,p_id,jsonb_build_object('tokens',coalesce(v_tokens,0)));
    return to_jsonb(v_ref);
  elsif p_kind = 'redemption' and p_action in ('fulfil','reject') then
    select * into v_red from public.redemptions where id = p_id for update;
    if not found then raise exception 'Redemption not found'; end if;
    if p_action = 'fulfil' and v_red.status = 'fulfilled' then return to_jsonb(v_red); end if;
    if p_action = 'reject' and v_red.status = 'rejected' then return to_jsonb(v_red); end if;
    if v_red.status <> 'requested' then raise exception 'This redemption is already resolved'; end if;
    if p_action = 'reject' then
      perform 1 from public.profiles where id = v_red.member_id for update;
      insert into public.reward_ledger(member_id,redemption_id,amount,event_type,reference)
      values(v_red.member_id,p_id,v_red.tokens,'refund','redemption-refund:' || p_id::text) on conflict(reference) do nothing;
    end if;
    update public.redemptions set status = case when p_action = 'fulfil' then 'fulfilled' else 'rejected' end where id = p_id returning * into v_red;
    insert into private.audit_log(actor_id,action,entity_id) values(v_uid,'redemption.' || p_action,p_id);
    return to_jsonb(v_red);
  end if;
  raise exception 'Unknown administration action';
end;
$$;
create function private.admin_dashboard() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'jobs',coalesce((select jsonb_agg(to_jsonb(j) order by j.created_at desc) from public.jobs j where status = 'pending_review'),'[]'::jsonb),
    'referrals',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('job_title',j.title,'company',j.company,
      'referral_tokens',j.referral_tokens,'referrer_name',p.display_name) order by r.created_at desc)
      from public.referrals r join public.jobs j on j.id = r.job_id join public.profiles p on p.id = r.referrer_id where r.status = 'hired'),'[]'::jsonb),
    'redemptions',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('reward_title',c.title,'member_name',p.display_name,
      'member_email',u.email) order by r.created_at desc) from public.redemptions r join public.reward_catalogue c on c.id = r.reward_id
      join public.profiles p on p.id = r.member_id join auth.users u on u.id = r.member_id where r.status = 'requested'),'[]'::jsonb),
    'rewards',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.reward_catalogue c),'[]'::jsonb));
end;
$$;
create function private.admin_upsert_reward(p_id uuid default null,p_title text default '',p_category text default '',
  p_description text default '',p_tokens integer default 0,p_is_active boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result public.reward_catalogue;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if p_id is null then
    insert into public.reward_catalogue(title,category,description,tokens,is_active)
    values(trim(p_title),trim(p_category),coalesce(p_description,''),p_tokens,p_is_active) returning * into v_result;
  else
    update public.reward_catalogue set title = trim(p_title),category = trim(p_category),description = coalesce(p_description,''),
      tokens = p_tokens,is_active = p_is_active where id = p_id returning * into v_result;
    if not found then raise exception 'Reward not found'; end if;
  end if;
  insert into private.audit_log(actor_id,action,entity_id,detail)
  values(auth.uid(),'reward.saved',v_result.id,jsonb_build_object('tokens',v_result.tokens,'is_active',v_result.is_active));
  return to_jsonb(v_result);
end;
$$;

-- Invoker API wrappers; elevation stays in the non-exposed private schema.
create function public.is_admin() returns boolean language sql stable security invoker set search_path = '' as $$ select private.is_admin(); $$;
create function public.create_referral(p_job_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.create_referral(p_job_id); $$;
create function public.submit_application(p_job_id uuid,p_name text,p_cover_note text,p_resume_url text,p_referral_id uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$ select private.submit_application(p_job_id,p_name,p_cover_note,p_resume_url,p_referral_id); $$;
create function public.update_application_status(p_application_id uuid,p_status text) returns jsonb language sql security invoker set search_path = ''
as $$ select private.update_application_status(p_application_id,p_status); $$;
create function public.submit_job(p_job_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.submit_job(p_job_id); $$;
create function public.close_job(p_job_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select private.close_job(p_job_id); $$;
create function public.request_redemption(p_reward_id uuid,p_request_id uuid default gen_random_uuid()) returns jsonb language sql security invoker set search_path = ''
as $$ select private.request_redemption(p_reward_id,p_request_id); $$;
create function public.admin_action(p_kind text,p_id uuid,p_action text) returns jsonb language sql security invoker set search_path = '' as $$ select private.admin_action(p_kind,p_id,p_action); $$;
create function public.admin_dashboard() returns jsonb language sql stable security invoker set search_path = '' as $$ select private.admin_dashboard(); $$;
create function public.admin_upsert_reward(p_id uuid default null,p_title text default '',p_category text default '',
  p_description text default '',p_tokens integer default 0,p_is_active boolean default false) returns jsonb language sql security invoker set search_path = ''
as $$ select private.admin_upsert_reward(p_id,p_title,p_category,p_description,p_tokens,p_is_active); $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.is_admin(),public.create_referral(uuid),public.submit_application(uuid,text,text,text,uuid),
  public.update_application_status(uuid,text),public.submit_job(uuid),public.close_job(uuid),public.request_redemption(uuid,uuid),
  public.admin_action(text,uuid,text),public.admin_dashboard(),public.admin_upsert_reward(uuid,text,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function private.is_admin(),private.can_read_job(uuid),private.can_read_reward(uuid),private.create_referral(uuid),
  private.submit_application(uuid,text,text,text,uuid),private.update_application_status(uuid,text),private.submit_job(uuid),private.close_job(uuid),
  private.request_redemption(uuid,uuid),private.admin_action(text,uuid,text),private.admin_dashboard(),private.admin_upsert_reward(uuid,text,text,text,integer,boolean) to authenticated;
grant execute on function public.is_admin(),public.create_referral(uuid),public.submit_application(uuid,text,text,text,uuid),
  public.update_application_status(uuid,text),public.submit_job(uuid),public.close_job(uuid),public.request_redemption(uuid,uuid),
  public.admin_action(text,uuid,text),public.admin_dashboard(),public.admin_upsert_reward(uuid,text,text,text,integer,boolean) to authenticated;

-- Bootstrap a verified owner ONLY through trusted SQL:
-- INSERT INTO private.admin_members(user_id) VALUES ('verified-auth-user-uuid');
-- No client endpoint can add administrators, mint tokens, or edit ledger entries.
-- The reward catalogue stays empty until genuine fulfilable offers are configured.
notify pgrst,'reload schema';
commit;
