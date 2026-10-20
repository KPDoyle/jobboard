"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, RefreshCw } from "lucide-react";
import { authErrorMessage, supabase, updatePasswordForSession } from "../../../lib/supabase";
import AuthShell from "../auth-shell";
import styles from "../account.module.css";

export default function ResetPassword() {
  const [loading, setLoading] = useState(true);
  const [authorizedUserId, setAuthorizedUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [checkFailed, setCheckFailed] = useState(false);
  const identity = useRef({ id: null as string | null, generation: 0 });
  const boundUserId = useRef<string | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setCheckFailed(false);
    const client = supabase;
    if (!client) {
      setMessage("Sign-in is temporarily unavailable. Please reload this page and try again.");
      setLoading(false);
      return;
    }
    function observeIdentity(nextId: string | null) {
      if (!active || identity.current.id === nextId) return;
      identity.current = { id: nextId, generation: identity.current.generation + 1 };
      setAuthorizedUserId(null);
      setPassword("");
      setConfirmation("");
      setSaved(false);
      setBusy(false);
      if (boundUserId.current) {
        setLoading(false);
        setMessage("Your account has changed. Open a fresh reset link or return to your account before changing a password.");
      }
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      observeIdentity(session?.user.id ?? null);
    });
    (async () => {
      const { data: { session }, error: sessionError } = await client.auth.getSession();
      if (!active) return;
      if (sessionError) throw sessionError;
      if (!session) {
        observeIdentity(null);
        setAuthorizedUserId(null);
        setMessage("Open the reset link from your email or sign in before choosing a new password.");
        return;
      }
      const memberId = session.user.id;
      if (identity.current.id && identity.current.id !== memberId) return;
      observeIdentity(memberId);
      const version = identity.current.generation;
      // Verify the captured token, rather than a session that another tab can
      // replace while this page is checking the account.
      const { data, error } = await client.auth.getUser(session.access_token);
      if (!active || version !== identity.current.generation) return;
      if (error) throw error;
      if (data.user?.id !== memberId || (boundUserId.current && boundUserId.current !== memberId)) return;
      boundUserId.current = memberId;
      setAuthorizedUserId(memberId);
      setMessage("");
    })().catch(() => {
      if (active) {
        setAuthorizedUserId(null);
        setCheckFailed(true);
        setMessage("We couldn’t verify your account. Please check your connection and try again.");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [checkAttempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    const memberId = authorizedUserId;
    if (!client || !memberId || busy || !mounted.current) return;
    const version = identity.current.generation;
    const stillCurrent = () => mounted.current && version === identity.current.generation && identity.current.id === memberId && boundUserId.current === memberId;
    setMessage("");
    if (password !== confirmation) { setMessage("Your passwords don’t match. Please enter the same password twice."); return; }
    setBusy(true);
    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (!stillCurrent()) return;
      if (error) throw error;
      if (!session || session.user.id !== memberId) throw new Error("Your account has changed.");
      await updatePasswordForSession(session, memberId, password, stillCurrent);
      if (!stillCurrent()) return;
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch (error) { if (stillCurrent()) setMessage(authErrorMessage(error, "We couldn’t update your password. Please try again or request a fresh reset link.")); }
    finally { if (stillCurrent()) setBusy(false); }
  }

  return (
    <AuthShell title={saved ? "Fresh start, sorted." : "Your next password."} intro={saved ? "Your password has been updated. You’re ready to keep moving." : "Choose a strong password that’s just for VANTAGE."}>
      {loading ? <p className={styles.loading} role="status">Checking your reset link…</p> : saved ? <><div className={styles.signedInIcon}><Check size={22} aria-hidden="true" /></div><Link className={styles.primaryButton} href="/workspace">Go to your workspace <ArrowUpRight size={18} aria-hidden="true" /></Link><Link className={`${styles.switch} ${styles.fullWidthLink}`} href="/account">Back to your profile</Link></> : authorizedUserId ? <form className={styles.form} onSubmit={submit} aria-busy={busy}><fieldset disabled={busy}><label htmlFor="new-password">New password<input id="new-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label htmlFor="confirm-password">Confirm new password<input id="confirm-password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className={styles.primaryButton} type="submit">{busy ? "Updating password…" : "Save new password"}<ArrowUpRight size={18} aria-hidden="true" /></button></fieldset></form> : <Link className={styles.primaryButton} href="/account?mode=recover">Request a reset link <ArrowUpRight size={18} aria-hidden="true" /></Link>}
      {message && <p className={`${styles.message} ${styles.errorMessage}`} role="alert">{message}</p>}
      {checkFailed && <button type="button" className={styles.secondaryButton} onClick={() => { setMessage(""); setCheckAttempt((value) => value + 1); }}><RefreshCw size={15} aria-hidden="true" /> Retry your connection</button>}
      {!saved && <Link className={`${styles.switch} ${styles.fullWidthLink}`} href="/account">Back to your account</Link>}
    </AuthShell>
  );
}
