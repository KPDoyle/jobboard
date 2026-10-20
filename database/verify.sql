-- Run as postgres after schema.sql. Everything, including synthetic auth users,
-- is rolled back. This checks actual role grants/RLS and the complete money flow.
-- Any failed assertion aborts the transaction; no test data is committed.
begin;

insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data,created_at,updated_at)
values
('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vantage-employer-test@example.invalid',now(),'{"display_name":"Test Employer","account_type":"employer","is_admin":true}',now(),now()),
('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vantage-candidate-test@example.invalid',now(),'{"display_name":"Test Candidate"}',now(),now()),
('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vantage-referrer-test@example.invalid',now(),'{"display_name":"Test Referrer","account_type":"referrer"}',now(),now()),
('10000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vantage-admin-test@example.invalid',now(),'{"display_name":"Test Admin"}',now(),now());
insert into private.admin_members(user_id) values('10000000-0000-4000-8000-000000000004');

-- Static privilege assertions protect against accidental broad GRANTs.
do $$
begin
  if exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ('profiles','jobs','applications','saved_jobs','referrals','redemptions','reward_ledger','reward_catalogue') and not c.relrowsecurity)
    then raise exception 'All API tables must enable RLS'; end if;
  if has_table_privilege('authenticated','private.admin_members','INSERT')
    or has_table_privilege('authenticated','private.admin_members','SELECT')
    or has_table_privilege('authenticated','private.audit_log','SELECT')
    or has_table_privilege('authenticated','public.reward_ledger','INSERT')
    or has_table_privilege('authenticated','public.reward_ledger','UPDATE')
    or has_table_privilege('authenticated','public.applications','INSERT')
    or has_table_privilege('authenticated','public.redemptions','INSERT')
    or has_column_privilege('authenticated','public.jobs','status','UPDATE')
    or has_column_privilege('authenticated','public.jobs','employer_id','UPDATE')
    or has_column_privilege('authenticated','public.profiles','id','UPDATE')
    then raise exception 'Unexpected privilege to a protected table or column'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('is_admin','admin_action','admin_dashboard','admin_upsert_reward',
      'submit_application','create_referral','submit_job','close_job','request_redemption','update_application_status') and p.prosecdef)
    then raise exception 'Public RPC must use invoker security'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and (has_function_privilege('anon',p.oid,'EXECUTE')
      or (p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false))))
    then raise exception 'Private functions must have fixed search path and deny anonymous execution'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
begin
  if public.is_admin() then raise exception 'User metadata incorrectly granted admin'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  update public.profiles set company_name = 'Test Company' where id = auth.uid();
  begin
    insert into public.jobs(employer_id,title,company,sector,location,description,status)
    values(auth.uid(),'Forbidden publish','Test Company','Technology & AI','London','A sufficiently long test job description.','live');
    raise exception 'SECURITY FAILURE: user published a job directly';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_dashboard(); raise exception 'SECURITY FAILURE: user read admin dashboard';
  exception when insufficient_privilege then null; end;
end;
$$;
insert into public.jobs(employer_id,title,company,sector,location,description,referral_tokens)
values(auth.uid(),'Test Platform Engineer','Test Company','Technology & AI','London','A sufficiently long test job description for security verification.',1000);
select public.submit_job(id) from public.jobs where employer_id = auth.uid();

reset role;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  if exists(select 1 from public.jobs where title = 'Test Platform Engineer') then raise exception 'Unpublished job leaked'; end if;
  begin perform public.admin_dashboard(); raise exception 'SECURITY FAILURE: anonymous RPC access';
  exception when insufficient_privilege then null; end;
end; $$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.admin_action('job',id,'approve') from public.jobs where employer_id = '10000000-0000-4000-8000-000000000001';
select public.admin_upsert_reward(null,'Test Career Credit','Verification','A temporary test reward, rolled back.',600,true);

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select public.create_referral(id) from public.jobs where employer_id = '10000000-0000-4000-8000-000000000001';
-- Save the opaque link ID in a transaction-local value for the candidate test.
select set_config('vantage.test_referral',(select id::text from public.referrals where referrer_id = auth.uid()),true);
insert into public.saved_jobs(member_id,job_id) select auth.uid(),id from public.jobs where employer_id = '10000000-0000-4000-8000-000000000001';
do $$ begin
  begin
    perform public.submit_application((select job_id from public.referrals where id = current_setting('vantage.test_referral')::uuid),
      'Self Referral','','',current_setting('vantage.test_referral')::uuid);
    raise exception 'SECURITY FAILURE: self referral accepted';
  exception when raise_exception then
    if sqlerrm like 'SECURITY FAILURE:%' then raise; end if;
  end;
end; $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select public.submit_application(id,'Test Candidate','I consent to sharing my name and progress with my referrer.',
  'https://example.invalid/cv.pdf',current_setting('vantage.test_referral')::uuid)
from public.jobs where employer_id = '10000000-0000-4000-8000-000000000001';
-- A network retry must return the existing application, not create a second one.
select public.submit_application(id,'Test Candidate','','',current_setting('vantage.test_referral')::uuid)
from public.jobs where employer_id = '10000000-0000-4000-8000-000000000001';
do $$ begin
  if (select count(*) from public.applications) <> 1 then raise exception 'Application uniqueness failed'; end if;
  if (select email from public.applications) <> 'vantage-candidate-test@example.invalid' then raise exception 'Email not taken from verified auth identity'; end if;
  if exists(select 1 from public.saved_jobs) then raise exception 'Another member saved jobs leaked'; end if;
  begin
    perform public.update_application_status((select id from public.applications),'hired');
    raise exception 'SECURITY FAILURE: candidate marked self hired';
  exception when raise_exception then if sqlerrm like 'SECURITY FAILURE:%' then raise; end if; end;
end; $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.applications) then raise exception 'Application contact details leaked to referrer'; end if;
  if (select candidate_name from public.referrals where id = current_setting('vantage.test_referral')::uuid) <> 'Test Candidate' then raise exception 'Consented referral progress missing'; end if;
  begin perform public.admin_action('referral',current_setting('vantage.test_referral')::uuid,'approve');
    raise exception 'SECURITY FAILURE: referrer awarded tokens';
  exception when insufficient_privilege then null; end;
end; $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.applications) <> 1 then raise exception 'Employer cannot see own job application'; end if;
end; $$;
select public.update_application_status(id,'hired') from public.applications;
select public.close_job(id) from public.jobs where employer_id = auth.uid();

-- Even a separately granted administrator cannot approve a referral in which
-- they are the referrer or hiring employer. Membership itself stays private.
reset role;
insert into private.admin_members(user_id) values
('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  begin perform public.admin_action('referral',current_setting('vantage.test_referral')::uuid,'approve');
    raise exception 'SECURITY FAILURE: administrator awarded their own referral';
  exception when raise_exception then if sqlerrm like 'SECURITY FAILURE:%' then raise; end if; end;
end; $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  begin perform public.admin_action('referral',current_setting('vantage.test_referral')::uuid,'approve');
    raise exception 'SECURITY FAILURE: employer verified their own referral award';
  exception when raise_exception then if sqlerrm like 'SECURITY FAILURE:%' then raise; end if; end;
end; $$;
reset role;
delete from private.admin_members where user_id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003');
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if not exists(select 1 from public.jobs where employer_id = '10000000-0000-4000-8000-000000000001' and status = 'closed')
    then raise exception 'Applicant lost access to historical job'; end if;
end; $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.admin_action('referral',current_setting('vantage.test_referral')::uuid,'approve');
select public.admin_action('referral',current_setting('vantage.test_referral')::uuid,'approve');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if (select sum(amount) from public.reward_ledger) <> 1000 or (select count(*) from public.reward_ledger) <> 1
    then raise exception 'Referral award was not exact and idempotent'; end if;
end; $$;
select public.request_redemption(id,'20000000-0000-4000-8000-000000000001') from public.reward_catalogue where title = 'Test Career Credit';
select public.request_redemption(id,'20000000-0000-4000-8000-000000000001') from public.reward_catalogue where title = 'Test Career Credit';
-- Duplicate click with another request ID is still one pending order/debit.
select public.request_redemption(id,'20000000-0000-4000-8000-000000000002') from public.reward_catalogue where title = 'Test Career Credit';
do $$ begin
  if (select sum(amount) from public.reward_ledger) <> 400 or (select count(*) from public.redemptions) <> 1
    then raise exception 'Redemption duplicate debited balance'; end if;
end; $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.admin_action('redemption','20000000-0000-4000-8000-000000000001','reject');
select public.admin_action('redemption','20000000-0000-4000-8000-000000000001','reject');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if (select sum(amount) from public.reward_ledger) <> 1000 or (select count(*) from public.reward_ledger where event_type = 'refund') <> 1
    then raise exception 'Rejected redemption refund was not exact and idempotent'; end if;
end; $$;
select public.request_redemption(id,'20000000-0000-4000-8000-000000000003') from public.reward_catalogue where title = 'Test Career Credit';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.admin_action('redemption','20000000-0000-4000-8000-000000000003','fulfil');
select public.admin_upsert_reward(null,'Test Expensive Credit','Verification','Cannot afford this offer.',600,true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  begin
    perform public.request_redemption((select id from public.reward_catalogue where title = 'Test Expensive Credit'));
    raise exception 'SECURITY FAILURE: balance overspent';
  exception when raise_exception then if sqlerrm like 'SECURITY FAILURE:%' then raise; end if; end;
end; $$;

reset role;
do $$ begin
  if (select sum(amount) from public.reward_ledger where member_id = '10000000-0000-4000-8000-000000000003') <> 400
    then raise exception 'Final balance is incorrect'; end if;
  if not exists(select 1 from private.audit_log where action = 'application.submitted' and detail ->> 'referral_consent' = 'true')
    then raise exception 'Referral consent audit is missing'; end if;
end; $$;
rollback;
select 'VANTAGE database verification passed; all synthetic data rolled back.' as result;
