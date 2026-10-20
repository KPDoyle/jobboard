"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { ArrowUpRight } from "lucide-react";
import { authErrorMessage, safeNextPath, supabase } from "../../../lib/supabase";
import AuthShell from "../../account/auth-shell";
import styles from "../../account/account.module.css";

const emailTypes = new Set(["email", "signup", "recovery", "invite", "magiclink", "email_change"]);

export default function AuthCallback() {
  const router = useRouter();
  const operation = useRef<Promise<string> | null>(null);
  const [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    if (!operation.current) {
      operation.current = (async () => {
        const url = new URL(window.location.href);
        const fragment = new URLSearchParams(url.hash.slice(1));
        const type = url.searchParams.get("type") ?? fragment.get("type");
        const isRecovery = type === "recovery" || url.searchParams.get("recovery") === "1";
        setRecovery(isRecovery);
        const linkError = url.searchParams.get("error_code") ?? fragment.get("error_code");
        if (url.searchParams.has("error") || fragment.has("error") || linkError) {
          throw new Error(authErrorMessage({ code: linkError }, "This email link couldn’t be verified. Please request a new link and try again."));
        }
        const client = supabase;
        if (!client) throw new Error("Sign-in is temporarily unavailable. Please reload this page and try again.");
        const tokenHash = url.searchParams.get("token_hash");
        if (tokenHash) {
          if (!type || !emailTypes.has(type)) throw new Error("This email link isn’t valid. Please request a new link.");
          const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
          if (error) throw new Error(authErrorMessage(error, "This email link couldn’t be verified. Please request a new link and try again."));
        }
        // getSession waits for the browser client to finish processing the email
        // link fragment and persist the resulting session before navigating.
        const { data: { session }, error } = await client.auth.getSession();
        if (error) throw new Error(authErrorMessage(error, "This email link couldn’t be verified. Please request a new link and try again."));
        if (!session) throw new Error("This email link has expired or has already been used. Please request a new one.");
        const { data: { user }, error: userError } = await client.auth.getUser(session.access_token);
        if (userError || user?.id !== session.user.id) throw new Error("Your sign-in couldn’t be verified. Please request a new email link.");
        const { data: { session: currentSession } } = await client.auth.getSession();
        if (currentSession?.user.id !== session.user.id) throw new Error("Your account has changed. Please reopen your email link.");
        return isRecovery ? "/account/reset-password" : safeNextPath(url.searchParams.get("next"));
      })();
    }
    operation.current.then((destination) => {
      if (active) {
        window.history.replaceState({}, "", window.location.pathname);
        router.replace(destination);
      }
    }).catch((error: unknown) => {
      if (!active) return;
      // Remove credentials and one-use tokens from the address bar on failure.
      window.history.replaceState({}, "", window.location.pathname);
      setMessage(error instanceof Error ? error.message : "We couldn’t verify this link. Please request a new one.");
    });
    return () => { active = false; };
  }, [router]);

  return (
    <AuthShell title={message ? "Let’s try that again." : "Making the connection."} intro={message ? "A fresh email link will get you moving again." : "We’re securely checking your email link."}>
      {message ? <><p className={`${styles.message} ${styles.errorMessage}`} role="alert">{message}</p><Link className={styles.primaryButton} href={recovery ? "/account?mode=recover" : "/account?confirm=1"}>Request a new link <ArrowUpRight size={18} aria-hidden="true" /></Link><Link className={`${styles.switch} ${styles.fullWidthLink}`} href="/account">Back to sign in</Link></> : <p className={styles.loading} role="status" aria-live="polite">Confirming your account…</p>}
    </AuthShell>
  );
}
