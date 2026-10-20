import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

export type Profile = {
  id: string; display_name: string; account_type: 'candidate' | 'employer' | 'referrer';
  company_name: string; headline: string; location: string; website: string; bio: string; created_at: string;
};
export type Job = {
  id: string; employer_id: string; title: string; company: string;
  sector: 'Legal' | 'Technology & AI' | 'Finance'; location: string; salary: string;
  type: string; remote: string; description: string; referral_tokens: number;
  status: 'draft' | 'pending_review' | 'live' | 'closed'; created_at: string; updated_at: string;
};
export type Application = {
  id: string; job_id: string; candidate_id: string; name: string; email: string;
  cover_note: string; resume_url: string; status: string; referral_id: string | null; created_at: string;
  jobs: Pick<Job, 'title' | 'company'> | null;
};
export type Referral = {
  id: string; job_id: string; referrer_id: string; candidate_id: string | null;
  candidate_name: string | null; status: string; created_at: string;
  jobs: Pick<Job, 'title' | 'company' | 'referral_tokens'> | null;
};
export type Reward = { id: string; title: string; category: string; description: string; tokens: number; is_active: boolean };
export type LedgerEntry = { id: string; amount: number; event_type: string; reference: string; created_at: string };
export type Redemption = { id: string; member_id: string; reward_id: string; tokens: number; status: string; created_at: string; reward_catalogue: Pick<Reward, 'title'> | null };
export type AdminDashboard = {
  jobs: Job[];
  referrals: (Referral & { job_title?: string; referrer_name?: string; application_status?: string; referral_tokens?: number })[];
  redemptions: (Redemption & { reward_title?: string; member_name?: string; member_email?: string })[];
  rewards: Reward[];
};

function client() {
  if (!supabase) throw new Error('VANTAGE is temporarily unavailable. Please try again shortly.');
  return supabase;
}
function check(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new Error('This has already been submitted. Refresh to see the latest status.');
  if (error.code === '42501') throw new Error('You do not have permission to make this change.');
  if (error.code === 'PGRST301' || error.code === 'PGRST303') throw new Error('Your session has expired. Please sign in again.');
  throw new Error(error.message);
}
async function member() {
  const c = client();
  const { data, error } = await c.auth.getUser();
  if (error || !data.user) throw new Error('Please sign in to continue.');
  return data.user;
}
async function rpc<T>(name: string, args?: Record<string, unknown>, expectedUserId?: string): Promise<T> {
  const { data: { session }, error: sessionError } = await client().auth.getSession();
  if (sessionError || !session || (expectedUserId && session.user.id !== expectedUserId)) throw new Error('Your account has changed. Please refresh and try again.');
  // Bind the request to this session, even if another tab changes accounts while
  // the request is being prepared. The database still authenticates every call.
  const requestClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    accessToken: async () => session.access_token,
  });
  const { data, error } = await requestClient.rpc(name, args);
  check(error);
  return data as T;
}

export async function listJobs(): Promise<Job[]> {
  const { data, error } = await client().from('jobs').select('*').eq('status', 'live').order('created_at', { ascending: false });
  check(error); return data ?? [];
}
export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await client().from('jobs').select('*').eq('id', id).maybeSingle();
  check(error); return data;
}
export async function getProfile(): Promise<Profile | null> {
  const user = await member();
  const { data, error } = await client().from('profiles').select('*').eq('id', user.id).maybeSingle();
  check(error); return data;
}
export async function saveProfile(input: Pick<Profile, 'display_name' | 'account_type' | 'company_name' | 'headline' | 'location' | 'website' | 'bio'>, expectedUserId?: string): Promise<void> {
  const user = await member();
  if (expectedUserId && user.id !== expectedUserId) throw new Error('Your account has changed. Please refresh and try again.');
  const { error } = await client().from('profiles').update(input).eq('id', user.id).select('id').single(); check(error);
}
export async function listSavedJobs(): Promise<string[]> {
  const user = await member();
  const { data, error } = await client().from('saved_jobs').select('job_id').eq('member_id', user.id);
  check(error); return (data ?? []).map(row => row.job_id);
}
export async function setJobSaved(jobId: string, saved: boolean, expectedUserId?: string): Promise<void> {
  const user = await member(); const c = client();
  if (expectedUserId && user.id !== expectedUserId) throw new Error('Your account has changed. Please refresh and try again.');
  const { error } = saved
    ? await c.from('saved_jobs').upsert({ member_id: user.id, job_id: jobId }, { onConflict: 'member_id,job_id', ignoreDuplicates: true })
    : await c.from('saved_jobs').delete().eq('member_id', user.id).eq('job_id', jobId);
  check(error);
}
export async function submitApplication(input: { jobId: string; name: string; coverNote: string; resumeUrl: string; referralId?: string; expectedUserId?: string }): Promise<unknown> {
  return rpc('submit_application', { p_job_id: input.jobId, p_name: input.name.trim(), p_cover_note: input.coverNote.trim(), p_resume_url: input.resumeUrl.trim(), p_referral_id: input.referralId || null }, input.expectedUserId);
}
export async function getOwnApplication(jobId: string): Promise<{ id: string; status: string } | null> {
  const user = await member();
  const { data, error } = await client().from('applications').select('id,status').eq('job_id', jobId).eq('candidate_id', user.id).maybeSingle();
  check(error); return data;
}
export async function createReferral(jobId: string, expectedUserId?: string): Promise<{ id: string }> { return rpc('create_referral', { p_job_id: jobId }, expectedUserId); }
export async function listMyApplications(): Promise<Application[]> {
  const user = await member();
  const { data, error } = await client().from('applications').select('*,jobs(title,company)').eq('candidate_id', user.id).order('created_at', { ascending: false });
  check(error); return data as unknown as Application[] ?? [];
}
export async function listEmployerApplications(): Promise<Application[]> {
  const { data, error } = await client().from('applications').select('*,jobs!inner(title,company,employer_id)').eq('jobs.employer_id', (await member()).id).order('created_at', { ascending: false });
  check(error); return data as unknown as Application[] ?? [];
}
export async function updateApplicationStatus(id: string, status: string): Promise<void> { await rpc('update_application_status', { p_application_id: id, p_status: status }); }
export async function listMyReferrals(): Promise<Referral[]> {
  const user = await member(); const { data, error } = await client().from('referrals').select('*,jobs(title,company,referral_tokens)').eq('referrer_id', user.id).order('created_at', { ascending: false });
  check(error); return data as unknown as Referral[] ?? [];
}
export async function listEmployerJobs(): Promise<Job[]> {
  const { data, error } = await client().from('jobs').select('*').eq('employer_id', (await member()).id).order('created_at', { ascending: false });
  check(error); return data ?? [];
}
export type JobInput = Pick<Job, 'title' | 'company' | 'sector' | 'location' | 'salary' | 'type' | 'remote' | 'description' | 'referral_tokens'>;
export async function saveEmployerJob(input: JobInput, id?: string): Promise<void> {
  const c = client(); const user = await member();
  const { error } = id
    ? await c.from('jobs').update(input).eq('id', id).eq('employer_id', user.id).select('id').single()
    : await c.from('jobs').insert({ ...input, employer_id: user.id }).select('id').single();
  check(error);
}
export async function submitJob(id: string): Promise<void> { await rpc('submit_job', { p_job_id: id }); }
export async function closeJob(id: string): Promise<void> { await rpc('close_job', { p_job_id: id }); }
export async function listRewards(): Promise<Reward[]> {
  const { data, error } = await client().from('reward_catalogue').select('*').eq('is_active', true).order('tokens');
  check(error); return data ?? [];
}
export async function listLedger(): Promise<LedgerEntry[]> {
  const user = await member();
  const result: LedgerEntry[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client().from('reward_ledger').select('*').eq('member_id', user.id)
      .order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1);
    check(error);
    result.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) return result;
  }
}
export async function listRedemptions(): Promise<Redemption[]> {
  const { data, error } = await client().from('redemptions').select('*,reward_catalogue(title)').eq('member_id', (await member()).id).order('created_at', { ascending: false });
  check(error); return data as unknown as Redemption[] ?? [];
}
export async function requestRedemption(id: string, requestId: string): Promise<void> { await rpc('request_redemption', { p_reward_id: id, p_request_id: requestId }); }
export async function isAdmin(): Promise<boolean> { return rpc('is_admin'); }
export async function adminDashboard(): Promise<AdminDashboard> { return rpc('admin_dashboard'); }
export async function adminAction(kind: 'job' | 'referral' | 'redemption', id: string, action: string): Promise<void> { await rpc('admin_action', { p_kind: kind, p_id: id, p_action: action }); }
export async function adminSaveReward(input: Omit<Reward, 'id'>, id?: string): Promise<void> {
  await rpc('admin_upsert_reward', { p_id: id || null, p_title: input.title, p_category: input.category, p_description: input.description, p_tokens: input.tokens, p_is_active: input.is_active });
}
export function referralUrl(jobId: string, referralId: string): string { return `${window.location.origin}/jobs/${encodeURIComponent(jobId)}?ref=${encodeURIComponent(referralId)}`; }
export function messageOf(error: unknown): string { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
