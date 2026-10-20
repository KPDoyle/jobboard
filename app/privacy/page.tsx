import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { MarketplaceFooter, MarketplaceHeader } from "../jobs/marketplace-chrome";
import styles from "../marketplace.module.css";

export const metadata: Metadata = {
  title: "Your information & privacy | VANTAGE",
  description: "Understand what you share when you create an account, apply for an opportunity, or make a referral on VANTAGE.",
};

export default function PrivacyPage() {
  return <div className="site">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <MarketplaceHeader />
    <main id="main-content" className={styles.privacy}>
      <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" /> Back to VANTAGE</Link>
      <div className="eyebrow dark">YOUR INFORMATION. YOUR CHOICES.</div>
      <h1>A little clarity.<br />A better connection.</h1>
      <p className={styles.privacyIntro}>Here’s how information is used in the VANTAGE account, application and referral experience, and what you choose to share.</p>
      <section aria-labelledby="account-data-title">
        <h2 id="account-data-title">Your account and profile.</h2>
        <p>When you register, VANTAGE uses your email address and account credentials to provide secure sign-in. Your profile can include your name, account type, company, location, headline, website and biography. You can review and update your profile on your <Link href="/account">account page</Link>.</p>
        <p>Saved roles belong to your account. Your workspace also shows the applications, referral activity and reward records associated with you.</p>
      </section>
      <section aria-labelledby="application-data-title">
        <h2 id="application-data-title">When you apply for a role.</h2>
        <p>The employer responsible for the vacancy receives your application name, account email address, CV link and any cover note you submit. The employer can review that information and update your application’s progress. Applications are not public listings.</p>
        <p>Your CV remains at the document link you provide. Check that the employer can open it, and share only information you want considered for recruitment. Access controls on your external document are managed by that document’s hosting service.</p>
        <p>You confirm your agreement to share the application with the employer before submitting. You can follow its status and withdraw an application from <Link href="/workspace?tab=applications">My applications</Link>.</p>
      </section>
      <section aria-labelledby="referral-data-title">
        <h2 id="referral-data-title">Introductions start with your choice.</h2>
        <p>A referrer creates a personal link to a role and shares that link themselves. Creating the link does not submit someone else’s contact details or send an invitation on their behalf.</p>
        <p>If you apply through a referral link, you are asked to consent to sharing your name and application progress with the referrer. Your email address, CV link and cover note are available to the vacancy’s employer; the referral tracker does not show them to the referrer.</p>
        <p>You can choose “Apply without a referral instead” before submitting if you prefer to apply directly. Referral activity and any approved reward entries are associated with the relevant member accounts.</p>
      </section>
      <section aria-labelledby="access-data-title">
        <h2 id="access-data-title">Who can see what.</h2>
        <p>Published role information is public. Member records are protected by account and ownership checks: candidates can access their own applications, employers can access applications for their own roles, and referrers can access their own referral records.</p>
        <p>Authorised platform administrators have access to the records needed to moderate jobs, review eligible referral rewards and manage reward requests. Authentication and database services are provided through Supabase, and the website is hosted on Vercel.</p>
      </section>
      <section aria-labelledby="session-data-title">
        <h2 id="session-data-title">Your sign-in session.</h2>
        <p>VANTAGE stores the sign-in session in your browser so you can move between pages and return to your account. Your job applications, saved roles, referrals and reward records are stored in the connected database. Sign out from your <Link href="/account">account page</Link> when using a shared device.</p>
      </section>
      <div className={styles.bottomNav}><Link className={`primary-button ${styles.actionLink}`} href="/account">Manage my profile <ArrowUpRight size={18} aria-hidden="true" /></Link><Link className={styles.secondary} href="/workspace?tab=applications">View my applications</Link></div>
    </main>
    <MarketplaceFooter />
  </div>;
}
