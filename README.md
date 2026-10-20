# VANTAGE

A career marketplace for legal, technology & AI and finance professionals.

- Repository: https://github.com/KPDoyle/vantage
- Existing Vercel project: https://vercel.com/kevindoyle/vantage
- Canonical live address: https://vantage-kevindoyle.vercel.app

## Connected application

The implementation replaces browser-local demo records with Supabase-backed data:

- Email/password registration, confirmation, login/logout, password recovery and profile editing.
- Public live-job search, sector/workplace filters, job details and persistent saved jobs.
- Candidate applications with a secure CV link, progress tracking and withdrawal.
- Employer vacancy drafts, mandatory admin approval before publication, vacancy closure and applicant stages.
- Personal referral links. Candidates consent before their name and progress are shared with a referrer. Referrers do not collect third-party email addresses.
- Protected token ledger. An independent administrator verifies a completed hire before issuing the approved token amount. Members cannot mint tokens; awards and refunds are idempotent.
- Admin-managed rewards, manual fulfilment requests and transactional token reservation/refunds. No external courses, subscriptions or payments are automatically purchased.
- Private account-data export and a privacy-information page.

A fresh database starts empty: no fictional vacancies, balances or reward suppliers. Only publish genuine vacancies and activate rewards the platform can fulfil.

## Backend setup before release

1. Create a **dedicated** Supabase project in the intended organization. Do not reuse another application's database. During implementation, the account reached its two-active-free-project limit; its owner chose to free a slot or provide another organization.
2. Apply `database/schema.sql` once to the new project. It creates explicit grants and RLS for all exposed tables. Keep `private` outside the Data API exposed schemas.
3. Run rollback-only `database/verify.sql` as the trusted database owner and check Supabase's security/performance advisors.
4. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on the existing Vercel project. No service-role/secret key is required by the application. Configure previews against a separate test backend when available.
5. Enable email/password auth, keep email confirmation on, and set Site URL to `https://vantage-kevindoyle.vercel.app`. Allow callback URLs matching `https://vantage-kevindoyle.vercel.app/auth/callback**` and, if using token-hash templates, `/auth/confirm**`. Add corresponding localhost callbacks for development. Only allow other deployment hosts intentionally.
6. Configure custom SMTP for public signup and reset emails. Supabase's default sender only supports organization-member addresses. Default confirmation-link email templates work with this application; custom templates are optional.
7. Once the nominated owner registers and verifies their email, add their UUID to `private.admin_members` using trusted SQL. Never use user-editable metadata to authorize an admin. An administrator can publish their own vacancy, but cannot approve a referral award if they are the referrer, candidate or hiring employer; another administrator must verify it.
8. Deploy the reviewed commit to the existing Vercel project, then verify each role end to end with disposable test accounts and remove test records. Preserve the existing domains and Git integration.

Until provisioning is complete, this branch is not a connected production service. The previous production deployment is retained.

## Local development

Use Node.js 24 and pnpm. Copy `.env.example` to `.env.local` and fill the two public configuration values. Never commit `.env.local`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Validation

```sh
pnpm typecheck
pnpm test:auth
pnpm test:database
pnpm build
```

The database test executes the **unmodified** schema and rollback assertions against real PostgreSQL in PGlite. Only Supabase-managed auth objects and roles are emulated. It covers ownership/RLS, profile isolation, publication, applications, referral consent, self-award prevention, exact/idempotent token awards, redemptions, refunds and insufficient balances. It does not verify hosted email delivery, PostgREST configuration or simultaneous database connections; those require the provisioned project.

The auth regression checks cover redirect normalization, session-bound password changes and cancellation when an account changes.

## Access model

Account type is an interface preference, never a privileged role. RLS or checked database functions enforce every request. Privileged functions have fixed search paths and live in the non-exposed `private` schema; public RPC wrappers use invoker security. Clients cannot edit private admin membership, audit records or ledger entries.

Members see their own records. Employers see applications to their vacancies. Referrers see only consented candidate names and progress, not CV/contact details. Administrators handle publication, hire-verification and fulfilment queues.

The browser persists only the Supabase authentication session; jobs, applications, introductions, tokens and rewards are stored in the shared database.
