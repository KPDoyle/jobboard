"use client";

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, BriefcaseBusiness, Bookmark, Users, Gift, ShieldCheck, ArrowLeft, RefreshCw, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as api from '../../lib/platform';
import styles from './workspace.module.css';

type Tab = 'applications' | 'saved' | 'referrals' | 'employer' | 'rewards' | 'admin';
const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'applications', label: 'My applications', icon: BriefcaseBusiness },
  { id: 'saved', label: 'Saved jobs', icon: Bookmark },
  { id: 'referrals', label: 'My introductions', icon: Users },
  { id: 'employer', label: 'Employer workspace', icon: BriefcaseBusiness },
  { id: 'rewards', label: 'My rewards', icon: Gift },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];
const emptyJob: api.JobInput = { title: '', company: '', sector: 'Technology & AI', location: '', salary: '', type: 'Permanent', remote: 'Hybrid', description: '', referral_tokens: 0 };
const emptyReward = { title: '', category: 'Career development', description: '', tokens: 100, is_active: false };
const labels: Record<string, string> = { pending_review: 'Awaiting approval', in_review: 'In review', requested: 'Requested', live: 'Live', draft: 'Draft', submitted: 'Submitted', shared: 'Link ready', applied: 'Applied', approved: 'Verified & awarded', rejected: 'Not progressed', hired: 'Hired', fulfilled: 'Fulfilled', closed: 'Closed', withdrawn: 'Withdrawn', interview: 'Interview', offered: 'Offer made' };
function Status({ value }: { value: string }) { return <span className={styles.status} data-state={value}>{labels[value] || value}</span>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className={styles.empty}>{children}</div>; }

export default function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<Tab>('applications');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState<api.Profile | null>(null);
  const [jobs, setJobs] = useState<api.Job[]>([]);
  const [saved, setSaved] = useState<api.Job[]>([]);
  const [applications, setApplications] = useState<api.Application[]>([]);
  const [employerApplications, setEmployerApplications] = useState<api.Application[]>([]);
  const [referrals, setReferrals] = useState<api.Referral[]>([]);
  const [rewards, setRewards] = useState<api.Reward[]>([]);
  const [ledger, setLedger] = useState<api.LedgerEntry[]>([]);
  const [redemptions, setRedemptions] = useState<api.Redemption[]>([]);
  const [admin, setAdmin] = useState<api.AdminDashboard | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [jobForm, setJobForm] = useState<api.JobInput>(emptyJob);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [showJobForm, setShowJobForm] = useState(false);
  const [rewardForm, setRewardForm] = useState(emptyReward);
  const [rewardId, setRewardId] = useState<string | undefined>();
  const redemptionIds = useRef<Record<string, string>>({});
  const generation = useRef(0);
  const loadSequence = useRef(0);
  const lastUserId = useRef<string | null>(null);
  const userId = user?.id;
  const balance = ledger.reduce((sum, entry) => sum + entry.amount, 0);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    if (value && tabs.some(item => item.id === value)) setTab(value);
    if (!supabase) { setAuthReady(true); setLoading(false); return; }
    let active = true;
    function acceptUser(next: User | null) {
      if (!active) return;
      if (lastUserId.current !== (next?.id ?? null)) {
        generation.current += 1; lastUserId.current = next?.id ?? null;
        setProfile(null); setJobs([]); setSaved([]); setApplications([]); setEmployerApplications([]);
        setReferrals([]); setRewards([]); setLedger([]); setRedemptions([]); setAdmin(null); setIsStaff(false);
        setError(''); setNotice(''); setShowJobForm(false); setBusy(false); redemptionIds.current = {};
        setRewardForm(emptyReward); setRewardId(undefined); setJobForm(emptyJob); setEditingId(undefined);
      }
      setUser(next); setAuthReady(true);
    }
    supabase.auth.getUser().then(({ data }) => acceptUser(data.user)).catch(() => {
      if (active) { setAuthReady(true); setLoading(false); setError('We could not check your account. Please reload and try again.'); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => acceptUser(session?.user ?? null));
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const version = generation.current;
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try {
      const [p, j, a, ea, r, rw, l, rd, savedIds, liveJobs, staff] = await Promise.all([
        api.getProfile(), api.listEmployerJobs(), api.listMyApplications(), api.listEmployerApplications(),
        api.listMyReferrals(), api.listRewards(), api.listLedger(), api.listRedemptions(), api.listSavedJobs(), api.listJobs(), api.isAdmin(),
      ]);
      const current = await supabase?.auth.getUser();
      if (version !== generation.current || sequence !== loadSequence.current || current?.data.user?.id !== userId) return;
      const dashboard = staff ? await api.adminDashboard() : null;
      if (version !== generation.current || sequence !== loadSequence.current) return;
      setProfile(p); setJobs(j); setApplications(a); setEmployerApplications(ea); setReferrals(r);
      setRewards(rw); setLedger(l); setRedemptions(rd); setSaved(liveJobs.filter(job => savedIds.includes(job.id)));
      setIsStaff(staff); setAdmin(dashboard);
    } catch (e) { if (version === generation.current && sequence === loadSequence.current) setError(api.messageOf(e)); }
    finally { if (version === generation.current && sequence === loadSequence.current) setLoading(false); }
  }, [userId]);
  useEffect(() => { if (authReady) { if (userId) void load(); else setLoading(false); } }, [authReady, userId, load]);

  async function action(work: () => Promise<unknown>, success: string) {
    if (busy) return;
    const version = generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const current = await supabase?.auth.getUser();
      if (version !== generation.current || current?.data.user?.id !== userId) return;
      await work();
      if (version !== generation.current) return;
      setNotice(success); await load();
    } catch (e) { if (version === generation.current) setError(api.messageOf(e)); }
    finally { if (version === generation.current) setBusy(false); }
  }
  function selectTab(value: Tab) { setTab(value); setNotice(''); window.history.replaceState(null, '', `/workspace?tab=${value}`); }
  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(async () => { await api.saveEmployerJob(jobForm, editingId); setShowJobForm(false); setJobForm(emptyJob); setEditingId(undefined); }, 'Your draft is saved. Submit it for approval when it is ready.');
  }
  function editJob(job: api.Job) { setJobForm({ title: job.title, company: job.company, sector: job.sector, location: job.location, salary: job.salary, type: job.type, remote: job.remote, description: job.description, referral_tokens: job.referral_tokens }); setEditingId(job.id); setShowJobForm(true); }
  async function redeem(reward: api.Reward) {
    const requestId = redemptionIds.current[reward.id] ||= crypto.randomUUID();
    await action(async () => { await api.requestRedemption(reward.id, requestId); delete redemptionIds.current[reward.id]; }, 'Reward requested. Your tokens are reserved and our team will arrange fulfilment.');
  }
  async function copyReferral(referral: api.Referral) {
    try { await navigator.clipboard.writeText(api.referralUrl(referral.job_id, referral.id)); setNotice('Introduction link copied. Share it directly with someone who may be interested.'); }
    catch { setError('Copy the introduction link shown below.'); }
  }

  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/">vantage<span>.</span></Link><nav aria-label="Workspace navigation"><Link href="/">Discover jobs <ArrowUpRight size={15}/></Link><Link href="/account">My account</Link></nav></header>
    <div className={styles.shell}>
      <section className={styles.intro}><div><span className={styles.eyebrow}>YOUR AMBITION, CONNECTED</span><h1>{profile?.display_name ? `Your next chapter, ${profile.display_name.split(' ')[0]}.` : 'Your next chapter.'}</h1><p>Every opportunity. Every introduction. All in one place.</p></div>{user && <div className={styles.balance}><span>VANTAGE TOKENS</span><strong>{balance.toLocaleString()}</strong><small>Verified rewards balance</small></div>}</section>
      {!authReady ? <Empty>Checking your account…</Empty> : !supabase ? <Empty>We cannot connect right now. Please try again shortly.</Empty> : !user ? <section className={styles.signin}><h2>Make your next move.</h2><p>Sign in to save jobs, apply, introduce great people and manage your opportunities.</p><Link className={styles.primary} href={`/account?next=${encodeURIComponent('/workspace')}`}>Sign in or join VANTAGE <ArrowUpRight size={17}/></Link></section> : <>
        <div className={styles.tabs} role="tablist" aria-label="Your workspace">{tabs.filter(item => item.id !== 'admin' || isStaff).map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} onClick={() => selectTab(item.id)}><item.icon size={16}/>{item.label}</button>)}</div>
        <div className={styles.messages} aria-live="polite">{error && <p className={styles.error} role="alert">{error} <button onClick={() => void load()}>Try again</button></p>}{notice && <p className={styles.notice}>{notice}</p>}</div>
        <div className={styles.toolbar}><span>{loading ? 'Refreshing your workspace…' : 'Your information is securely saved to your account.'}</span><button disabled={loading || busy} onClick={() => void load()} aria-label="Refresh workspace"><RefreshCw size={16}/></button></div>
        <section id={`panel-${tab}`} role="tabpanel" className={styles.panel} aria-busy={loading || busy}>
          {loading && !profile ? <Empty>Loading your workspace…</Empty> : <>
          {tab === 'applications' && <><div className={styles.sectionHeading}><div><h2>Your applications</h2><p>Follow your progress and keep the next step in sight.</p></div><Link href="/">Find an opportunity <ArrowUpRight size={16}/></Link></div>{applications.length === 0 ? <Empty>No applications yet. Find a role that feels like you and make your move.</Empty> : applications.map(app => <article className={styles.row} key={app.id}><div><h3>{app.jobs?.title || 'Opportunity no longer listed'}</h3><p>{app.jobs?.company} · Applied {new Date(app.created_at).toLocaleDateString('en-GB')}</p><Status value={app.status}/></div>{!['withdrawn', 'rejected', 'hired'].includes(app.status) && <button disabled={busy} onClick={() => void action(() => api.updateApplicationStatus(app.id, 'withdrawn'), 'Your application has been withdrawn.')}>Withdraw application</button>}</article>)}</>}
          {tab === 'saved' && <><div className={styles.sectionHeading}><div><h2>Worth coming back to.</h2><p>Your saved opportunities follow you between devices. Closed jobs are removed from this list.</p></div></div>{saved.length === 0 ? <Empty>No saved jobs yet. Tap the bookmark on any open opportunity.</Empty> : saved.map(job => <article key={job.id} className={styles.row}><div><h3><Link href={`/jobs/${job.id}`}>{job.title}</Link></h3><p>{job.company} · {job.location} · {job.salary}</p></div><button disabled={busy} onClick={() => void action(() => api.setJobSaved(job.id, false), 'Job removed from your saved list.')}>Remove bookmark</button></article>)}</>}
          {tab === 'referrals' && <><div className={styles.sectionHeading}><div><h2>Good people. Great connections.</h2><p>Create a personal introduction link from any job. The candidate chooses whether to apply and share their progress with you.</p></div><Link href="/">Find a role to share <ArrowUpRight size={16}/></Link></div><div className={styles.callout}>Tokens are awarded only after a hire has been independently verified. Sharing a link or submitting an application does not earn tokens.</div>{referrals.length === 0 ? <Empty>Your introductions will appear here. Start by choosing “Make an introduction” on an open job.</Empty> : referrals.map(ref => <article className={styles.row} key={ref.id}><div><h3>{ref.jobs?.title || 'Opportunity no longer listed'}</h3><p>{ref.candidate_name || 'Awaiting a candidate application'} · {ref.jobs?.company}</p><Status value={ref.status}/><p><a href={api.referralUrl(ref.job_id, ref.id)}>{api.referralUrl(ref.job_id, ref.id)}</a></p></div><button disabled={busy} onClick={() => void copyReferral(ref)}>Copy introduction link</button></article>)}</>}
          {tab === 'employer' && <><div className={styles.sectionHeading}><div><h2>Find your next brilliant hire.</h2><p>Draft a vacancy, submit it for review, then manage applications here.</p></div><button className={styles.primary} disabled={busy} onClick={() => { setJobForm({ ...emptyJob, company: profile?.company_name || '' }); setEditingId(undefined); setShowJobForm(true); }}><Plus size={16}/> Create a job</button></div>
            {showJobForm && <form className={styles.form} onSubmit={saveJob}><h3>{editingId ? 'Edit your draft' : 'Create a vacancy'}</h3><fieldset disabled={busy}><div className={styles.formGrid}>
              <label>Job title<input required maxLength={160} value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })}/></label>
              <label>Company name<input required maxLength={160} value={jobForm.company} onChange={e => setJobForm({ ...jobForm, company: e.target.value })}/></label>
              <label>Sector<select value={jobForm.sector} onChange={e => setJobForm({ ...jobForm, sector: e.target.value as api.Job['sector'] })}><option>Technology &amp; AI</option><option>Legal</option><option>Finance</option></select></label>
              <label>Location<input required maxLength={160} value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })}/></label>
              <label>Salary range<input required maxLength={100} placeholder="£45,000–£60,000" value={jobForm.salary} onChange={e => setJobForm({ ...jobForm, salary: e.target.value })}/></label>
              <label>Employment type<select value={jobForm.type} onChange={e => setJobForm({ ...jobForm, type: e.target.value })}><option>Permanent</option><option>Contract</option><option>Part-time</option><option>Internship</option><option>Executive</option></select></label>
              <label>Working arrangement<select value={jobForm.remote} onChange={e => setJobForm({ ...jobForm, remote: e.target.value })}><option>Hybrid</option><option>Remote</option><option>On-site</option></select></label>
              <label>Referral tokens (subject to approval)<input type="number" min={0} max={1000000} step={1} required value={jobForm.referral_tokens} onChange={e => setJobForm({ ...jobForm, referral_tokens: Number(e.target.value) })}/></label>
            </div><label>Job description<textarea required minLength={40} maxLength={20000} rows={8} placeholder="Describe the role, responsibilities, requirements and what makes your team a great place to grow." value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })}/></label><div className={styles.buttons}><button className={styles.primary} type="submit">{busy ? 'Saving…' : 'Save draft'}</button><button type="button" onClick={() => setShowJobForm(false)}>Cancel</button></div></fieldset></form>}
            {jobs.length === 0 ? <Empty>Your next hire starts here. Create your first vacancy above.</Empty> : jobs.map(job => <article className={styles.row} key={job.id}><div><h3>{job.title}</h3><p>{job.company} · {job.location} · {job.salary}</p><Status value={job.status}/></div><div className={styles.buttons}>{job.status === 'draft' && <><button disabled={busy} onClick={() => editJob(job)}>Edit draft</button><button className={styles.primary} disabled={busy} onClick={() => void action(() => api.submitJob(job.id), 'Vacancy submitted for approval.')}>Submit for review</button></>}{job.status === 'live' && <Link href={`/jobs/${job.id}`}>View job <ArrowUpRight size={15}/></Link>}{job.status !== 'closed' && <button disabled={busy} onClick={() => void action(() => api.closeJob(job.id), 'Vacancy closed. It will no longer accept applications.')}>Close vacancy</button>}</div></article>)}
            <h2 className={styles.subheading}>Your applicants</h2>{employerApplications.length === 0 ? <Empty>Applications to your published jobs will arrive here.</Empty> : employerApplications.map(app => <article key={app.id} className={styles.applicant}><div className={styles.sectionHeading}><div><h3>{app.name}</h3><p>{app.jobs?.title} · {app.email}</p></div><Status value={app.status}/></div><p className={styles.preline}>{app.cover_note || 'No cover note provided.'}</p>{app.resume_url && <a href={app.resume_url} target="_blank" rel="noopener noreferrer">View candidate CV or portfolio <ArrowUpRight size={15}/></a>}{!['withdrawn', 'hired', 'rejected'].includes(app.status) && <label className={styles.inlineLabel}>Application stage<select disabled={busy} value={app.status} onChange={e => void action(() => api.updateApplicationStatus(app.id, e.target.value), 'Application stage updated.')}><option disabled value="submitted">Submitted</option><option value="in_review">In review</option><option value="interview">Interview</option><option value="offered">Offer made</option><option value="hired">Hired</option><option value="rejected">Not progressed</option></select></label>}</article>)}
          </>}
          {tab === 'rewards' && <><div className={styles.sectionHeading}><div><h2>Make good connections count.</h2><p>Earn tokens from verified hires and request available career rewards.</p></div><strong>{balance.toLocaleString()} tokens available</strong></div><div className={styles.callout}>Rewards are fulfilled by the VANTAGE team. Tokens have no cash value. Each request reserves the displayed tokens; rejected requests are refunded.</div>{rewards.length === 0 ? <Empty>No rewards are currently available. Any tokens you earn remain in your balance.</Empty> : <div className={styles.cards}>{rewards.map(reward => <article className={styles.card} key={reward.id}><span className={styles.eyebrow}>{reward.category}</span><h3>{reward.title}</h3><p>{reward.description}</p><strong>{reward.tokens.toLocaleString()} tokens</strong><button className={styles.primary} disabled={busy || balance < reward.tokens || redemptions.some(r => r.reward_id === reward.id && r.status === 'requested')} onClick={() => void redeem(reward)}>{redemptions.some(r => r.reward_id === reward.id && r.status === 'requested') ? 'Request pending' : balance < reward.tokens ? 'More tokens needed' : 'Request this reward'}</button></article>)}</div>}<h2 className={styles.subheading}>Your reward requests</h2>{redemptions.length === 0 ? <Empty>No reward requests yet.</Empty> : redemptions.map(redemption => <article className={styles.row} key={redemption.id}><div><h3>{redemption.reward_catalogue?.title || 'Reward request'}</h3><p>{redemption.tokens.toLocaleString()} tokens · {new Date(redemption.created_at).toLocaleDateString('en-GB')}</p></div><Status value={redemption.status}/></article>)}<h2 className={styles.subheading}>Token history</h2>{ledger.length === 0 ? <Empty>Your first verified award will appear here.</Empty> : ledger.map(entry => <article className={styles.row} key={entry.id}><div><h3>{entry.event_type === 'award' ? 'Verified introduction award' : entry.event_type === 'redeem' ? 'Reward request' : entry.event_type === 'refund' ? 'Reward request refunded' : 'Balance adjustment'}</h3><p>{new Date(entry.created_at).toLocaleDateString('en-GB')}</p></div><strong>{entry.amount > 0 ? '+' : ''}{entry.amount.toLocaleString()} tokens</strong></article>)}</>}
          {tab === 'admin' && (!admin ? <Empty>This area is available to VANTAGE administrators only.</Empty> : <><div className={styles.sectionHeading}><div><h2>Keep the platform moving.</h2><p>Review vacancies, verify hires and arrange reward fulfilment.</p></div><ShieldCheck size={26}/></div><h3>Vacancies awaiting review</h3>{admin.jobs.filter(job => job.status === 'pending_review').length === 0 ? <Empty>The vacancy queue is clear.</Empty> : admin.jobs.filter(job => job.status === 'pending_review').map(job => <article className={styles.applicant} key={job.id}><h3>{job.title} · {job.company}</h3><p>{job.location} · {job.salary} · {job.referral_tokens.toLocaleString()} referral tokens</p><p className={styles.preline}>{job.description}</p><div className={styles.buttons}><button className={styles.primary} disabled={busy} onClick={() => void action(() => api.adminAction('job', job.id, 'approve'), 'Vacancy approved and published.')}>Approve &amp; publish</button><button disabled={busy} onClick={() => void action(() => api.adminAction('job', job.id, 'reject'), 'Vacancy returned to draft for changes.')}>Return to draft</button></div></article>)}
          <h3 className={styles.subheading}>Introductions awaiting hire verification</h3>{admin.referrals.filter(r => r.status === 'hired').length === 0 ? <Empty>No hires await verification.</Empty> : admin.referrals.filter(r => r.status === 'hired').map(ref => <article className={styles.row} key={ref.id}><div><h3>{ref.candidate_name} · {ref.job_title || ref.jobs?.title}</h3><p>Referrer: {ref.referrer_name || ref.referrer_id} · {ref.referral_tokens ?? ref.jobs?.referral_tokens ?? 0} tokens</p><p>Verify the hire independently before approving.</p></div><div className={styles.buttons}><button disabled={busy} className={styles.primary} onClick={() => void action(() => api.adminAction('referral', ref.id, 'approve'), 'Hire verified. The introduction award has been recorded once.')}>Verify hire &amp; award</button><button disabled={busy} onClick={() => void action(() => api.adminAction('referral', ref.id, 'reject'), 'Introduction award rejected.')}>Reject award</button></div></article>)}
          <h3 className={styles.subheading}>Reward fulfilment</h3>{admin.redemptions.filter(r => r.status === 'requested').length === 0 ? <Empty>No reward requests await fulfilment.</Empty> : admin.redemptions.filter(r => r.status === 'requested').map(redemption => <article className={styles.row} key={redemption.id}><div><h3>{redemption.reward_title || redemption.reward_catalogue?.title || 'Reward request'}</h3><p>{redemption.member_name || redemption.member_id} · {redemption.member_email || ''} · {redemption.tokens.toLocaleString()} tokens</p></div><div className={styles.buttons}><button disabled={busy} className={styles.primary} onClick={() => void action(() => api.adminAction('redemption', redemption.id, 'fulfil'), 'Reward marked as fulfilled.')}>Mark fulfilled</button><button disabled={busy} onClick={() => void action(() => api.adminAction('redemption', redemption.id, 'reject'), 'Request rejected and tokens refunded once.')}>Reject &amp; refund</button></div></article>)}
          <h3 className={styles.subheading}>Manage the reward catalogue</h3><p>Only activate rewards that VANTAGE can fulfil.</p><div className={styles.cards}>{admin.rewards.map(reward => <article className={styles.card} key={reward.id}><h3>{reward.title}</h3><p>{reward.tokens.toLocaleString()} tokens · {reward.is_active ? 'Available' : 'Hidden'}</p><button disabled={busy} onClick={() => { setRewardId(reward.id); setRewardForm({ title: reward.title, category: reward.category, description: reward.description, tokens: reward.tokens, is_active: reward.is_active }); }}>Edit reward</button></article>)}</div>
          <form className={styles.form} onSubmit={e => { e.preventDefault(); void action(async () => { await api.adminSaveReward(rewardForm, rewardId); setRewardId(undefined); setRewardForm(emptyReward); }, 'Reward catalogue updated.'); }}><h3>{rewardId ? 'Edit reward' : 'Add a reward'}</h3><fieldset disabled={busy}><div className={styles.formGrid}><label>Reward title<input required maxLength={160} value={rewardForm.title} onChange={e => setRewardForm({ ...rewardForm, title: e.target.value })}/></label><label>Category<input required maxLength={100} value={rewardForm.category} onChange={e => setRewardForm({ ...rewardForm, category: e.target.value })}/></label><label>Tokens required<input required type="number" min={1} max={1000000} step={1} value={rewardForm.tokens} onChange={e => setRewardForm({ ...rewardForm, tokens: Number(e.target.value) })}/></label></div><label>What is included?<textarea required maxLength={3000} rows={3} value={rewardForm.description} onChange={e => setRewardForm({ ...rewardForm, description: e.target.value })}/></label><label className={styles.checkbox}><input type="checkbox" checked={rewardForm.is_active} onChange={e => setRewardForm({ ...rewardForm, is_active: e.target.checked })}/>Available to members</label><div className={styles.buttons}><button className={styles.primary} type="submit">Save reward</button>{rewardId && <button type="button" onClick={() => { setRewardId(undefined); setRewardForm(emptyReward); }}>Cancel edit</button>}</div></fieldset></form>
          </>)}
          </>}
        </section>
      </>}
      <footer className={styles.footer}><Link href="/"><ArrowLeft size={15}/> Back to opportunities</Link><span>Good people. Great possibilities.</span><Link href="/privacy">Privacy &amp; your data</Link></footer>
    </div>
  </main>;
}
