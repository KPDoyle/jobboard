"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import styles from "./account.module.css";

export default function Account() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    client.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user || null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result =
        mode === "register"
          ? await client.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin + "/account" },
            })
          : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setMessage(
        mode === "register"
          ? "Account requested. If email confirmation is enabled, follow the email link."
          : "Signed in successfully.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const client = supabase;
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setUser(null);
      setMessage("You have been signed out.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not sign you out. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="VANTAGE home">
          <span className={styles.brandMark} aria-hidden="true">
            v<span>↗</span>
          </span>
          <span>
            vantage<span className={styles.brandDot}>.</span>
          </span>
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" /> Back to the good stuff
        </Link>
      </header>

      <div className={styles.grid}>
        <section className={styles.story} aria-labelledby="account-story-title">
          <span className={styles.eyebrow}>
            <span /> AMBITION LOOKS GOOD ON YOU
          </span>
          <h1 id="account-story-title">
            Great careers.
            <br />
            Better
            <br />
            <span>connections.</span>
          </h1>
          <p>
            Find your next big thing. Open a door for someone else. Make every
            connection count.
          </p>
          <div className={styles.sectors} aria-label="Our specialist sectors">
            <span>Legal</span>
            <span>Technology</span>
            <span>Finance</span>
          </div>
          <div className={styles.illustration} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.connectionCard}>
              <div className={styles.cardIcon}>
                <Sparkles size={20} />
              </div>
              <span>
                A little introduction.
                <br />
                <strong>A whole new direction.</strong>
              </span>
              <ArrowUpRight size={23} />
            </div>
            <div className={styles.opportunityCard}>
              <div className={styles.cardHeader}>
                <span>YOUR NEXT CHAPTER</span>
                <ArrowUpRight size={19} />
              </div>
              <strong>
                Big moves.
                <br />
                Good energy.
              </strong>
              <div className={styles.cardFooter}>
                <span className={styles.avatar}>V</span>
                <span>Powered by your potential.</span>
              </div>
            </div>
            <div className={styles.spark}>✳</div>
          </div>
          <div className={styles.storyFooter}>
            <span>Talent. Meet possibility.</span>
            <span>↗</span>
          </div>
        </section>

        <section
          className={styles.formPanel}
          aria-labelledby="account-form-title"
        >
          <div className={styles.formContent}>
            <span className={styles.formEyebrow}>
              YOUR NEXT MOVE STARTS HERE
            </span>
            <h2 id="account-form-title">
              {user
                ? "You’re in."
                : mode === "register"
                  ? "Let’s go places."
                  : "Good to see you."}
            </h2>
            <p className={styles.formIntro}>
              {user
                ? "Your next opportunity is out there."
                : mode === "register"
                  ? "A new chapter starts with a connection."
                  : "Your ambition. Your network. Your VANTAGE."}
            </p>

            {!supabase && (
              <div className={styles.notice} role="status">
                <LockKeyhole size={19} aria-hidden="true" />
                <div>
                  <strong>Accounts are coming soon.</strong>
                  <p>
                    Secure sign-in and registration need the VANTAGE database to
                    be connected. You can still explore the browser-local
                    marketplace demo.
                  </p>
                </div>
              </div>
            )}

            {user ? (
              <div className={styles.signedIn}>
                <div className={styles.signedInIcon}>
                  <Check size={22} aria-hidden="true" />
                </div>
                <p>
                  Signed in as <strong>{user.email}</strong>
                </p>
                <Link className={styles.primaryButton} href="/">
                  Explore the marketplace{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
                <button
                  className={styles.switch}
                  type="button"
                  disabled={busy}
                  onClick={signOut}
                >
                  {busy ? "Signing out…" : "Sign out"}
                </button>
              </div>
            ) : (
              <>
                <form
                  className={styles.form}
                  onSubmit={submit}
                  aria-busy={busy}
                >
                  <fieldset disabled={!supabase || busy}>
                    <label htmlFor="account-email">
                      Email address
                      <input
                        id="account-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@yourcompany.com"
                      />
                    </label>
                    <label htmlFor="account-password">
                      Password
                      <input
                        id="account-password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                      />
                    </label>
                    <button className={styles.primaryButton} type="submit">
                      {busy
                        ? "One moment…"
                        : mode === "register"
                          ? "Create your account"
                          : "Let’s get you in"}
                      <ArrowUpRight size={19} aria-hidden="true" />
                    </button>
                  </fieldset>
                </form>
                <div className={styles.switchRow}>
                  <span>
                    {mode === "login"
                      ? "New around here?"
                      : "Already part of the network?"}
                  </span>
                  <button
                    className={styles.switch}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode(mode === "login" ? "register" : "login");
                      setMessage("");
                    }}
                  >
                    {mode === "login" ? "Join VANTAGE" : "Sign in"}{" "}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </>
            )}

            {message && (
              <p className={styles.message} role="status" aria-live="polite">
                {message}
              </p>
            )}
            <div className={styles.formNote}>
              <LockKeyhole size={13} aria-hidden="true" /> A space for people
              going places.
            </div>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} VANTAGE</span>
        <span>Good people. Great possibilities.</span>
      </footer>
    </main>
  );
}
