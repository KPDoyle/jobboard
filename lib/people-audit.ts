export const MAX_LINKS = 40;
export type Claim = {
  id: string;
  kind: "Employment" | "Education" | "Certification";
  organisation: string;
  detail: string;
  start: string;
  end: string;
  evidence: string;
};
export type LinkFinding = {
  url: string;
  status: "reachable" | "restricted" | "unavailable" | "unsafe" | "unsupported";
  reason: string;
  checkedAt: string;
  finalUrl?: string;
  httpStatus?: number;
};
export type Review = {
  decision: "confirmed" | "discrepancy" | "pending";
  reviewer: string;
  source: string;
  notes: string;
  reviewedAt: string;
};
export type Report = {
  id: string;
  name: string;
  profileUrl: string;
  createdAt: string;
  input: string;
  claims: Claim[];
  links: LinkFinding[];
  reviews: Record<string, Review>;
  history?: (Review & { claimId: string })[];
  sample: boolean;
};
export const emptyClaim = (): Claim => ({
  id: crypto.randomUUID(),
  kind: "Employment",
  organisation: "",
  detail: "",
  start: "",
  end: "",
  evidence: "",
});
export function normaliseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}
export function isLinkedIn(hostname: string) {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}
export function isProfileUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      isLinkedIn(u.hostname) &&
      /^\/in\/[^/]+\/?$/.test(u.pathname) &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
// Extract from strings only; never construct a document or render supplied markup.
export function extractTextUrls(text: string): string[] {
  return (
    text
      .match(/https?:\/\/[^\s<>"']+/gi)
      ?.map((u) => u.replace(/[.,;!?)\]}]+$/, "")) ?? []
  );
}
export function extractHtmlHrefs(text: string): string[] {
  const decode = (value: string) =>
    value.replace(
      /&(?:amp|quot|apos|lt|gt|#(x[0-9a-f]+|[0-9]+));/gi,
      (entity, numeric: string | undefined) => {
        if (numeric) {
          const number =
            numeric[0].toLowerCase() === "x"
              ? parseInt(numeric.slice(1), 16)
              : parseInt(numeric, 10);
          return number > 0 && number <= 0x10ffff
            ? String.fromCodePoint(number)
            : entity;
        }
        return (
          (
            {
              "&amp;": "&",
              "&quot;": '"',
              "&apos;": "'",
              "&lt;": "<",
              "&gt;": ">",
            } as Record<string, string>
          )[entity.toLowerCase()] || entity
        );
      },
    );
  return [
    ...text.matchAll(
      /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    ),
  ].map((match) => decode(match[1] ?? match[2] ?? match[3]));
}
export function collectLinks(
  profile: string,
  copy: string,
  claims: Claim[],
  hrefs: string[] = [],
) {
  const values = [
    profile,
    ...extractTextUrls(copy),
    ...hrefs,
    ...claims.flatMap((c) => extractTextUrls(c.evidence)),
  ];
  return [
    ...new Set(values.filter(Boolean).map((u) => normaliseUrl(u) ?? u.trim())),
  ];
}
export function claimFlags(
  claim: Claim,
  all: Claim[],
  now = new Date(),
): string[] {
  const flags: string[] = [];
  const month = /^\d{4}-(0[1-9]|1[0-2])$/;
  const currentMonth = now.toISOString().slice(0, 7);
  if (!claim.start)
    flags.push(
      "Start date missing. Confirm dates with the employer or issuer.",
    );
  if (claim.start && !month.test(claim.start))
    flags.push("Start date needs correction.");
  if (claim.end && !month.test(claim.end))
    flags.push("End date needs correction.");
  if (claim.start > currentMonth || (claim.kind !== "Certification" && claim.end > currentMonth))
    flags.push("A date is in the future. Ask the candidate to clarify.");
  if (claim.start && claim.end && claim.end < claim.start)
    flags.push("End date precedes start date. Ask the candidate to clarify.");
  if (
    claim.kind === "Employment" &&
    month.test(claim.start) &&
    all.some(
      (c) =>
        c.id !== claim.id &&
        c.kind === "Employment" &&
        month.test(c.start) &&
        c.start <= (claim.end || currentMonth) &&
        claim.start <= (c.end || currentMonth),
    )
  )
    flags.push(
      "Employment dates overlap. Concurrent roles can be legitimate; confirm the working arrangement.",
    );
  return flags;
}
export function claimState(claim: Claim, report: Report) {
  const review = report.reviews[claim.id];
  if (review?.decision === "discrepancy") return "Discrepancy recorded";
  if (review?.decision === "confirmed") return "Reviewer confirmed";
  return "Review required";
}
export function reportSummary(report: Report) {
  const confirmed = report.claims.filter(
    (c) => report.reviews[c.id]?.decision === "confirmed",
  ).length;
  const discrepancies = report.claims.filter(
    (c) => report.reviews[c.id]?.decision === "discrepancy",
  ).length;
  return {
    confirmed,
    discrepancies,
    pending: report.claims.length - confirmed - discrepancies,
    reachable: report.links.filter((l) => l.status === "reachable").length,
  };
}
