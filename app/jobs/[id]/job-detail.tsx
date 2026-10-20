"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, CheckCircle2, Copy, Link2, MapPin } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { createReferral, getJob, getOwnApplication, listSavedJobs, setJobSaved, submitApplication, type Job } from "../../../lib/platform";
import { MarketplaceFooter, MarketplaceHeader } from "../marketplace-chrome";
import styles from "../../marketplace.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export default function JobDetail({ jobId, referralCode }: { jobId: string; referralCode: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [referralId, setReferralId] = useState(uuid.test(referralCode) ? referralCode : "");
  const [referralProblem, setReferralProblem] = useState(referralCode && !uuid.test(referralCode) ? "This referral link is not valid. You can still apply directly below." : "");
  const [shareUrl, setShareUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [name, setName] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ownApplication, setOwnApplication] = useState<{ id: string; status: string } | null>(null);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const identity = useRef<string | null>(null);
  const identityGeneration = useRef(0);

  useEffect(() => {
    setReferralId(uuid.test(referralCode) ? referralCode : "");
    setReferralProblem(referralCode && !uuid.test(referralCode) ? "This referral link is not valid. You can still apply directly below." : "");
    setConsent(false);
  }, [referralCode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (!uuid.test(jobId)) { setJob(null); setLoading(false); return; }
    getJob(jobId).then((data) => { if (active) setJob(data); }).catch((cause) => {
      if (active) setError(errorMessage(cause, "We could not load this role. Please try again."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, reload]);

  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthLoading(false); return; }
    let active = true;
    let authRevision = 0;
    function acceptUser(nextUser: User | null) {
      if (!active) return;
      const nextId = nextUser?.id ?? null;
      if (identity.current !== nextId) {
        identity.current = nextId;
        identityGeneration.current += 1;
        setName("");
        setCoverNote("");
        setResumeUrl("");
        setConsent(false);
        setOwnApplication(null);
        setSubmitted(false);
        setApplicationError("");
        setApplicationBusy(false);
        setApplicationLoading(Boolean(nextUser));
        setShareUrl("");
        setShareNotice("");
        setShareBusy(false);
        setSaved(false);
        setSaveNotice("");
        setSaveBusy(false);
        setSaveLoading(Boolean(nextUser));
      }
      setUser(nextUser);
      setAuthLoading(false);
    }
    const initialRevision = authRevision;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      authRevision += 1;
      acceptUser(session?.user ?? null);
    });
    client.auth.getUser().then(({ data }) => {
      if (active && authRevision === initialRevision) acceptUser(data.user);
    }).catch(() => { if (active && authRevision === initialRevision) acceptUser(null); });
    return () => { active = false; identityGeneration.current += 1; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) { setSaved(false); setSaveLoading(false); return; }
    let active = true;
    const generation = identityGeneration.current;
    const memberId = user.id;
    setSaveLoading(true);
    listSavedJobs().then((data) => { if (active && isCurrentIdentity(generation, memberId)) setSaved(data.includes(jobId)); }).catch(() => { if (active && isCurrentIdentity(generation, memberId)) setSaveNotice("Your saved roles could not be loaded. Refresh to try again."); }).finally(() => { if (active && isCurrentIdentity(generation, memberId)) setSaveLoading(false); });
    return () => { active = false; };
  }, [user?.id, jobId]);

  useEffect(() => {
    if (!user) { setOwnApplication(null); setApplicationLoading(false); return; }
    let active = true;
    const generation = identityGeneration.current;
    const memberId = user.id;
    setApplicationLoading(true);
    getOwnApplication(jobId).then((data) => { if (active && isCurrentIdentity(generation, memberId)) setOwnApplication(data); }).catch(() => {
      if (active && isCurrentIdentity(generation, memberId)) setApplicationError("We could not check your previous application. If you have already applied, view its progress in your workspace.");
    }).finally(() => { if (active && isCurrentIdentity(generation, memberId)) setApplicationLoading(false); });
    return () => { active = false; };
  }, [user?.id, jobId]);

  function isCurrentIdentity(generation: number, memberId: string) {
    return identityGeneration.current === generation && identity.current === memberId;
  }

  function signIn(anchor = "") {
    const next = `/jobs/${jobId}${referralId ? `?ref=${encodeURIComponent(referralId)}` : ""}${anchor}`;
    router.push(`/account?next=${encodeURIComponent(next)}`);
  }

  function applyDirectly() {
    if (applicationBusy) return;
    setReferralId("");
    setReferralProblem("");
    setConsent(false);
    router.replace(`/jobs/${jobId}#apply`, { scroll: false });
  }

  async function toggleSaved() {
    if (!user) { signIn(); return; }
    if (identity.current !== user.id) return;
    if (saveBusy || saveLoading) return;
    const generation = identityGeneration.current;
    const memberId = user.id;
    setSaveBusy(true);
    setSaveNotice("");
    try {
      await setJobSaved(jobId, !saved, memberId);
      if (!isCurrentIdentity(generation, memberId)) return;
      setSaved(!saved);
      setSaveNotice(saved ? "Role removed from your saved list." : "Role saved to your workspace.");
    }
    catch (cause) { if (isCurrentIdentity(generation, memberId)) setSaveNotice(errorMessage(cause, "We could not update this saved role. Please try again.")); }
    finally { if (isCurrentIdentity(generation, memberId)) setSaveBusy(false); }
  }

  async function makeReferral() {
    if (!user) { signIn("#share"); return; }
    if (identity.current !== user.id) return;
    if (shareBusy) return;
    const generation = identityGeneration.current;
    const memberId = user.id;
    setShareBusy(true);
    setShareNotice("");
    try {
      const referral = await createReferral(jobId, memberId);
      if (!isCurrentIdentity(generation, memberId)) return;
      const url = new URL(`/jobs/${jobId}`, window.location.origin);
      url.searchParams.set("ref", referral.id);
      setShareUrl(url.toString());
    } catch (cause) { if (isCurrentIdentity(generation, memberId)) setShareNotice(errorMessage(cause, "We could not create your referral link. Please try again.")); }
    finally { if (isCurrentIdentity(generation, memberId)) setShareBusy(false); }
  }

  async function copyLink() {
    if (!user || identity.current !== user.id || !shareUrl) return;
    const generation = identityGeneration.current;
    const memberId = user.id;
    try { await navigator.clipboard.writeText(shareUrl); if (isCurrentIdentity(generation, memberId)) setShareNotice("Link copied. Share it with your connection."); }
    catch { if (isCurrentIdentity(generation, memberId)) setShareNotice("Select the link above and copy it to share with your connection."); }
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { signIn("#apply"); return; }
    if (identity.current !== user.id) return;
    if (applicationBusy || !consent) return;
    const generation = identityGeneration.current;
    const memberId = user.id;
    setApplicationError("");
    let url: URL;
    try { url = new URL(resumeUrl.trim()); }
    catch { setApplicationError("Enter a full, secure CV link beginning with https://."); return; }
    if (url.protocol !== "https:" || url.username || url.password) { setApplicationError("Use a secure CV link beginning with https://, without a username or password in the address."); return; }
    if (name.trim().length < 2) { setApplicationError("Please enter your full name."); return; }
    setApplicationBusy(true);
    try {
      const currentUser = await supabase?.auth.getUser();
      if (!isCurrentIdentity(generation, memberId)) return;
      if (currentUser?.error || currentUser?.data.user?.id !== memberId) throw new Error("Your account changed. Please check your account and try again.");
      await submitApplication({ jobId, expectedUserId: memberId, name: name.trim(), coverNote: coverNote.trim(), resumeUrl: url.toString(), ...(referralId ? { referralId } : {}) });
      if (!isCurrentIdentity(generation, memberId)) return;
      setSubmitted(true);
      setCoverNote("");
      setResumeUrl("");
    } catch (cause) { if (isCurrentIdentity(generation, memberId)) setApplicationError(errorMessage(cause, "Your application could not be submitted. Please try again.")); }
    finally { if (isCurrentIdentity(generation, memberId)) setApplicationBusy(false); }
  }

  return <div className="site">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <MarketplaceHeader signedIn={Boolean(user)} />
    <main id="main-content" className={styles.detail}>
      <Link href="/#positions" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> All opportunities</Link>
      {loading ? <div className={styles.status} role="status"><BriefcaseBusiness size={30} aria-hidden="true" /><h1>Finding your next move…</h1><p>Loading the opportunity.</p></div> : error ? <div className={styles.status} role="alert"><AlertCircle size={30} aria-hidden="true" /><h1>Let’s try that again.</h1><p>{error}</p><button type="button" className="primary-button" onClick={() => setReload((value) => value + 1)}>Reload this role <ArrowRight size={17} aria-hidden="true" /></button></div> : !job || job.status !== "live" ? <div className={styles.status}><BriefcaseBusiness size={30} aria-hidden="true" /><h1>This chapter has closed.</h1><p>This opportunity is no longer accepting applications, or the link may have changed. There could be something else with your name on it.</p><Link href="/#positions" className={`primary-button ${styles.actionLink}`}>Find another role <ArrowUpRight size={17} aria-hidden="true" /></Link></div> : <div className={styles.detailGrid}>
        <div>
          <header className={styles.detailHeader}>
            <div className="job-meta"><span className="sector-tag">{job.sector}</span><span>{job.type}</span></div>
            <h1>{job.title}</h1><p className={styles.company}>{job.company}</p>
            <div className={styles.facts}><span><MapPin size={16} aria-hidden="true" />{job.location} · {job.remote}</span><span><BriefcaseBusiness size={16} aria-hidden="true" />{job.salary}</span></div>
          </header>
          <section aria-labelledby="role-description-title"><h2 id="role-description-title" className={styles.descriptionTitle}>The opportunity.</h2><p className={styles.description}>{job.description}</p></section>
          <section id="apply" className={styles.formPanel} aria-labelledby="application-title">
            <div className="eyebrow dark">YOUR NEXT MOVE STARTS HERE</div><h2 id="application-title">Make it yours.</h2>
            {user?.id === job.employer_id ? <><p className={styles.formIntro}>This is your vacancy. Review incoming applications and manage the role in your employer workspace.</p><Link className={`primary-button ${styles.actionLink}`} href="/workspace?tab=employer">Manage my vacancy <ArrowUpRight size={18} aria-hidden="true" /></Link></> : submitted || ownApplication ? <div className={styles.success} role="status"><CheckCircle2 size={26} aria-hidden="true" /><h3>{submitted ? "You’re on your way." : "You’ve made your move."}</h3><p>{submitted ? `Your application for ${job.title} at ${job.company} has been submitted.` : `You have already applied for this role. Current status: ${ownApplication?.status.replaceAll("_", " ")}.`} Track its progress in your workspace.</p><Link href="/workspace?tab=applications">View my applications ↗</Link></div> : authLoading || applicationLoading ? <p className={styles.formIntro} role="status">Checking your account and applications…</p> : !user ? <><p className={styles.formIntro}>Sign in or create an account to apply. Your application is shared directly with the employer and you can track it in your workspace.</p>{referralId && <div className={styles.notice}><p>You arrived through a referral. You will be asked for consent before your name and application progress are shared with your referrer.</p><button className={styles.inlineButton} type="button" disabled={applicationBusy} onClick={applyDirectly}>Prefer to apply without a referral?</button></div>}<button type="button" className="primary-button" onClick={() => signIn("#apply")}>Sign in to apply <ArrowUpRight size={18} aria-hidden="true" /></button></> : <>
              <p className={styles.formIntro}>Applying as <strong>{user.email}</strong>. Tell {job.company} a little about yourself and include a link to your CV.</p>
              {referralProblem && <p className={styles.notice}>{referralProblem}</p>}
              {referralId && <div className={styles.notice}><p>You’re applying through a referral. Your name and application progress will be shared with your referrer if you consent below.</p><button className={styles.inlineButton} type="button" disabled={applicationBusy} onClick={applyDirectly}>Apply without a referral instead</button></div>}
              <form className={styles.form} onSubmit={apply} aria-busy={applicationBusy}>
                <label htmlFor="candidate-name">Full name<input id="candidate-name" name="name" autoComplete="name" minLength={2} maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} disabled={applicationBusy} /></label>
                <label htmlFor="candidate-resume">CV link<input id="candidate-resume" name="resume" type="url" inputMode="url" required maxLength={2000} placeholder="https://…" value={resumeUrl} onChange={(event) => setResumeUrl(event.target.value)} disabled={applicationBusy} aria-describedby="cv-help" /><span id="cv-help" className={styles.tiny}>Use a secure document link the employer can open. Check your sharing permissions before submitting.</span></label>
                <label htmlFor="candidate-cover-note">Why this role? <span className={styles.tiny}>Optional · up to 10,000 characters</span><textarea id="candidate-cover-note" name="cover-note" maxLength={10000} value={coverNote} onChange={(event) => setCoverNote(event.target.value)} disabled={applicationBusy} placeholder="A little about your experience, your ambition, and why this feels like your next move." /></label>
                <label className={styles.consent} htmlFor="candidate-consent"><input id="candidate-consent" type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={applicationBusy} /><span>I agree to share my name, contact details, CV link and application with {job.company} for recruitment.{referralId ? " I also consent to my name and application progress being shared with my referrer. My contact details and CV link stay private to the employer." : " I understand that the employer can review this information to consider me for this role."}</span></label>
                {applicationError && <p className={`${styles.notice} ${styles.error}`} role="alert">{applicationError}</p>}
                <button type="submit" className="primary-button" disabled={applicationBusy}>{applicationBusy ? "Submitting your application…" : "Send my application"}<ArrowUpRight size={18} aria-hidden="true" /></button>
              </form>
            </>}
          </section>
          <div className={styles.bottomNav}><Link className={styles.back} href="/#positions"><ArrowLeft size={16} aria-hidden="true" /> Back to opportunities</Link><Link className={styles.back} href="/workspace?tab=applications">My applications <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
        </div>
        <aside className={styles.aside} aria-label="Role actions">
          <h2>A good move starts here.</h2><p>Ready for what’s next? Apply, save it for later, or open the door for someone else.</p>
          <a href={user?.id === job.employer_id ? "/workspace?tab=employer" : "#apply"} className={`primary-button ${styles.asideAction}`}>{user?.id === job.employer_id ? "Manage this role" : "Apply for this role"} <ArrowUpRight size={18} aria-hidden="true" /></a>
          <button type="button" className={styles.secondary} onClick={toggleSaved} disabled={authLoading || saveBusy || saveLoading}><Bookmark size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" />{saveBusy ? "Saving…" : saved ? "Saved · remove from list" : "Save this role"}</button>
          {saveNotice && <p role="status">{saveNotice}</p>}
          <div className={styles.divider} />
          <section id="share" aria-labelledby="share-title"><h2 id="share-title">Know someone brilliant?</h2><p>Share your personal referral link. They choose whether to apply and consent to sharing their progress with you.</p></section>
          {job.referral_tokens > 0 && <><div className={styles.rewardNumber}>✳ {job.referral_tokens.toLocaleString()} tokens</div><p className={styles.tiny}>Potential reward after an eligible, verified hire and approval. Sharing a link does not award tokens.</p></>}
          {user?.id === job.employer_id ? <p className={styles.tiny}>Members can share referral links for your vacancy. Follow applications in your employer workspace.</p> : shareUrl ? <><label className={styles.tiny} htmlFor="referral-share-url">Your personal referral link</label><input id="referral-share-url" className={styles.referralLink} value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} /><button type="button" className={styles.secondary} onClick={copyLink}><Copy size={16} aria-hidden="true" /> Copy referral link</button><p className={styles.tiny}>Each link can be used by one candidate.</p><button type="button" className={styles.inlineButton} disabled={shareBusy} onClick={makeReferral}>{shareBusy ? "Creating another link…" : "Create another introduction link"}</button><Link className={styles.tiny} href="/workspace?tab=referrals">Track my introductions ↗</Link></> : <button type="button" className={styles.secondary} disabled={shareBusy || authLoading} onClick={makeReferral}><Link2 size={16} aria-hidden="true" />{shareBusy ? "Creating your link…" : user ? "Make an introduction" : "Sign in to refer someone"}</button>}
          {shareNotice && <p role="status">{shareNotice}</p>}
        </aside>
      </div>}
    </main>
    <MarketplaceFooter />
  </div>;
}
