"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import styles from "../marketplace.module.css";

const navigation = [
  { label: "Discover", href: "/#positions" },
  { label: "Rewards", href: "/workspace?tab=rewards" },
  { label: "Referrals", href: "/workspace?tab=referrals" },
  { label: "Employer", href: "/workspace?tab=employer" },
];

export function Brand() {
  return <><span className="brand-mark" aria-hidden="true">v<span>↗</span></span><span>vantage<span className="brand-dot">.</span></span></>;
}

export function MarketplaceHeader({ signedIn }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [sessionSignedIn, setSessionSignedIn] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);
  const loggedIn = signedIn ?? sessionSignedIn;

  useEffect(() => {
    if (signedIn !== undefined || !supabase) return;
    let active = true;
    let authRevision = 0;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision += 1;
      if (active) setSessionSignedIn(Boolean(session?.user));
    });
    supabase.auth.getUser().then(({ data }) => { if (active && authRevision === 0) setSessionSignedIn(Boolean(data.user)); }).catch(() => {});
    return () => { active = false; subscription.unsubscribe(); };
  }, [signedIn]);

  useEffect(() => {
    if (mobile) nav.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [mobile]);

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="VANTAGE home"><Brand /></Link>
        <nav ref={nav} id="main-navigation" aria-label="Main navigation" className={`${mobile ? "nav open" : "nav"} ${styles.navigation}`} onKeyDown={(event) => { if (event.key === "Escape") { setMobile(false); menuButton.current?.focus(); } }}>
          {navigation.map(({ label, href }) => <Link key={label} href={href} aria-current={label === "Discover" && pathname === "/" ? "page" : undefined} onClick={() => setMobile(false)}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link href={loggedIn ? "/workspace" : "/account?next=%2Fworkspace"} className="account-header-link">{loggedIn ? "My workspace" : "Sign in"} <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link href="/workspace?tab=employer" className={`outline-button ${styles.actionLink} ${styles.employerLink}`}>For employers <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <button ref={menuButton} type="button" className="mobile-button" aria-label={mobile ? "Close navigation" : "Open navigation"} aria-expanded={mobile} aria-controls="main-navigation" onClick={() => setMobile(!mobile)}>{mobile ? <X size={23} /> : <Menu size={23} />}</button>
        </div>
      </div>
    </header>
  );
}

export function MarketplaceFooter() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div><Link href="/" className="brand footer-brand" aria-label="VANTAGE home"><Brand /></Link><h2>Go where<br /><em>you grow.</em> <ArrowUpRight size={38} aria-hidden="true" /></h2></div>
        <div><span>MAKE YOUR MOVE</span>{navigation.map(({ label, href }) => <Link key={label} href={href}>{label}</Link>)}<Link href="/account?next=%2Fworkspace">Member account ↗</Link></div>
        <div><span>FIND YOUR WORLD</span><p>Legal & Professional Services<br />Technology & AI<br />Finance & Investment</p><span className="footer-tag">AMBITION, CONNECTED.</span></div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} VANTAGE</span><Link href="/privacy">Your information & privacy</Link><span>Good people. Great possibilities.</span></div>
    </footer>
  );
}
