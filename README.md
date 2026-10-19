# VANTAGE — Your next move starts here

A contemporary talent marketplace for ambitious professionals in legal, technology & AI, and finance. VANTAGE brings career opportunities, trusted introductions and professional-development rewards into one clear, energetic experience.

Built with Next.js and deployed to the connected Vercel project `jobboard` from `KPDoyle/jobboard`.

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

Create a production build with `npm run build`, then run it with `npm start`.

## Brand

VANTAGE speaks to a new generation of professionals with bold sans-serif typography, vivid colour, generous spacing and a confident, approachable voice. The identity connects the ambition of legal, technology and finance talent with the value of a strong professional network. Responsive layouts, clear actions and purposeful motion carry that identity through discovery, referrals, rewards and the employer workspace.

Use direct, useful language about career progression and introductions. Keep demo disclosures visible alongside interactions, and describe token values and rewards as illustrative until real eligibility, approval and fulfilment services exist.

VANTAGE remains a working creative concept, pending trademark/domain clearance.
