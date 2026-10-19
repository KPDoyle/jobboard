# VANTAGE — Premium Talent Marketplace

Next.js app deployed to Vercel from `KPDoyle/jobboard`.

## Current functionality
- Responsive candidate marketplace, legal/technology/finance search and filters.
- Employer job administration, candidate applications, referral tracker and token catalogue currently operate in **browser-only demo mode** (localStorage).
- Member login/register page at `/account`, which activates when a dedicated Supabase database and environment variables are configured.
- `database/schema.sql`: production-oriented starter schema with ownership RLS, protected reward ledger and vacancy publishing restrictions. It is **not automatically applied**.

## Provision backend
1. Create a **dedicated** Supabase project for VANTAGE (do not reuse an unrelated project).
2. Review and execute `database/schema.sql` in Supabase SQL editor.
3. Configure Supabase Auth email / password provider, appropriate site URL and redirect URLs.
4. Set in Vercel, for production and preview:
   - `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable client key (NOT service_role/secret key).
5. Redeploy.

## Important limitations
Until a fully integrated backend and admin APIs are implemented, this deployment is **not a production-ready recruitment service**. Example vacancies, referrals, employer records, applications and token balances shown on the marketplace are browser-local illustrative data. Login does not automatically replace those demo workflows. The database schema defines foundational tables and access policy, but does not provide real-world email consent, payments, hiring verification, reward award approval, fulfilment, admin moderation, GDPR retention or ATS integrations. Do not enter genuine candidate personal data in demo forms.

## Run locally
```bash
npm install
npm run dev
```

## Brand
VANTAGE is a working creative concept only, pending trademark/domain clearance.
