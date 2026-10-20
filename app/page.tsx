"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowUpRight, ArrowRight, Search, MapPin, BriefcaseBusiness, Bookmark, Scale, Code2, ChartNoAxesColumnIncreasing, Sparkles, SlidersHorizontal, X, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { listJobs, listSavedJobs, setJobSaved, type Job } from "../lib/platform";
import { MarketplaceHeader, MarketplaceFooter } from "./jobs/marketplace-chrome";
import styles from "./marketplace.module.css";

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

const sectors = [
  { name: "Legal", num: "01", desc: "Make your case. Shape what’s next.", detail: "Counsel · Corporate law · Governance", icon: Scale },
  { name: "Technology & AI", num: "02", desc: "Build the things that change things.", detail: "Engineering · AI · Cybersecurity", icon: Code2 },
  { name: "Finance", num: "03", desc: "Think ahead. Move markets.", detail: "Investment · Fintech · Risk", icon: ChartNoAxesColumnIncreasing },
];

export default function Page() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [remote, setRemote] = useState("Any workplace");
  const [savedOnly, setSavedOnly] = useState(false);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const identity = useRef<string | null>(null);
  const identityGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listJobs().then((data) => { if (active) setJobs(data); }).catch((cause) => {
      if (active) { setJobs([]); setError(cause instanceof Error ? cause.message : "We could not load the opportunities. Please try again."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let authRevision = 0;
    function acceptUser(nextUser: User | null) {
      if (!active) return;
      const nextId = nextUser?.id ?? null;
      if (identity.current !== nextId) {
        identity.current = nextId;
        identityGeneration.current += 1;
        setSaved([]);
        setSavedOnly(false);
        setSavedLoading(Boolean(nextUser));
        setBusyJob(null);
        setNotice("");
      }
      setUser(nextUser);
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
    if (!user) { setSaved([]); setSavedLoading(false); setSavedOnly(false); return; }
    let active = true;
    const generation = identityGeneration.current;
    const memberId = user.id;
    setSavedLoading(true);
    listSavedJobs().then((data) => { if (active && isCurrentIdentity(generation, memberId)) setSaved(data); }).catch(() => {
      if (active && isCurrentIdentity(generation, memberId)) setNotice("Your saved roles could not be loaded. Refresh the page to try again.");
    }).finally(() => { if (active && isCurrentIdentity(generation, memberId)) setSavedLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const filtered = useMemo(() => jobs.filter((job) =>
    (sector === "All sectors" || job.sector === sector) &&
    (remote === "Any workplace" || job.remote === remote) &&
    (!savedOnly || saved.includes(job.id)) &&
    [job.title, job.company, job.location, job.description].join(" ").toLowerCase().includes(query.trim().toLowerCase())
  ), [jobs, sector, remote, savedOnly, saved, query]);

  function isCurrentIdentity(generation: number, memberId: string) {
    return identityGeneration.current === generation && identity.current === memberId;
  }

  async function toggleSaved(job: Job) {
    if (!user) { router.push(`/account?next=${encodeURIComponent(`/jobs/${job.id}`)}`); return; }
    if (identity.current !== user.id) return;
    if (busyJob || savedLoading) return;
    const generation = identityGeneration.current;
    const memberId = user.id;
    const shouldSave = !saved.includes(job.id);
    setBusyJob(job.id);
    setNotice("");
    try {
      await setJobSaved(job.id, shouldSave, memberId);
      if (!isCurrentIdentity(generation, memberId)) return;
      setSaved((current) => shouldSave ? [...current, job.id] : current.filter((id) => id !== job.id));
      setNotice(shouldSave ? "Role saved to your workspace." : "Role removed from your saved list.");
    } catch (cause) { if (isCurrentIdentity(generation, memberId)) setNotice(cause instanceof Error ? cause.message : "We could not update your saved roles. Please try again."); }
    finally { if (isCurrentIdentity(generation, memberId)) setBusyJob(null); }
  }

  function resetFilters() { setQuery(""); setSector("All sectors"); setRemote("Any workplace"); setSavedOnly(false); }

  return <div className="site">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <MarketplaceHeader signedIn={Boolean(user)} />
    <main id="main-content">
            <section className="hero">
              <div className="hero-inner">
                <div className="hero-copy">
                  <div className="eyebrow">
                    <span className="live-dot" /> BIG AMBITION. BETTER
                    CONNECTIONS.
                  </div>
                  <h1>
                    Your next move.
                    <br />
                    <em>Make it matter.</em>
                  </h1>
                  <p>
                    Find a role that feels like you. Connect someone brilliant.
                    Turn your network into your next advantage.
                  </p>
                  <div className="hero-actions">
                    <button
                      className="primary-button"
                      onClick={() =>
                        document
                          .getElementById("positions")
                          ?.scrollIntoView({ behavior: scrollBehavior() })
                      }
                    >
                      Find your next role <ArrowUpRight size={20} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => router.push("/workspace?tab=referrals")}
                    >
                      Make an introduction <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="hero-sectors">
                    <span>FOR WHAT’S NEXT IN</span>
                    <div>
                      Legal <i /> Tech & AI <i /> Finance
                    </div>
                  </div>
                </div>
                <div className="hero-side">
                  <div className="visual-label">
                    <span>THE CONNECTION EFFECT</span>
                    <ArrowUpRight size={21} />
                  </div>
                  <div className="connection-art" aria-hidden="true">
                    <div className="connection-ring ring-one" />
                    <div className="connection-ring ring-two" />
                    <div className="connection-ring ring-three" />
                    <span className="art-star">✳</span>
                    <span className="art-dot" />
                  </div>
                  <div className="opportunity-float">
                    <span className="float-icon">
                      <BriefcaseBusiness size={21} />
                    </span>
                    <div>
                      <small>YOUR NEXT CHAPTER</small>
                      <strong>More possibility. More you.</strong>
                    </div>
                    <ArrowUpRight size={20} />
                  </div>
                  <div className="hero-card">
                    <div className="card-topline">
                      <span>THE CONNECTION EFFECT</span>
                      <Sparkles size={18} />
                    </div>
                    <div className="hero-card-title">
                      Good connections.
                      <br />
                      Great potential.
                    </div>
                    <div className="mini-split">
                      <div>
                        <small>A GOOD INTRODUCTION CAN</small>
                        <strong className={styles.heroRewardValue}>Open doors.</strong>
                      </div>
                      <span className="token-symbol" aria-hidden="true">
                        ✳
                      </span>
                    </div>
                    <p>Share a role. They choose their next move.</p>
                    <Link className={styles.heroRewardLink} href="/workspace?tab=referrals">
                      Make a connection <ArrowUpRight size={18} />
                    </Link>
                  </div>
                  <span className="hero-sticker">
                    YOUR
                    <br />
                    NEXT
                    <br />
                    <b>STARTS HERE ↗</b>
                  </span>
                </div>
              </div>
            </section>
            <div className="sector-ribbon">
              <span>CAREERS WITH DIRECTION</span>
              <span>
                LEGAL <i>↗</i> TECHNOLOGY & AI <i>↗</i> FINANCE <i>↗</i>
              </span>
              <span>CONNECTIONS WITH VALUE</span>
            </div>
            <section className="section sectors">
              <div className="section-head">
                <div>
                  <div className="eyebrow dark">01 / FIND YOUR SPACE</div>
                  <h2>
                    Big futures.
                    <br />
                    <em>Specialist worlds.</em>
                  </h2>
                </div>
                <p>
                  Three sectors. Endless ambition. Find opportunities where your
                  expertise can make a real difference.
                </p>
              </div>
              <div className="sector-grid">
                {sectors.map((s) => (
                  <button
                    key={s.name}
                    className="sector-card"
                    onClick={() => {
                      setSector(s.name);
                      setSavedOnly(false);
                      document
                        .getElementById("positions")
                        ?.scrollIntoView({ behavior: scrollBehavior() });
                    }}
                  >
                    <div className="sector-top">
                      <span>{s.num} /</span>
                      <s.icon size={34} strokeWidth={1.5} />
                      <ArrowUpRight className="sector-arrow" size={23} />
                    </div>
                    <h3 className="sector-title">{s.name}</h3>
                    <p>{s.desc}</p>
                    <small>{s.detail}</small>
                    <div className="sector-bottom">
                      <span>
                        {loading || error ? "—" : jobs.filter((j) => j.sector === s.name).length} live
                        opportunities
                      </span>
                      <ArrowRight size={19} />
                    </div>
                  </button>
                ))}
              </div>
            </section>

      <section id="positions" className="section opportunities" aria-labelledby="opportunities-title">
        <div className="section-head">
          <div><div className="eyebrow dark">02 / THE NEXT CHAPTER</div><h2 id="opportunities-title">Less scrolling.<br /><em>More possibility.</em></h2></div>
          <p>Explore specialist roles, see the salary, and find your next good connection.</p>
        </div>
        <div className="filterbar">
          <div className="search-input"><Search size={20} aria-hidden="true" /><input aria-label="Search opportunities" placeholder="Role, company, location or keyword" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={17} /></button>}</div>
          <select value={sector} onChange={(event) => setSector(event.target.value)} aria-label="Filter by sector">{["All sectors", "Legal", "Technology & AI", "Finance"].map((value) => <option key={value}>{value}</option>)}</select>
          <select value={remote} onChange={(event) => setRemote(event.target.value)} aria-label="Filter by workplace">{["Any workplace", "Remote", "Hybrid", "On-site"].map((value) => <option key={value}>{value}</option>)}</select>
          <button type="button" className={savedOnly ? "saved-filter active" : "saved-filter"} aria-pressed={savedOnly} onClick={() => { if (!user) router.push("/account?next=%2Fworkspace%3Ftab%3Dsaved"); else setSavedOnly(!savedOnly); }}><Bookmark size={17} aria-hidden="true" /> Saved{user ? ` (${saved.length})` : ""}</button>
        </div>
        <div className="results-line"><span className={styles.results} aria-live="polite"><SlidersHorizontal size={15} aria-hidden="true" />{loading ? "Finding opportunities…" : `${filtered.length} ${filtered.length === 1 ? "opportunity" : "opportunities"}`}</span><span>Live roles · Real connections</span></div>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {loading ? <div className={styles.status} role="status"><Search size={30} aria-hidden="true" /><h3>Good things are on the way.</h3><p>Loading the latest opportunities…</p></div> : error ? <div className={styles.status} role="alert"><AlertCircle size={30} aria-hidden="true" /><h3>Let’s try that again.</h3><p>{error}</p><button type="button" className="primary-button" onClick={() => setReload((value) => value + 1)}>Reload opportunities <ArrowRight size={17} aria-hidden="true" /></button></div> : filtered.length > 0 ?
          <ul className={styles.list}>
            {filtered.map((job) => <li key={job.id}><article className="job-card">
              <div className="company-icon" aria-hidden="true">{job.company.split(" ").map((word) => word[0]).slice(0, 2).join("")}</div>
              <div className="job-main"><div className="job-meta"><span className="sector-tag">{job.sector}</span><span>{job.type}</span></div><h3><Link className={styles.titleLink} href={`/jobs/${job.id}`}>{job.title}</Link></h3><div className="company-name">{job.company}</div><p className="job-description">{job.description.length > 180 ? `${job.description.slice(0, 180).trimEnd()}…` : job.description}</p><div className="job-facts"><span><MapPin size={15} aria-hidden="true" />{job.location} · {job.remote}</span><span><BriefcaseBusiness size={15} aria-hidden="true" />{job.salary}</span></div></div>
              <div className="job-reward">{job.referral_tokens > 0 ? <><span>VERIFIED HIRE REWARD</span><strong>✳ {job.referral_tokens.toLocaleString()}</strong><small>VANTAGE TOKENS · SUBJECT TO APPROVAL</small></> : <><span>YOUR NEXT OPPORTUNITY</span><strong><ArrowUpRight size={32} aria-hidden="true" /></strong><small>FIND YOUR NEXT GOOD MOVE</small></>}
                <div className="job-cta"><Link href={`/jobs/${job.id}`} className={styles.jobActionLink}>View role <ArrowUpRight size={16} aria-hidden="true" /></Link><button type="button" className={styles.saveButton} aria-label={`${saved.includes(job.id) ? "Unsave" : "Save"} ${job.title}`} aria-pressed={saved.includes(job.id)} disabled={Boolean(busyJob) || savedLoading} onClick={() => toggleSaved(job)}><Bookmark size={17} fill={saved.includes(job.id) ? "currentColor" : "none"} aria-hidden="true" /></button></div>
                <Link className={`apply-link ${styles.actionLink}`} href={`/jobs/${job.id}#apply`}>Apply for this role <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
            </article></li>)}
          </ul> : <div className={styles.status}><Search size={30} aria-hidden="true" /><h3>{jobs.length === 0 ? "Your next chapter is taking shape." : savedOnly ? "Make space for your favourites." : "A fresh start?"}</h3><p>{jobs.length === 0 ? "There are no published opportunities yet. Employers can create and submit their first role for review from the workspace." : savedOnly ? "No saved roles match your filters. Explore the opportunities and bookmark a role to keep it here." : "No roles match these filters. Try another sector, workplace or keyword."}</p>{jobs.length === 0 ? <Link className={`primary-button ${styles.actionLink}`} href="/workspace?tab=employer">Post an opportunity <ArrowUpRight size={17} aria-hidden="true" /></Link> : <button type="button" className="primary-button" onClick={resetFilters}>Explore all roles <ArrowRight size={17} aria-hidden="true" /></button>}</div>}
      </section>
            <section className="reward-banner">
              <div className="banner-inner">
                <div className="eyebrow">YOUR NETWORK IS YOUR SUPERPOWER</div>
                <h2>
                  Know someone
                  <br />
                  <em>who’d be brilliant?</em>
                </h2>
                <p>
                  Make the connection. Help them move forward. Explore rewards
                  that could move you forward, too.
                </p>
                <button
                  className="primary-button"
                  onClick={() => router.push("/workspace?tab=rewards")}
                >
                  Meet VANTAGE Rewards <ArrowUpRight size={18} />
                </button>
                <div className="banner-glyph" aria-hidden="true">
                  ✳
                </div>
                <span className="banner-caption">
                  CONNECT. GROW. REPEAT. ↗
                </span>
              </div>
            </section>
            <section className="section three-steps">
              <div className="eyebrow dark">
                03 / SMALL INTRODUCTION. BIG POSSIBILITIES.
              </div>
              <h2>
                Make a move.
                <br />
                <em>Start a ripple.</em>
              </h2>
              <div className="steps-grid">
                {[
                  [
                    "01",
                    "Find your thing",
                    "Discover a specialist role for you, or spot the perfect fit for someone you know.",
                  ],
                  [
                    "02",
                    "Connect the dots",
                    "Share your personal referral link. Your connection chooses whether to apply and share their progress.",
                  ],
                  [
                    "03",
                    "Grow from it",
                    "Follow your applications and introductions in one place. Rewards are recorded after a verified hire.",
                  ],
                ].map((x) => (
                  <div key={x[0]}>
                    <span>
                      {x[0]} <ArrowUpRight size={23} />
                    </span>
                    <h3>{x[1]}</h3>
                    <p>{x[2]}</p>
                  </div>
                ))}
              </div>
            </section>
    </main>
    <MarketplaceFooter />
  </div>;
}
