"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ShieldCheck,
  Link2,
  ClipboardCheck,
  Plus,
  Trash2,
  Download,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  X,
} from "lucide-react";
import {
  MAX_LINKS,
  emptyClaim,
  collectLinks,
  extractHtmlHrefs,
  isProfileUrl,
  isLinkedIn,
  normaliseUrl,
  claimFlags,
  claimState,
  reportSummary,
  type Claim,
  type Report,
  type Review,
  type LinkFinding,
} from "../../lib/people-audit";
import styles from "./people-audit.module.css";

const stamp = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const labels: Record<LinkFinding["status"], string> = {
  reachable: "Reachable · review content",
  restricted: "Access restricted",
  unavailable: "Unavailable · review required",
  unsafe: "Not visited · unsafe / unsupported",
  unsupported: "Manual check required",
};
function sourceLink(url: string, title?: string) {
  const safe = normaliseUrl(url);
  return safe ? (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
    >
      {title || url}
      <ArrowUpRight size={13} aria-label="opens in a new tab" />
    </a>
  ) : (
    <span>{url || "No source supplied"}</span>
  );
}
function exampleReport(): Report {
  const time = new Date().toISOString();
  const claims: Claim[] = [
    {
      id: "example-1",
      kind: "Employment",
      organisation: "Example Systems",
      detail: "Senior software engineer",
      start: "2021-04",
      end: "2024-06",
      evidence: "https://example.com/team",
    },
    {
      id: "example-2",
      kind: "Employment",
      organisation: "Example Ventures",
      detail: "Engineering lead",
      start: "2023-09",
      end: "",
      evidence: "https://www.linkedin.com/company/example-ventures/",
    },
    {
      id: "example-3",
      kind: "Certification",
      organisation: "Example Institute",
      detail: "Cloud architecture certificate",
      start: "2020-06",
      end: "",
      evidence: "https://example.org/credentials/demo",
    },
  ];
  return {
    id: crypto.randomUUID(),
    name: "Alex Morgan (fictional)",
    profileUrl: "https://www.linkedin.com/in/vantage-fictional-example/",
    createdAt: time,
    input:
      "Fictional example. Link responses and reviewer decisions are simulated.",
    claims,
    sample: true,
    links: [
      {
        url: "https://www.linkedin.com/in/vantage-fictional-example/",
        status: "restricted",
        reason:
          "Simulated: LinkedIn requires manual review or approved access.",
        checkedAt: time,
      },
      {
        url: claims[0].evidence,
        status: "reachable",
        reason:
          "Simulated response. A working team-page link does not prove employment.",
        checkedAt: time,
      },
      {
        url: claims[1].evidence,
        status: "restricted",
        reason:
          "Simulated: LinkedIn company pages do not prove this individual worked there.",
        checkedAt: time,
      },
      {
        url: claims[2].evidence,
        status: "unavailable",
        reason:
          "Simulated: credential page unavailable. Ask the issuing body to confirm.",
        checkedAt: time,
      },
    ],
    reviews: {
      "example-1": {
        decision: "confirmed",
        reviewer: "Demo reviewer",
        source: "https://example.com/team",
        notes:
          "Fictional example of an employer reference confirming the role and dates. No real reference was obtained.",
        reviewedAt: time,
      },
    },
  };
}
export default function PeopleAudit() {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [copy, setCopy] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [permission, setPermission] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState("all");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [review, setReview] = useState({
    decision: "pending",
    reviewer: "",
    source: "",
    notes: "",
  });
  const [reviewError, setReviewError] = useState("");
  const [notice, setNotice] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  const activeRequest = useRef(false);
  const summary = report ? reportSummary(report) : null;
  function updateClaim(id: string, field: keyof Claim, value: string) {
    setClaims((list) =>
      list.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }
  function showReport(next: Report) {
    setReport(next);
    setFilter("all");
    setReviewId(null);
    setNotice("");
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      resultRef.current?.focus({ preventScroll: true });
    });
  }
  async function run(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (activeRequest.current) return;
    if (!name.trim() || !isProfileUrl(profile)) {
      setError(
        "Enter a candidate name and a valid HTTPS LinkedIn /in/ profile URL.",
      );
      return;
    }
    if (!permission || !complete) {
      setError(
        "Confirm permission and that you have included all claims and links from the supplied profile copy.",
      );
      return;
    }
    if (
      !claims.length ||
      claims.some((c) => !c.organisation.trim() || !c.detail.trim())
    ) {
      setError(
        "Add at least one claim, with an organisation and role or qualification for each.",
      );
      return;
    }
    const hrefs = extractHtmlHrefs(copy)
      .filter(Boolean)
      .map((href) => {
        try {
          return new URL(href, profile).href;
        } catch {
          return href;
        }
      });
    const urls = collectLinks(profile, copy, claims, hrefs);
    if (urls.length > MAX_LINKS) {
      setError(
        `This copy contains ${urls.length} unique links. Split it into audits of up to ${MAX_LINKS} links; no links have been silently skipped.`,
      );
      return;
    }
    if (urls.some((u) => u.length > 2048)) {
      setError(
        "One link is longer than 2,048 characters. Remove tracking parameters or provide a shorter source URL.",
      );
      return;
    }
    activeRequest.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/people-audit/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
        signal: AbortSignal.timeout(55000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Link checks failed. Try again.");
      if (!Array.isArray(data.links) || data.links.length !== urls.length)
        throw new Error("The check did not account for every link. Try again.");
      showReport({
        id: crypto.randomUUID(),
        name: name.trim(),
        profileUrl: profile,
        createdAt: new Date().toISOString(),
        input: copy,
        claims: claims.map((c) => ({ ...c })),
        links: data.links,
        reviews: {},
        sample: false,
      });
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "The check timed out. No completed report was created. Please try again.",
      );
    } finally {
      activeRequest.current = false;
      setBusy(false);
    }
  }
  function startReview(claim: Claim) {
    if (!report) return;
    const previous = report.reviews[claim.id];
    setReview({
      decision: previous?.decision || "pending",
      reviewer: previous?.reviewer || "",
      source: previous?.source || "",
      notes: previous?.notes || "",
    });
    setReviewError("");
    setReviewId(claim.id);
  }
  function saveReview(event: React.FormEvent) {
    event.preventDefault();
    if (!report || !reviewId) return;
    if (
      !review.reviewer.trim() ||
      !review.notes.trim() ||
      !normaliseUrl(review.source)
    ) {
      setReviewError(
        "Include your name, a public evidence URL, and notes explaining which role, qualification and dates the evidence supports or contradicts.",
      );
      return;
    }
    if (
      review.decision === "confirmed" &&
      isLinkedIn(new URL(review.source).hostname)
    ) {
      setReviewError(
        "A LinkedIn page alone is not independent evidence. Supply employer or issuer confirmation.",
      );
      return;
    }
    if (
      review.decision === "confirmed" &&
      report.links.some(
        (l) =>
          l.url === normaliseUrl(review.source) && l.status !== "reachable",
      )
    ) {
      setReviewError(
        "That source was flagged by the checker. Supply an independent employer or issuer evidence link and describe your manual confirmation.",
      );
      return;
    }
    const next: Review = {
      decision: review.decision as Review["decision"],
      reviewer: review.reviewer.trim(),
      source: normaliseUrl(review.source)!,
      notes: review.notes.trim(),
      reviewedAt: new Date().toISOString(),
    };
    setReport({
      ...report,
      reviews: { ...report.reviews, [reviewId]: next },
      history: [...(report.history || []), { ...next, claimId: reviewId }],
    });
    setReviewId(null);
    setNotice(
      "Reviewer decision recorded for this session. Export to keep a copy.",
    );
  }
  function exportReport() {
    if (!report) return;
    const payload = {
      ...report,
      scope:
        "All unique links supplied in the profile copy and claim evidence. No automatic LinkedIn discovery, identity verification, employer contact or qualification confirmation.",
      assurance:
        "Session-only demo record. Reviewer names are self-declared. This is not a tamper-proof verification certificate.",
      summary: reportSummary(report),
      findings: report.claims.map((c) => ({
        claimId: c.id,
        status: claimState(c, report),
        flags: claimFlags(c, report.claims, new Date(report.createdAt)),
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `vantage-audit-${report.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className="brand" aria-label="Vantage home">
          <span className="brand-mark" aria-hidden="true">
            v<span>↗</span>
          </span>
          <span>
            vantage<span className="brand-dot">.</span>
          </span>
        </Link>
        <Link href="/">
          <ArrowLeft size={16} /> Back to marketplace
        </Link>
        <span className={styles.workspace}>
          <ShieldCheck size={17} /> Employer workspace
        </span>
      </header>
      <main>
        <section className={styles.hero}>
          <div>
            <div className="eyebrow">VANTAGE / PEOPLE AUDIT</div>
            <h1>
              Great people.
              <br />
              <em>Clearer evidence.</em>
            </h1>
            <p>
              Look beyond the profile. Check the links, question the gaps, and
              see what still needs a human review.
            </p>
            <div className={styles.heroActions}>
              <a href="#new-audit" className="primary-button">
                Start an audit <ArrowUpRight size={18} />
              </a>
              <button onClick={() => showReport(exampleReport())}>
                Explore a fictional example <ArrowRightIcon />
              </button>
            </div>
          </div>
          <aside className={styles.assurance}>
            <ShieldCheck size={38} strokeWidth={1.4} />
            <span>CONFIDENCE STARTS WITH CLARITY</span>
            <h2>
              A claim is a<br />
              starting point.
            </h2>
            <p>
              Evidence tells you what you can rely on. Every unresolved claim
              stays visible.
            </p>
            <div>
              <span>
                <Link2 size={16} /> Check sources
              </span>
              <span>
                <ClipboardCheck size={16} /> Record the review
              </span>
            </div>
          </aside>
        </section>
        <div className={styles.disclosure}>
          <AlertTriangle size={18} />
          <p>
            <strong>Working demo · session only.</strong> Use fictional or
            non-sensitive test data. Link checks run on the server; profile text
            and claims stay in this tab. Reports disappear on refresh. No
            employers are contacted. Reviewer decisions are self-declared and
            are not independently authenticated.
          </p>
        </div>
        <section id="new-audit" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <div className="eyebrow dark">
                01 / BUILD THE EVIDENCE PICTURE
              </div>
              <h2>Start with what’s claimed.</h2>
            </div>
            <p>
              Use a profile copy supplied with permission. Include its
              employment, education, certifications, and all linked sources.
            </p>
          </div>
          <form onSubmit={run} className={styles.form}>
            <fieldset disabled={busy}>
              <legend className={styles.srOnly}>Candidate and profile</legend>
              <div className={styles.twoCol}>
                <label>
                  Candidate name
                  <input
                    maxLength={120}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name for this audit"
                    autoComplete="off"
                  />
                </label>
                <label>
                  LinkedIn profile URL
                  <input
                    required
                    type="url"
                    maxLength={2048}
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    placeholder="https://www.linkedin.com/in/…"
                  />
                </label>
              </div>
              <label>
                Candidate-supplied profile copy or HTML
                <textarea
                  rows={5}
                  maxLength={100000}
                  value={copy}
                  onChange={(e) => setCopy(e.target.value)}
                  placeholder="Paste the supplied profile text with its links, or a saved HTML copy. Add missing links here, one per line."
                />
              </label>
              <p className={styles.help}>
                Links are extracted from text and HTML anchors. Up to{" "}
                {MAX_LINKS} unique links per audit. We cannot discover hidden or
                omitted LinkedIn links, or prove that the copy is complete.
                Supplied HTML is never displayed or executed.
              </p>
              <div className={styles.claimHeading}>
                <h3>Claims to validate</h3>
                <button
                  type="button"
                  disabled={claims.length >= 25}
                  onClick={() => setClaims((list) => [...list, emptyClaim()])}
                >
                  <Plus size={16} /> Add claim
                </button>
              </div>
              {claims.length === 0 && (
                <div className={styles.empty}>
                  <FileText size={26} />
                  <p>
                    Add each role, qualification or certification from the
                    profile. Claims are reviewed individually.
                  </p>
                  <button
                    type="button"
                    onClick={() => setClaims([emptyClaim()])}
                  >
                    Add the first claim <Plus size={16} />
                  </button>
                </div>
              )}
              {claims.map((claim, index) => (
                <div className={styles.claimInput} key={claim.id}>
                  <div className={styles.claimHeading}>
                    <span>CLAIM {String(index + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setClaims((list) =>
                          list.filter((c) => c.id !== claim.id),
                        )
                      }
                      aria-label={`Remove claim ${index + 1}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className={styles.threeCol}>
                    <label>
                      Type
                      <select
                        value={claim.kind}
                        onChange={(e) =>
                          updateClaim(claim.id, "kind", e.target.value)
                        }
                      >
                        <option>Employment</option>
                        <option>Education</option>
                        <option>Certification</option>
                      </select>
                    </label>
                    <label>
                      Employer or issuing body
                      <input
                        required
                        maxLength={180}
                        value={claim.organisation}
                        onChange={(e) =>
                          updateClaim(claim.id, "organisation", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Role or qualification
                      <input
                        required
                        maxLength={200}
                        value={claim.detail}
                        onChange={(e) =>
                          updateClaim(claim.id, "detail", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className={styles.threeCol}>
                    <label>
                      Start / issued month
                      <input
                        type="month"
                        value={claim.start}
                        onChange={(e) =>
                          updateClaim(claim.id, "start", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      End / expiry month (optional)
                      <input
                        type="month"
                        value={claim.end}
                        onChange={(e) =>
                          updateClaim(claim.id, "end", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Evidence links (optional)
                      <textarea
                        rows={2}
                        maxLength={8000}
                        placeholder="Employer bio, issuer register, portfolio…"
                        value={claim.evidence}
                        onChange={(e) =>
                          updateClaim(claim.id, "evidence", e.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={permission}
                  onChange={(e) => setPermission(e.target.checked)}
                  required
                />
                <span>
                  I have permission to review this profile and check the
                  supplied links.
                </span>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={complete}
                  onChange={(e) => setComplete(e.target.checked)}
                  required
                />
                <span>
                  I have entered every claim and included every link visible in
                  the supplied profile copy.
                </span>
              </label>
              <div className={styles.submitRow}>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={busy}
                >
                  {busy ? "Checking supplied links…" : "Run people audit"}
                  <Search size={17} />
                </button>
                <span>Every claim starts as “Review required”.</span>
              </div>
            </fieldset>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
        {report && summary && (
          <section
            className={styles.results}
            ref={resultRef}
            tabIndex={-1}
            aria-label="Audit report"
          >
            <div className={styles.sectionHead}>
              <div>
                <div className="eyebrow dark">
                  02 / AUDIT REPORT {report.sample && "· FICTIONAL EXAMPLE"}
                </div>
                <h2>{report.name}</h2>
                <p>
                  {stamp(report.createdAt)} · Report {report.id.slice(0, 8)}
                </p>
                {sourceLink(report.profileUrl, "Supplied LinkedIn profile")}
              </div>
              <div className={styles.reportActions}>
                <button onClick={exportReport}>
                  <Download size={16} /> Export report
                </button>
                <button
                  onClick={() => {
                    setReport(null);
                    setReviewId(null);
                    setNotice("");
                  }}
                >
                  <X size={16} /> Clear report
                </button>
              </div>
            </div>
            {report.sample && (
              <p className={styles.sample}>
                Fictional example: all source responses and the reviewer
                confirmation below are simulated. No real person has been
                checked.
              </p>
            )}
            <div className={styles.metrics}>
              <div>
                <ClipboardCheck />
                <strong>
                  {summary.confirmed}
                  <small>/{report.claims.length}</small>
                </strong>
                <span>Reviewer confirmed</span>
              </div>
              <div>
                <Clock3 />
                <strong>{summary.pending}</strong>
                <span>Claims needing review</span>
              </div>
              <div>
                <AlertTriangle />
                <strong>{summary.discrepancies}</strong>
                <span>Discrepancies recorded</span>
              </div>
              <div>
                <Link2 />
                <strong>
                  {summary.reachable}
                  <small>/{report.links.length}</small>
                </strong>
                <span>Supplied links reachable</span>
              </div>
            </div>
            <div className={styles.scope}>
              <strong>
                {summary.pending || summary.discrepancies
                  ? "Further review required"
                  : "Reviewer decisions recorded · no independent certificate"}
              </strong>
              <p>
                Coverage: {report.links.length} of {report.links.length}{" "}
                supplied unique links accounted for. LinkedIn itself has not
                been scanned. Reachability is not evidence of employment,
                identity or a qualification. Missing evidence is not proof of
                dishonesty. Hiring decisions require human review.
              </p>
            </div>
            <div className={styles.claimHeading}>
              <h3>Claim-by-claim review</h3>
              <label className={styles.filter}>
                Show
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All claims</option>
                  <option value="pending">Needs review</option>
                  <option value="confirmed">Reviewer confirmed</option>
                  <option value="discrepancy">Discrepancies</option>
                </select>
              </label>
            </div>
            <div className={styles.claimResults}>
              {report.claims
                .filter(
                  (c) =>
                    filter === "all" ||
                    (report.reviews[c.id]?.decision || "pending") === filter,
                )
                .map((claim, index) => {
                  const decision = report.reviews[claim.id];
                  const flags = claimFlags(
                    claim,
                    report.claims,
                    new Date(report.createdAt),
                  );
                  return (
                    <article key={claim.id} className={styles.claimResult}>
                      <div className={styles.claimHeading}>
                        <span className={styles.claimNumber}>
                          {String(index + 1).padStart(2, "0")} /{" "}
                          {claim.kind.toUpperCase()}
                        </span>
                        <span
                          className={
                            decision?.decision === "confirmed"
                              ? styles.confirmed
                              : styles.pending
                          }
                        >
                          {claimState(claim, report)}
                        </span>
                      </div>
                      <h4>{claim.detail}</h4>
                      <p>
                        {claim.organisation} · {claim.start || "Start unknown"}{" "}
                        →{" "}
                        {claim.end ||
                          (claim.kind === "Employment"
                            ? "Present / end not supplied"
                            : "Expiry / end not supplied")}
                      </p>
                      <ul>
                        {flags.map((flag) => (
                          <li key={flag}>{flag}</li>
                        ))}
                        {!decision || decision.decision === "pending" ? (
                          <li>
                            Obtain independent{" "}
                            {claim.kind === "Employment"
                              ? "employer confirmation of role and dates"
                              : "confirmation from the issuing body"}
                            . A LinkedIn claim or company page alone is
                            insufficient.
                          </li>
                        ) : null}
                      </ul>
                      {claim.evidence && (
                        <div className={styles.evidence}>
                          <strong>Supplied evidence</strong>
                          {collectLinks("", claim.evidence, []).map((url) => (
                            <div key={url}>{sourceLink(url)}</div>
                          ))}
                        </div>
                      )}
                      {decision && (
                        <div className={styles.reviewRecord}>
                          <strong>
                            {decision.decision === "confirmed"
                              ? "Reviewer confirmation"
                              : decision.decision === "discrepancy"
                                ? "Discrepancy recorded by reviewer"
                                : "Review pending"}{" "}
                            · {decision.reviewer}
                          </strong>
                          <p>{decision.notes}</p>
                          {sourceLink(decision.source, "Reviewer evidence")}
                          <small>
                            Recorded {stamp(decision.reviewedAt)} ·
                            self-declared reviewer ·{" "}
                            {report.sample ? "simulated" : "session record"}
                          </small>
                        </div>
                      )}
                      {reviewId !== claim.id ? (
                        <button onClick={() => startReview(claim)}>
                          <ClipboardCheck size={16} />{" "}
                          {decision ? "Update review" : "Record human review"}
                        </button>
                      ) : (
                        <form
                          onSubmit={saveReview}
                          className={styles.reviewForm}
                        >
                          <h4>Record an evidence-based decision</h4>
                          <p>
                            Confirm the candidate’s identity and the exact role
                            or qualification and dates with an independent
                            employer or issuer. Explain any date flags above.
                            This demo records your assessment; it does not
                            authenticate you or the evidence.
                          </p>
                          <label>
                            Decision
                            <select
                              value={review.decision}
                              onChange={(e) =>
                                setReview((r) => ({
                                  ...r,
                                  decision: e.target.value,
                                }))
                              }
                            >
                              <option value="pending">
                                More review required
                              </option>
                              <option value="confirmed">
                                Reviewer confirmed
                              </option>
                              <option value="discrepancy">
                                Evidence discrepancy
                              </option>
                            </select>
                          </label>
                          <label>
                            Reviewer name
                            <input
                              required
                              maxLength={120}
                              value={review.reviewer}
                              onChange={(e) =>
                                setReview((r) => ({
                                  ...r,
                                  reviewer: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label>
                            Independent evidence URL
                            <input
                              required
                              type="url"
                              maxLength={2048}
                              value={review.source}
                              onChange={(e) =>
                                setReview((r) => ({
                                  ...r,
                                  source: e.target.value,
                                }))
                              }
                              placeholder="https://employer.example/reference"
                            />
                          </label>
                          <label>
                            Evidence and reasoning
                            <textarea
                              required
                              minLength={20}
                              maxLength={4000}
                              rows={3}
                              value={review.notes}
                              onChange={(e) =>
                                setReview((r) => ({
                                  ...r,
                                  notes: e.target.value,
                                }))
                              }
                              placeholder="What was confirmed, by whom, when, and how were the role and dates checked? Do not paste confidential documents."
                            />
                          </label>
                          {reviewError && (
                            <p role="alert" className={styles.error}>
                              {reviewError}
                            </p>
                          )}
                          <div className={styles.reportActions}>
                            <button type="submit">
                              Save reviewer decision <CheckCircle2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setReviewId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  );
                })}
            </div>
            {report.claims.filter(
              (c) =>
                filter === "all" ||
                (report.reviews[c.id]?.decision || "pending") === filter,
            ).length === 0 && (
              <p className={styles.empty}>No claims in this view.</p>
            )}
            {notice && (
              <p className={styles.sample} role="status">
                {notice}
              </p>
            )}
            <div className={styles.linkSection}>
              <h3>Every supplied link, accounted for</h3>
              <p>
                Lightweight checks follow up to three safe redirects. Access
                blocks, timeouts and unsupported checks always need manual
                review. LinkedIn links are flagged for approved access or manual
                review.
              </p>
              {report.links.map((link) => (
                <details key={link.url} className={styles.linkRow}>
                  <summary>
                    <Link2 size={16} />
                    <span>{link.url}</span>
                    <b
                      className={
                        link.status === "reachable"
                          ? styles.neutral
                          : styles.pending
                      }
                    >
                      {labels[link.status]}
                    </b>
                  </summary>
                  <p>{link.reason}</p>
                  <p>
                    Checked {stamp(link.checkedAt)}
                    {link.httpStatus ? ` · HTTP ${link.httpStatus}` : ""}
                    {report.sample ? " · simulated" : ""}
                  </p>
                  {link.status !== "unsafe" &&
                    sourceLink(
                      link.finalUrl || link.url,
                      "Open source for manual review",
                    )}
                  {link.finalUrl && link.finalUrl !== link.url && (
                    <p>Final destination: {link.finalUrl}</p>
                  )}
                </details>
              ))}
            </div>
          </section>
        )}
        <section className={styles.method}>
          <div>
            <div className="eyebrow dark">
              THE STANDARD / EVIDENCE BEFORE ASSURANCE
            </div>
            <h2>
              Know what the
              <br />
              result means.
            </h2>
          </div>
          <div>
            <h3>Sources, checked</h3>
            <p>
              Public HTTPS links are checked for a response. A company’s
              existence does not confirm someone worked there.
            </p>
            <h3>Claims, reviewed</h3>
            <p>
              Role, dates and qualifications need independent employer or issuer
              evidence. Conflicts stay visible for clarification.
            </p>
            <h3>Coverage, made explicit</h3>
            <p>
              This demo examines the supplied copy only. A live service needs
              authorised profile access, authenticated reviewers, protected
              storage and an auditable evidence history.
            </p>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <span>VANTAGE PEOPLE AUDIT · WORKING DEMO</span>
        <Link href="/">
          Back to Vantage <ArrowUpRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={17} />;
}
