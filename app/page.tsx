"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  MapPin,
  BriefcaseBusiness,
  Bookmark,
  Gift,
  Plus,
  CheckCircle2,
  UserRound,
  Scale,
  Code2,
  ChartNoAxesColumnIncreasing,
  Sparkles,
  SlidersHorizontal,
  Wallet,
  Users,
  X,
  Menu,
} from "lucide-react";
type Job = {
  id: number;
  title: string;
  company: string;
  sector: string;
  location: string;
  salary: string;
  type: string;
  remote: string;
  tokens: number;
  description: string;
  featured?: boolean;
};
type Referral = {
  id: number;
  jobId: number;
  name: string;
  email: string;
  status: string;
  created: string;
};
const initial: Job[] = [
  {
    id: 1,
    title: "Chief Technology Officer",
    company: "Northbridge Capital",
    sector: "Technology & AI",
    location: "London",
    salary: "£180k–£240k",
    type: "Executive",
    remote: "Hybrid",
    tokens: 10000,
    featured: true,
    description:
      "Lead technology strategy, AI transformation and engineering for a sophisticated investment group.",
  },
  {
    id: 2,
    title: "General Counsel",
    company: "Ashford Partners",
    sector: "Legal",
    location: "London",
    salary: "£160k–£200k",
    type: "Permanent",
    remote: "Hybrid",
    tokens: 8500,
    featured: true,
    description:
      "Shape legal strategy, governance and complex transactions at a premium professional services firm.",
  },
  {
    id: 3,
    title: "Managing Director, Private Equity",
    company: "Meridian Advisory",
    sector: "Finance",
    location: "London",
    salary: "£200k+",
    type: "Executive",
    remote: "On-site",
    tokens: 12000,
    description:
      "Lead investments, portfolio growth and strategic partnerships for a specialist PE platform.",
  },
  {
    id: 4,
    title: "Head of Cybersecurity",
    company: "Vertex Systems",
    sector: "Technology & AI",
    location: "Manchester",
    salary: "£120k–£150k",
    type: "Permanent",
    remote: "Hybrid",
    tokens: 6000,
    description:
      "Own cybersecurity architecture, assurance and enterprise resilience.",
  },
  {
    id: 5,
    title: "Senior Corporate Lawyer",
    company: "Sterling Legal",
    sector: "Legal",
    location: "Birmingham",
    salary: "£95k–£125k",
    type: "Permanent",
    remote: "Hybrid",
    tokens: 4500,
    description:
      "Advise on complex M&A, commercial transactions and strategic matters.",
  },
  {
    id: 6,
    title: "Director of Risk & Compliance",
    company: "Atlas Financial",
    sector: "Finance",
    location: "London",
    salary: "£130k–£170k",
    type: "Permanent",
    remote: "Hybrid",
    tokens: 7000,
    description:
      "Build an enterprise risk and compliance function in a regulated financial institution.",
  },
];
const seedRewards = [
  {
    title: "Executive Leadership Programme",
    category: "Education",
    tokens: 8500,
    icon: "✦",
  },
  {
    title: "AI & Machine Learning Certificate",
    category: "Technology",
    tokens: 4500,
    icon: "◈",
  },
  {
    title: "Legal CPD Learning Credit",
    category: "Professional development",
    tokens: 2500,
    icon: "§",
  },
  {
    title: "Financial Markets Masterclass",
    category: "Finance",
    tokens: 3500,
    icon: "◇",
  },
  {
    title: "Professional Membership Credit",
    category: "Career",
    tokens: 3000,
    icon: "◎",
  },
  { title: "Charitable Donation", category: "Giving", tokens: 1000, icon: "♡" },
];
type Application = {
  jobId: number;
  name: string;
  email: string;
  created: string;
};
const navigation = ["Discover", "Rewards", "Referrals", "Employer"];
const storageValidators = {
  jobs: (value: unknown): value is Job[] =>
    Array.isArray(value) &&
    value.every(
      (j) =>
        j &&
        typeof j.id === "number" &&
        [
          "title",
          "company",
          "sector",
          "location",
          "salary",
          "type",
          "remote",
          "description",
        ].every((k) => typeof j[k] === "string") &&
        Number.isFinite(j.tokens),
    ),
  referrals: (value: unknown): value is Referral[] =>
    Array.isArray(value) &&
    value.every(
      (r) =>
        r &&
        typeof r.id === "number" &&
        typeof r.jobId === "number" &&
        ["name", "email", "status", "created"].every(
          (k) => typeof r[k] === "string",
        ),
    ),
  applications: (value: unknown): value is Application[] =>
    Array.isArray(value) &&
    value.every(
      (a) =>
        a &&
        typeof a.jobId === "number" &&
        ["name", "email", "created"].every((k) => typeof a[k] === "string"),
    ),
  saved: (value: unknown): value is number[] =>
    Array.isArray(value) && value.every(Number.isFinite),
  balance: (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0,
  redemptions: (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((r) => typeof r === "string"),
};
function read<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (validate(value)) return value;
    }
  } catch {}
  return fallback;
}
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}
function Brand() {
  return (
    <>
      <span className="brand-mark" aria-hidden="true">
        v<span>↗</span>
      </span>
      <span>
        vantage<span className="brand-dot">.</span>
      </span>
    </>
  );
}

export default function Page() {
  const [tab, setTab] = useState("Discover");
  const [jobs, setJobs] = useState<Job[]>(initial);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [balance, setBalance] = useState(0);
  const [redemptions, setRedemptions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [savedOnly, setSavedOnly] = useState(false);
  const [active, setActive] = useState<Job | null>(null);
  const [modal, setModal] = useState<"apply" | "refer" | "post" | null>(null);
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    company: "",
    sector: "Technology & AI",
    location: "London",
    salary: "",
    tokens: "5000",
    description: "",
  });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setJobs(read("vantage_jobs", initial, storageValidators.jobs));
    setReferrals(read("vantage_referrals", [], storageValidators.referrals));
    setApplications(
      read("vantage_applications", [], storageValidators.applications),
    );
    setSaved(read("vantage_saved", [], storageValidators.saved));
    setBalance(read("vantage_balance", 0, storageValidators.balance));
    setRedemptions(
      read("vantage_redemptions", [], storageValidators.redemptions),
    );
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      for (const [key, value] of Object.entries({
        jobs,
        referrals,
        applications,
        saved,
        balance,
        redemptions,
      }))
        localStorage.setItem(`vantage_${key}`, JSON.stringify(value));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [loaded, jobs, referrals, applications, saved, balance, redemptions]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!modal || !dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [modal]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const filtered = useMemo(
    () =>
      jobs.filter(
        (j) =>
          (sector === "All sectors" || j.sector === sector) &&
          (!savedOnly || saved.includes(j.id)) &&
          [j.title, j.company, j.location, j.description]
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [jobs, sector, query, savedOnly, saved],
  );
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  };
  const nav = (next: string) => {
    setTab(next);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  };
  const start = (job: Job, mode: "apply" | "refer") => {
    setToast("");
    setActive(job);
    setForm((f) => ({ ...f, name: "", email: "" }));
    setModal(mode);
  };
  const submitPerson = () => {
    if (
      !active ||
      !form.name.trim() ||
      !/^\S+@\S+\.\S+$/.test(form.email.trim())
    ) {
      notify("Enter a name and valid email address");
      return;
    }
    const name = form.name.trim(),
      email = form.email.trim();
    if (modal === "refer") {
      if (
        referrals.some(
          (r) =>
            r.jobId === active.id &&
            r.email.toLowerCase() === email.toLowerCase(),
        )
      ) {
        notify("That person has already been referred for this role");
        return;
      }
      setReferrals((r) => [
        {
          id: Date.now(),
          jobId: active.id,
          name,
          email,
          status: "Awaiting consent",
          created: new Date().toLocaleDateString("en-GB"),
        },
        ...r,
      ]);
      notify("Demo referral saved on this device. No email was sent.");
    } else {
      setApplications((a) => [
        {
          jobId: active.id,
          name,
          email,
          created: new Date().toLocaleDateString("en-GB"),
        },
        ...a,
      ]);
      notify("Application saved in this demo browser.");
    }
    setModal(null);
  };
  const post = () => {
    if (
      !form.title.trim() ||
      !form.company.trim() ||
      !form.description.trim()
    ) {
      notify("Complete title, company and description");
      return;
    }
    const tokens = Number(form.tokens);
    if (!Number.isFinite(tokens) || tokens < 0) {
      notify("Enter a valid non-negative token amount");
      return;
    }
    setJobs((j) => [
      {
        id: Date.now(),
        title: form.title.trim(),
        company: form.company.trim(),
        sector: form.sector,
        location: form.location.trim() || "Location flexible",
        salary: form.salary.trim() || "Competitive",
        type: "Permanent",
        remote: "Hybrid",
        tokens: Math.floor(tokens),
        description: form.description.trim(),
      },
      ...j,
    ]);
    setModal(null);
    nav("Employer");
    notify("Job published in this demo browser.");
  };
  const redeem = (title: string, cost: number) => {
    if (balance < cost) {
      notify("Not enough earned tokens to redeem this reward");
      return;
    }
    setBalance((b) => b - cost);
    setRedemptions((r) => [title, ...r]);
    notify("Demo redemption recorded. No reward fulfilment was requested.");
  };
  const sectors = [
    {
      name: "Legal",
      num: "01",
      desc: "Make your case. Shape what’s next.",
      detail: "Counsel · Corporate law · Governance",
      icon: Scale,
    },
    {
      name: "Technology & AI",
      num: "02",
      desc: "Build the things that change things.",
      detail: "Engineering · AI · Cybersecurity",
      icon: Code2,
    },
    {
      name: "Finance",
      num: "03",
      desc: "Think ahead. Move markets.",
      detail: "Investment · Fintech · Risk",
      icon: ChartNoAxesColumnIncreasing,
    },
  ];
  return (
    <div className="site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => nav("Discover")}
            aria-label="Vantage home"
          >
            <Brand />
          </button>
          <nav
            id="main-navigation"
            aria-label="Main navigation"
            className={mobile ? "nav open" : "nav"}
          >
            {navigation.map((n) => (
              <button
                aria-current={tab === n ? "page" : undefined}
                className={tab === n ? "selected" : ""}
                key={n}
                onClick={() => nav(n)}
              >
                {n}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <Link href="/account" className="account-header-link">
              Sign in <ArrowUpRight size={15} />
            </Link>
            <button className="outline-button" onClick={() => nav("Employer")}>
              For employers <ArrowUpRight size={16} />
            </button>
            <button
              className="mobile-button"
              aria-label={mobile ? "Close navigation" : "Open navigation"}
              aria-expanded={mobile}
              aria-controls="main-navigation"
              onClick={() => setMobile((m) => !m)}
            >
              {mobile ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
      </header>
      <div className="demo-bar">
        <span className="demo-dot" />
        <strong>Explore the demo</strong>
        <span>
          Sample roles & rewards. Activity stays in this browser; no emails are
          sent.
        </span>
      </div>
      {storageError && (
        <div className="storage-notice" role="alert">
          Browser storage is unavailable. Your changes will only last while this
          page is open.
        </div>
      )}
      <main id="main-content">
        {tab === "Discover" && (
          <>
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
                      onClick={() => nav("Referrals")}
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
                      <span>VANTAGE REWARDS</span>
                      <Sparkles size={18} />
                    </div>
                    <div className="hero-card-title">
                      Good connections.
                      <br />
                      Great potential.
                    </div>
                    <div className="mini-split">
                      <div>
                        <small>ILLUSTRATIVE REWARD · UP TO</small>
                        <strong>
                          12,000 <span>tokens</span>
                        </strong>
                      </div>
                      <span className="token-symbol" aria-hidden="true">
                        ✳
                      </span>
                    </div>
                    <p>For an eligible, verified successful introduction.</p>
                    <button onClick={() => nav("Rewards")}>
                      See what you could unlock <ArrowUpRight size={18} />
                    </button>
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
                        {jobs.filter((j) => j.sector === s.name).length} sample
                        opportunities
                      </span>
                      <ArrowRight size={19} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section id="positions" className="section opportunities">
              <div className="section-head">
                <div>
                  <div className="eyebrow dark">02 / THE NEXT CHAPTER</div>
                  <h2>
                    Less scrolling.
                    <br />
                    <em>More possibility.</em>
                  </h2>
                </div>
                <p>
                  Explore specialist roles, see the salary, and discover what a
                  great introduction could earn.
                </p>
              </div>
              <div className="filterbar">
                <div className="search-input">
                  <Search size={20} />
                  <input
                    aria-label="Search opportunities"
                    placeholder="Role, company, location or keyword"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  aria-label="Filter by sector"
                >
                  {["All sectors", "Legal", "Technology & AI", "Finance"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
                <button
                  className={savedOnly ? "saved-filter active" : "saved-filter"}
                  aria-pressed={savedOnly}
                  onClick={() => setSavedOnly((v) => !v)}
                >
                  <Bookmark size={17} /> Saved ({saved.length})
                </button>
              </div>
              <div className="results-line">
                <span aria-live="polite">
                  <SlidersHorizontal size={15} /> {filtered.length}{" "}
                  {filtered.length === 1 ? "opportunity" : "opportunities"}
                </span>
                <span>Sample vacancies · Illustrative rewards</span>
              </div>
              <div className="job-list">
                {filtered.map((j) => (
                  <article className="job-card" key={j.id}>
                    <div className="company-icon" aria-hidden="true">
                      {j.company
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="job-main">
                      <div className="job-meta">
                        <span className="sector-tag">{j.sector}</span>
                        <span>{j.type}</span>
                        {j.featured && (
                          <span className="featured">
                            <Sparkles size={11} /> Featured
                          </span>
                        )}
                      </div>
                      <h3>{j.title}</h3>
                      <div className="company-name">{j.company}</div>
                      <p className="job-description">{j.description}</p>
                      <div className="job-facts">
                        <span>
                          <MapPin size={15} />
                          {j.location} · {j.remote}
                        </span>
                        <span>
                          <BriefcaseBusiness size={15} />
                          {j.salary}
                        </span>
                      </div>
                    </div>
                    <div className="job-reward">
                      <span>REFERRAL POTENTIAL</span>
                      <strong>✳ {j.tokens.toLocaleString()}</strong>
                      <small>VANTAGE TOKENS</small>
                      <div className="job-cta">
                        <button onClick={() => start(j, "refer")}>
                          Refer someone <ArrowUpRight size={16} />
                        </button>
                        <button
                          title={
                            saved.includes(j.id) ? "Unsave job" : "Save job"
                          }
                          aria-label={`${saved.includes(j.id) ? "Unsave" : "Save"} ${j.title}`}
                          aria-pressed={saved.includes(j.id)}
                          onClick={() =>
                            setSaved((s) =>
                              s.includes(j.id)
                                ? s.filter((i) => i !== j.id)
                                : [...s, j.id],
                            )
                          }
                        >
                          <Bookmark
                            size={17}
                            fill={
                              saved.includes(j.id) ? "currentColor" : "none"
                            }
                          />
                        </button>
                      </div>
                      <button
                        className="apply-link"
                        onClick={() => start(j, "apply")}
                      >
                        Apply for this role <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                ))}
                {filtered.length === 0 && (
                  <div className="empty">
                    <Search size={29} />
                    <h3>A fresh start?</h3>
                    <p>No roles match these filters.</p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery("");
                        setSector("All sectors");
                        setSavedOnly(false);
                      }}
                    >
                      Reset filters <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>
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
                  onClick={() => nav("Rewards")}
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
                    "Introduce someone with their permission. Follow the progress of your connection.",
                  ],
                  [
                    "03",
                    "Grow from it",
                    "Eligible, verified hires could earn tokens for learning, development and career rewards.",
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
          </>
        )}
        {tab === "Rewards" && (
          <>
            <section className="interior-hero">
              <div className="eyebrow">
                VANTAGE REWARDS / YOUR GROWTH, REIMAGINED
              </div>
              <h1>
                Good connections.
                <br />
                <em>Great next steps.</em>
              </h1>
              <p>
                Explore how meaningful introductions could open up new skills,
                fresh thinking and your next advantage.
              </p>
              <Gift
                className="interior-icon"
                size={175}
                strokeWidth={1}
                aria-hidden="true"
              />
            </section>
            <section className="section">
              <div className="wallet-grid">
                <div className="wallet-card">
                  <div className="card-topline">
                    <span>YOUR DEMO WALLET</span>
                    <Wallet size={24} />
                  </div>
                  <div className="wallet-amount">
                    ✳ {balance.toLocaleString()}
                  </div>
                  <p>Demo tokens available</p>
                  <small>
                    Live token awards require verified eligibility and approval.
                  </small>
                </div>
                <div className="wallet-note">
                  <div className="eyebrow dark">AN INVESTMENT IN YOU</div>
                  <h3>
                    Turn who you know
                    <br />
                    into what you know.
                  </h3>
                  <p>
                    These rewards and token values are illustrative. Partners,
                    redemption terms and fulfilment are not yet live.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => nav("Referrals")}
                  >
                    View my referrals <ArrowRight size={17} />
                  </button>
                </div>
              </div>
              <div className="section-head catalog-head">
                <div>
                  <div className="eyebrow dark">THE REWARDS EDIT</div>
                  <h2>
                    Fuel your
                    <br />
                    <em>next chapter.</em>
                  </h2>
                </div>
              </div>
              <div className="reward-grid">
                {seedRewards.map((r, i) => (
                  <div key={r.title} className={`reward-product reward-${i}`}>
                    <div className="reward-art" aria-hidden="true">
                      <span>{r.icon}</span>
                      <small>THE GROWTH SERIES / 0{i + 1}</small>
                      <div>vantage.</div>
                    </div>
                    <div className="reward-details">
                      <small>{r.category}</small>
                      <h3>{r.title}</h3>
                      <div>
                        <strong>✳ {r.tokens.toLocaleString()} TOKENS</strong>
                        <button onClick={() => redeem(r.title, r.tokens)}>
                          Redeem <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {redemptions.length > 0 && (
                <p className="history">
                  Demo redemptions: {redemptions.join(", ")}
                </p>
              )}
            </section>
          </>
        )}
        {tab === "Referrals" && (
          <>
            <section className="interior-hero">
              <div className="eyebrow">
                YOUR NETWORK / THE CONNECTION EFFECT
              </div>
              <h1>
                Make an introduction.
                <br />
                <em>Start something good.</em>
              </h1>
              <p>
                Follow your connections from first introduction to potential
                reward. Every good connection starts with consent.
              </p>
              <Users
                className="interior-icon"
                size={175}
                strokeWidth={1}
                aria-hidden="true"
              />
            </section>
            <section className="section dashboard">
              <div className="dashboard-top">
                <div>
                  <div className="eyebrow dark">YOUR REFERRAL SPACE · DEMO</div>
                  <h2>Your connections</h2>
                </div>
                <button
                  className="primary-button"
                  onClick={() => nav("Discover")}
                >
                  Find a role to refer <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="metric-grid">
                <div>
                  <Users />
                  <strong>{referrals.length}</strong>
                  <span>Total introductions</span>
                </div>
                <div>
                  <CheckCircle2 />
                  <strong>
                    {
                      referrals.filter((r) => r.status === "Reward approved")
                        .length
                    }
                  </strong>
                  <span>Approved rewards</span>
                </div>
                <div>
                  <Wallet />
                  <strong>{balance.toLocaleString()}</strong>
                  <span>Available demo tokens</span>
                </div>
              </div>
              <div className="panel">
                <h3>Referral activity</h3>
                {referrals.length === 0 ? (
                  <div className="empty">
                    <Users size={31} />
                    <h3>Your first connection starts here.</h3>
                    <p>
                      Explore roles and recommend someone brilliant from your
                      network.
                    </p>
                  </div>
                ) : (
                  <div className="records">
                    {referrals.map((r) => (
                      <div key={r.id}>
                        <div>
                          <strong>{r.name}</strong>
                          <small>
                            {jobs.find((j) => j.id === r.jobId)?.title ||
                              "Archived role"}{" "}
                            · {r.created}
                          </small>
                        </div>
                        <span className="status">{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="note">
                  Demo referrals stay pending. Live rewards require candidate
                  consent, a verified hire, employer approval and a qualifying
                  period. No invitations are sent in this demo.
                </p>
              </div>
            </section>
          </>
        )}
        {tab === "Employer" && (
          <>
            <section className="interior-hero">
              <div className="eyebrow">FOR EMPLOYERS / BUILD WHAT’S NEXT</div>
              <h1>
                Great teams.
                <br />
                <em>Start with a connection.</em>
              </h1>
              <p>
                Showcase your opportunities, manage hiring activity and put the
                power of professional networks to work.
              </p>
              <BriefcaseBusiness
                className="interior-icon"
                size={175}
                strokeWidth={1}
                aria-hidden="true"
              />
            </section>
            <section className="section dashboard">
              <div className="dashboard-top">
                <div>
                  <div className="eyebrow dark">EMPLOYER WORKSPACE · DEMO</div>
                  <h2>Your hiring, in view.</h2>
                </div>
                <button
                  className="primary-button"
                  onClick={() => {
                    setToast("");
                    setForm((f) => ({
                      ...f,
                      title: "",
                      company: "",
                      description: "",
                    }));
                    setModal("post");
                  }}
                >
                  <Plus size={17} /> Post an opportunity
                </button>
              </div>
              <div className="metric-grid">
                <div>
                  <BriefcaseBusiness />
                  <strong>{jobs.length}</strong>
                  <span>Listed demo positions</span>
                </div>
                <div>
                  <UserRound />
                  <strong>{applications.length}</strong>
                  <span>Demo applications</span>
                </div>
                <div>
                  <Gift />
                  <strong>{referrals.length}</strong>
                  <span>Introductions</span>
                </div>
              </div>
              <div className="panel">
                <h3>Manage opportunities</h3>
                <div className="records">
                  {jobs.map((j) => (
                    <div key={j.id}>
                      <div>
                        <strong>{j.title}</strong>
                        <small>
                          {j.company} · {j.location} · ✳{" "}
                          {j.tokens.toLocaleString()} referral tokens
                        </small>
                      </div>
                      <div className="record-actions">
                        <span className="status">LIVE IN DEMO</span>
                        <button
                          aria-label={`Remove ${j.title}`}
                          onClick={() => {
                            if (confirm("Remove this demo job posting?")) {
                              setJobs((a) => a.filter((x) => x.id !== j.id));
                              setSaved((a) => a.filter((id) => id !== j.id));
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {applications.length > 0 && (
                <div className="panel">
                  <h3>Candidate applications</h3>
                  <div className="records">
                    {applications.map((a, i) => (
                      <div key={`${a.created}-${i}`}>
                        <div>
                          <strong>{a.name}</strong>
                          <small>
                            {a.email} ·{" "}
                            {jobs.find((j) => j.id === a.jobId)?.title ||
                              "Archived role"}{" "}
                            · {a.created}
                          </small>
                        </div>
                        <span className="status">Received in demo</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="note">
                This workspace stores demo activity in this browser. Secure
                employer accounts, shared data, moderation, messaging and
                verified rewards require backend integration.
              </p>
            </section>
          </>
        )}
      </main>
      <footer className="footer">
        <div className="footer-top">
          <div>
            <button
              className="brand footer-brand"
              onClick={() => nav("Discover")}
              aria-label="Vantage home"
            >
              <Brand />
            </button>
            <h2>
              Go where
              <br />
              <em>you grow.</em> <ArrowUpRight size={38} />
            </h2>
          </div>
          <div>
            <span>MAKE YOUR MOVE</span>
            {navigation.map((n) => (
              <button key={n} onClick={() => nav(n)}>
                {n}
              </button>
            ))}
            <Link href="/account">Member sign in ↗</Link>
          </div>
          <div>
            <span>FIND YOUR WORLD</span>
            <p>
              Legal & Professional Services
              <br />
              Technology & AI
              <br />
              Finance & Investment
            </p>
            <span className="footer-tag">AMBITION, CONNECTED.</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} VANTAGE · Brand concept subject to
            clearance
          </span>
          <span>DEMO ONLY · NO REAL JOBS, REWARDS OR EMAILS</span>
        </div>
      </footer>
      {modal && (
        <dialog
          ref={dialogRef}
          className="modal-dialog"
          aria-labelledby="modal-title"
          onCancel={() => setModal(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className="modal">
            <button
              className="close"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X size={21} />
            </button>
            <div className="eyebrow dark">
              {modal === "post"
                ? "EMPLOYER WORKSPACE"
                : modal === "refer"
                  ? "YOUR INTRODUCTION"
                  : "YOUR NEXT MOVE"}{" "}
              · DEMO
            </div>
            <h2 id="modal-title">
              {modal === "post"
                ? "Find your next brilliant hire."
                : modal === "refer"
                  ? "Know someone brilliant?"
                  : "Your next chapter."}
            </h2>
            <p>
              {modal === "post"
                ? "Create a sample role with a transparent referral incentive."
                : modal === "refer"
                  ? "Introduce people who have agreed to be contacted. This demo will not send an invitation."
                  : "This demo stores your application on this device only."}
            </p>
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                modal === "post" ? post() : submitPerson();
              }}
            >
              {modal === "post" ? (
                <>
                  <label>
                    Job title
                    <input
                      required
                      value={form.title}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, title: e.target.value }))
                      }
                      placeholder="e.g. Head of AI"
                    />
                  </label>
                  <label>
                    Company
                    <input
                      required
                      value={form.company}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, company: e.target.value }))
                      }
                      placeholder="Company name"
                    />
                  </label>
                  <label>
                    Sector
                    <select
                      value={form.sector}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, sector: e.target.value }))
                      }
                    >
                      {["Legal", "Technology & AI", "Finance"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row">
                    <label>
                      Location
                      <input
                        value={form.location}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, location: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Salary range
                      <input
                        value={form.salary}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, salary: e.target.value }))
                        }
                        placeholder="£100k–£140k"
                      />
                    </label>
                  </div>
                  <label>
                    Referral reward (tokens)
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={form.tokens}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, tokens: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Job description
                    <textarea
                      required
                      rows={4}
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                    />
                  </label>
                  <button className="primary-button full" type="submit">
                    Publish demo vacancy <ArrowUpRight size={17} />
                  </button>
                </>
              ) : (
                <>
                  <div className="role-summary">
                    {active?.title}
                    <small>
                      {active?.company}{" "}
                      {modal === "refer"
                        ? "· ✳ " +
                          active?.tokens.toLocaleString() +
                          " possible tokens"
                        : ""}
                    </small>
                    <p>{active?.description}</p>
                  </div>
                  <label>
                    {modal === "refer" ? "Candidate name" : "Your name"}
                    <input
                      required
                      autoComplete="off"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Use a fictional name"
                    />
                  </label>
                  <label>
                    {modal === "refer" ? "Candidate email" : "Your email"}
                    <input
                      required
                      type="email"
                      autoComplete="off"
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="demo@example.com"
                    />
                  </label>
                  <button className="primary-button full" type="submit">
                    {modal === "refer"
                      ? "Save demo referral"
                      : "Save demo application"}{" "}
                    <ArrowUpRight size={17} />
                  </button>
                </>
              )}
              <p className="form-disclaimer">
                Demo only. Data stays in your browser. Use fictional details.
              </p>
            </form>
            {toast && (
              <p role="status" className="modal-status">
                {toast}
              </p>
            )}
          </div>
        </dialog>
      )}
      {toast && !modal && (
        <div role="status" className="toast">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
