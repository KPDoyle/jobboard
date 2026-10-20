import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LockKeyhole, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./account.module.css";

export default function AuthShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="VANTAGE home">
          <span className={styles.brandMark} aria-hidden="true">v<span>↗</span></span>
          <span>vantage<span className={styles.brandDot}>.</span></span>
        </Link>
        <Link href="/" className={styles.backLink}><ArrowLeft size={15} aria-hidden="true" /> Back to the good stuff</Link>
      </header>
      <div className={styles.grid}>
        <section className={styles.story} aria-labelledby="account-story-title">
          <span className={styles.eyebrow}><span /> AMBITION LOOKS GOOD ON YOU</span>
          <h1 id="account-story-title">Great careers.<br />Better<br /><span>connections.</span></h1>
          <p>Find your next big thing. Open a door for someone else. Make every connection count.</p>
          <div className={styles.sectors} aria-label="Our specialist sectors"><span>Legal</span><span>Technology</span><span>Finance</span></div>
          <div className={styles.illustration} aria-hidden="true">
            <div className={styles.orbit} />
            <div className={styles.connectionCard}>
              <div className={styles.cardIcon}><Sparkles size={20} /></div>
              <span>A little introduction.<br /><strong>A whole new direction.</strong></span>
              <ArrowUpRight size={23} />
            </div>
            <div className={styles.opportunityCard}>
              <div className={styles.cardHeader}><span>YOUR NEXT CHAPTER</span><ArrowUpRight size={19} /></div>
              <strong>Big moves.<br />Good energy.</strong>
              <div className={styles.cardFooter}><span className={styles.avatar}>V</span><span>Powered by your potential.</span></div>
            </div>
            <div className={styles.spark}>✳</div>
          </div>
          <div className={styles.storyFooter}><span>Talent. Meet possibility.</span><span>↗</span></div>
        </section>
        <section className={styles.formPanel} aria-labelledby="account-form-title">
          <div className={styles.formContent}>
            <span className={styles.formEyebrow}>YOUR NEXT MOVE STARTS HERE</span>
            <h2 id="account-form-title">{title}</h2>
            <p className={styles.formIntro}>{intro}</p>
            {children}
            <div className={styles.formNote}><LockKeyhole size={13} aria-hidden="true" /> A space for people going places.</div>
          </div>
        </section>
      </div>
      <footer className={styles.footer}><span>© {new Date().getFullYear()} VANTAGE</span><span>Good people. Great possibilities.</span></footer>
    </main>
  );
}
