# Vantage People Audit

The `/people-audit` workspace adds candidate claim review to the existing Vantage demo. It is linked from the main navigation and employer dashboard.

## Included

- Candidate name, LinkedIn profile URL, candidate-supplied text/HTML, and explicit employment/education/certification claims.
- Every unique supplied link is accounted for, including anchors in pasted HTML and per-claim evidence. Up to 40 links and 25 claims per audit; excess links trigger an error rather than truncation.
- The server makes lightweight HEAD requests to public HTTPS sources. It follows up to three safe redirects and distinguishes reachable, inaccessible, unavailable, unsafe, and unsupported links. It does not read page content or infer truth from link availability.
- LinkedIn and lnkd.in URLs are flagged for authorised integration or manual review. They are not scraped. A supplied profile copy is not proof of completeness, authenticity or ownership.
- Claim flags cover missing/reversed/future dates and overlapping employment. Overlap is a prompt to clarify concurrent roles, not an accusation.
- All claims initially require review. A human records their name, independent evidence URL, reasoning and decision. A LinkedIn page alone cannot support a confirmation. Automatic flags remain visible after review.
- JSON exports include claim findings, source outcomes, timestamps, the latest reviewer decision and the session's reviewer decision history. This is an editable demo record, not an authenticated or tamper-proof certificate.
- The fictional sample is explicitly labelled and uses simulated source responses.

## Data flow and limits

Profile text, candidate name, claims and reviewer notes remain in React memory. Only the extracted source URLs are posted to `/api/people-audit/links`. URLs may contain personal data, so production consent and retention must cover them. Source hosts receive a HEAD request from the server with a Vantage user agent. No email, reference request, provider verification, hiring decision or employer contact is performed.

Reports disappear on refresh. Export a JSON copy to retain a test report. No shared candidate database or authentication boundary has been added to this demo. Do not enter confidential candidate records.

Network safeguards: HTTPS only, no credentials or unusual ports, private/reserved IP blocking for IPv4 and IPv6, all DNS answers checked, validated addresses pinned for TLS, each redirect revalidated, no response body downloaded, bounded link count/body size/concurrency/time, same-origin browser checks, and per-instance quotas. These quotas are not distributed authentication or abuse prevention; origin headers alone are not an access-control mechanism.

## Production integration

Before using real candidate data, connect this workflow to authenticated employer tenants and candidate consent. Use server-owned audit records with access controls, authorised reviewer identities, append-only decision history, evidence snapshots/digests, deletion and retention rules, and candidate correction/dispute handling. Add a distributed queue, shared per-tenant quotas and monitoring to the URL checker. Review outbound egress policy for the hosting environment.

For LinkedIn coverage, obtain approved API/partner access with appropriate scope or accept candidate-supplied exports and enumerate their coverage explicitly. Standard LinkedIn sign-in does not provide a full employment history or verify its truth. Employment and qualification confirmation requires an authorised background-check provider, independently authenticated employer reference, or issuer register. Provider callbacks should verify signatures and bind the identity, organisation, exact claim and dates before a server can award an independent verification status. A reviewer clicking a button must never create a provider-verified badge.

Official references:
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?lang=en

## Verification

`pnpm test` checks URL collection, date findings, review invariants, network boundaries, redirect policy and response classification with deterministic fixtures. `pnpm build` performs the Next.js production build and type checking. Browser verification covers fictional sample, a new audit through the actual server endpoint, reviewer decision entry and report export.
