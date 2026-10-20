"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Download, RefreshCw } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { authCallbackUrl, authErrorMessage, safeNextPath, supabase } from "../../lib/supabase";
import { getProfile, listLedger, listMyApplications, listMyReferrals, listRedemptions, listSavedJobs, saveProfile, type Profile } from "../../lib/platform";
import AuthShell from "./auth-shell";
import styles from "./account.module.css";

type Mode = "login" | "register" | "recover";
type ProfileInput = Pick<Profile, "display_name" | "account_type" | "company_name" | "headline" | "location" | "website" | "bio">;
const blankProfile: ProfileInput = { display_name: "", account_type: "candidate", company_name: "", headline: "", location: "", website: "", bio: "" };

export default function Account() {
  const router = useRouter();
  const emailInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileInput>(blankProfile);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [sessionError, setSessionError] = useState(false);
  const [nextPath, setNextPath] = useState("/workspace");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const identity = useRef({ id: null as string | null, generation: 0 });
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    if (requestedMode === "register" || requestedMode === "recover") setMode(requestedMode);
    if (params.get("confirm") === "1") setConfirmationPending(true);
    setNextPath(safeNextPath(params.get("next")));
    if (params.get("confirmed") === "1") setMessage("Email confirmed. Sign in to continue.");
    const client = supabase;
    if (!client) return;
    let active = true;
    let authEvents = 0;
    function acceptUser(next: User | null) {
      if (!active) return;
      if (identity.current.id !== (next?.id ?? null)) {
        identity.current = { id: next?.id ?? null, generation: identity.current.generation + 1 };
        setProfile(blankProfile); setProfileError(false); setProfileLoading(false);
        setEmail(''); setPassword(''); setMessage(''); setIsError(false);
        setBusy(false); setConfirmationPending(false);
      }
      setUser(next); setLoading(false);
    }
    setLoading(true);
    setSessionError(false);
    client.auth.getUser().then(({ data, error }) => {
      if (!active || authEvents > 0) return;
      acceptUser(data.user);
      if (error && error.name !== "AuthSessionMissingError") {
        setSessionError(true);
        setIsError(true);
        setMessage("We couldn’t restore your sign-in. Please sign in again.");
      }
    }).catch(() => {
      if (!active || authEvents > 0) return;
      setLoading(false);
      setSessionError(true);
      setIsError(true);
      setMessage("We couldn’t reach your account. Please check your connection and try again.");
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      authEvents += 1;
      acceptUser(session?.user ?? null);
      if (event === "SIGNED_OUT") {
        setProfile(blankProfile);
        setEmail("");
        setPassword("");
        setConfirmationPending(false);
      }
      if (event === "PASSWORD_RECOVERY") router.replace("/account/reset-password");
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router, authAttempt]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const version = identity.current.generation;
    setProfileLoading(true);
    setProfileError(false);
    getProfile().then((data) => {
      if (!active || version !== identity.current.generation) return;
      if (data && data.id !== user.id) throw new Error("Your account has changed.");
      if (data) {
        setProfile({ display_name: data.display_name, account_type: data.account_type, company_name: data.company_name, headline: data.headline, location: data.location, website: data.website, bio: data.bio });
      } else {
        setProfile({ ...blankProfile, display_name: typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : "" });
      }
    }).catch(() => {
      if (!active || version !== identity.current.generation) return;
      setProfileError(true);
      setIsError(true);
      setMessage("Your profile couldn’t be loaded. Please retry before making changes.");
    }).finally(() => { if (active && version === identity.current.generation) setProfileLoading(false); });
    return () => { active = false; };
  }, [user?.id, profileAttempt]);

  function feedback(value: string, error = false) { setMessage(value); setIsError(error); }
  function changeMode(value: Mode) { setMode(value); setPassword(""); setConfirmationPending(false); feedback(""); }
  function changeProfile(field: keyof ProfileInput, value: string) { setProfile((current) => ({ ...current, [field]: value })); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client || busy) return;
    setBusy(true);
    feedback("");
    try {
      const normalEmail = email.trim();
      if (mode === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(normalEmail, { redirectTo: authCallbackUrl("/account/reset-password", true) });
        if (error) throw error;
        feedback("If there’s an account with this email, a password reset link is on its way. Check your inbox and spam folder.");
        return;
      }
      if (mode === "register") {
        if (profile.display_name.trim().length < 2) {
          feedback("Please enter your name before creating your account.", true);
          return;
        }
        const { data, error } = await client.auth.signUp({ email: normalEmail, password, options: { emailRedirectTo: authCallbackUrl(nextPath), data: { display_name: profile.display_name.trim(), account_type: profile.account_type } } });
        if (error) throw error;
        setPassword("");
        if (data.session) { router.replace(nextPath); return; }
        setConfirmationPending(true);
        feedback("Check your email to confirm your account. If you already have an account, sign in or reset your password.");
        return;
      }
      const { error } = await client.auth.signInWithPassword({ email: normalEmail, password });
      if (error) throw error;
      setPassword("");
      router.replace(nextPath);
    } catch (error) {
      feedback(authErrorMessage(error, mode === "recover" ? "We couldn’t send a reset link. Please check your connection and try again." : "We couldn’t complete that request. Please check your connection and try again."), true);
      if (typeof error === "object" && error !== null && "code" in error && error.code === "email_not_confirmed") setConfirmationPending(true);
    } finally { setBusy(false); }
  }

  async function resendConfirmation() {
    if (!supabase || busy || !email.trim()) return;
    if (!emailInput.current?.reportValidity()) return;
    setBusy(true);
    feedback("");
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: authCallbackUrl(nextPath) } });
      if (error) throw error;
      feedback("If this account needs confirmation, a new link is on its way. Check your inbox and spam folder.");
    } catch (error) { feedback(authErrorMessage(error, "We couldn’t send a confirmation link. Please try again shortly."), true); }
    finally { setBusy(false); }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || profileError || profileLoading) return;
    const version = identity.current.generation;
    const memberId = user?.id;
    setBusy(true);
    feedback("");
    try {
      if (profile.display_name.trim().length < 2) {
        feedback("Please enter your name before saving your profile.", true);
        return;
      }
      if (profile.website.trim() && !/^https?:\/\//i.test(profile.website.trim())) {
        feedback("Your website or profile link needs to start with https:// or http://.", true);
        return;
      }
      await saveProfile({ ...profile, display_name: profile.display_name.trim(), company_name: profile.company_name.trim(), headline: profile.headline.trim(), location: profile.location.trim(), website: profile.website.trim(), bio: profile.bio.trim() }, memberId);
      if (!mounted.current || version !== identity.current.generation) return;
      feedback("Your profile is saved. You’re ready for your next move.");
    } catch { if (mounted.current && version === identity.current.generation) feedback("We couldn’t save your profile. Please check your connection and try again.", true); }
    finally { if (mounted.current && version === identity.current.generation) setBusy(false); }
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true);
    feedback("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(blankProfile);
      setPassword("");
      changeMode("login");
      feedback("You’ve been signed out.");
    } catch { feedback("We couldn’t sign you out. Please check your connection and try again.", true); }
    finally { setBusy(false); }
  }

  async function exportData() {
    const client = supabase;
    if (!client || !user || busy || !mounted.current) return;
    const memberId = user.id;
    const version = identity.current.generation;
    setBusy(true);
    feedback("");
    try {
      const [ownProfile, applications, referrals, ledger, redemptions, savedJobs] = await Promise.all([
        getProfile(), listMyApplications(), listMyReferrals(), listLedger(), listRedemptions(), listSavedJobs(),
      ]);
      if (!mounted.current || version !== identity.current.generation) return;
      const { data, error } = await client.auth.getUser();
      if (!mounted.current || version !== identity.current.generation) return;
      if (error || !data.user || data.user.id !== memberId || !ownProfile || ownProfile.id !== memberId) throw new Error("Session changed");
      const exportFile = {
        format_version: 1,
        exported_at: new Date().toISOString(),
        account: { id: memberId, email: data.user.email, created_at: data.user.created_at },
        profile: ownProfile,
        applications,
        // A member's export includes their introduction records, without the
        // candidate's identity or contact details.
        referrals: referrals.map(({ id, job_id, status, created_at, jobs }) => ({ id, job_id, status, created_at, jobs })),
        reward_ledger: ledger,
        redemptions,
        saved_job_ids: savedJobs,
      };
      const downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(exportFile, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `vantage-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      feedback("Your account data has been downloaded.");
    } catch { if (mounted.current && version === identity.current.generation) feedback("We couldn’t download your account data. Please check your connection and try again.", true); }
    finally { if (mounted.current && version === identity.current.generation) setBusy(false); }
  }

  const title = user ? "Make it yours." : mode === "register" ? "Let’s go places." : mode === "recover" ? "A fresh start." : "Good to see you.";
  const intro = user ? "Your profile helps the right people find the right connection." : mode === "register" ? "A new chapter starts with a connection." : mode === "recover" ? "We’ll email you a link to choose a new password." : "Your ambition. Your network. Your VANTAGE.";

  return (
    <AuthShell title={title} intro={intro}>
      {!supabase && <div className={styles.notice} role="alert"><div><strong>Sign-in is temporarily unavailable.</strong><p>Please reload this page and try again.</p><button className={styles.switch} onClick={() => window.location.reload()} type="button"><RefreshCw size={13} aria-hidden="true" /> Reload page</button></div></div>}
      {sessionError && <button type="button" className={styles.secondaryButton} disabled={busy || loading} onClick={() => { feedback(""); setAuthAttempt((value) => value + 1); }}><RefreshCw size={15} aria-hidden="true" /> Retry your connection</button>}
      {loading ? <p className={styles.loading} role="status">Checking your account…</p> : user ? (
        <>
          <div className={styles.accountSummary}><Check size={17} aria-hidden="true" /><span>Signed in as <strong>{user.email}</strong></span></div>
          <Link className={styles.primaryButton} href={nextPath}>Go to your workspace <ArrowUpRight size={18} aria-hidden="true" /></Link>
          {profileLoading ? <p className={styles.loading} role="status">Loading your profile…</p> : profileError ? <button type="button" className={styles.secondaryButton} onClick={() => { feedback(""); setProfileAttempt((value) => value + 1); }}><RefreshCw size={15} aria-hidden="true" /> Retry loading profile</button> : (
            <form className={`${styles.form} ${styles.profileForm}`} onSubmit={updateProfile} aria-busy={busy}>
              <fieldset disabled={busy}>
                <label htmlFor="profile-name">Your name<input id="profile-name" required minLength={2} maxLength={80} autoComplete="name" value={profile.display_name} onChange={(event) => changeProfile("display_name", event.target.value)} /></label>
                <AccountType value={profile.account_type} onChange={(value) => changeProfile("account_type", value)} />
                <label htmlFor="profile-headline">Professional headline<input id="profile-headline" maxLength={160} placeholder="What you do. What you’re building." value={profile.headline} onChange={(event) => changeProfile("headline", event.target.value)} /></label>
                <label htmlFor="profile-company">Company<input id="profile-company" maxLength={120} autoComplete="organization" value={profile.company_name} onChange={(event) => changeProfile("company_name", event.target.value)} /></label>
                <label htmlFor="profile-location">Location<input id="profile-location" maxLength={120} autoComplete="address-level2" placeholder="City or region" value={profile.location} onChange={(event) => changeProfile("location", event.target.value)} /></label>
                <label htmlFor="profile-website">Website or professional profile<input id="profile-website" type="url" maxLength={500} placeholder="https://" autoComplete="url" value={profile.website} onChange={(event) => changeProfile("website", event.target.value)} /></label>
                <label htmlFor="profile-bio">A little about you<textarea id="profile-bio" maxLength={2000} rows={4} value={profile.bio} onChange={(event) => changeProfile("bio", event.target.value)} /></label>
                <button className={styles.primaryButton} type="submit">{busy ? "Saving…" : "Save your profile"}<Check size={18} aria-hidden="true" /></button>
              </fieldset>
            </form>
          )}
          <div className={styles.accountActions}><Link className={styles.switch} href="/account/reset-password">Change password</Link><button className={styles.switch} disabled={busy} type="button" onClick={signOut}>{busy ? "One moment…" : "Sign out"}</button></div>
          <button className={styles.secondaryButton} disabled={busy || profileLoading} type="button" onClick={exportData}><Download size={15} aria-hidden="true" /> {busy ? "One moment…" : "Download my account data"}</button>
        </>
      ) : (
        <>
          <form className={styles.form} onSubmit={submit} aria-busy={busy}>
            <fieldset disabled={!supabase || busy}>
              {mode === "register" && <><label htmlFor="account-name">Your name<input id="account-name" required minLength={2} maxLength={80} autoComplete="name" value={profile.display_name} onChange={(event) => changeProfile("display_name", event.target.value)} placeholder="Your first and last name" /></label><AccountType value={profile.account_type} onChange={(value) => changeProfile("account_type", value)} /></>}
              <label htmlFor="account-email">Email address<input ref={emailInput} id="account-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@yourcompany.com" /></label>
              {mode !== "recover" && <label htmlFor="account-password">Password<input id="account-password" type="password" required minLength={mode === "register" ? 8 : undefined} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 8 characters" : "Your password"} /></label>}
              {mode === "register" && <label className={styles.consent}><input type="checkbox" required /><span>I understand VANTAGE will store my account and profile details to provide career, hiring and referral services.</span></label>}
              <button className={styles.primaryButton} type="submit">{busy ? "One moment…" : mode === "register" ? "Create your account" : mode === "recover" ? "Send reset link" : "Let’s get you in"}<ArrowUpRight size={19} aria-hidden="true" /></button>
            </fieldset>
          </form>
          {mode === "login" && <div className={styles.forgotRow}><button type="button" className={styles.switch} disabled={busy} onClick={() => changeMode("recover")}>Forgot your password?</button></div>}
          {confirmationPending && <button type="button" className={styles.secondaryButton} disabled={busy || !supabase || !email.trim()} onClick={resendConfirmation}>Send a new confirmation email</button>}
          <div className={styles.switchRow}><span>{mode === "login" ? "New around here?" : "Already part of the network?"}</span><button className={styles.switch} type="button" disabled={busy} onClick={() => changeMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Join VANTAGE" : "Sign in"}<ArrowUpRight size={13} aria-hidden="true" /></button></div>
        </>
      )}
      {message && <p className={`${styles.message} ${isError ? styles.errorMessage : ""}`} role={isError ? "alert" : "status"} aria-live="polite">{message}</p>}
    </AuthShell>
  );
}

function AccountType({ value, onChange }: { value: ProfileInput["account_type"]; onChange: (value: ProfileInput["account_type"]) => void }) {
  return <label htmlFor="account-type">I’m here to<select id="account-type" value={value} onChange={(event) => onChange(event.target.value as ProfileInput["account_type"])}><option value="candidate">Find my next opportunity</option><option value="employer">Hire great people</option><option value="referrer">Make introductions</option></select><span className={styles.fieldHint}>Your starting point. You can use all three.</span></label>;
}
