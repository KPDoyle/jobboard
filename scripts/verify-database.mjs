import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Actual PostgreSQL engine. Only Supabase-managed auth objects are emulated;
// application schema, privileges, policies, triggers and RPCs are unmodified.
const db = new PGlite();
const root = new URL('../database/', import.meta.url);
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      instance_id uuid,
      aud text,
      role text,
      email text,
      email_confirmed_at timestamptz,
      deleted_at timestamptz,
      raw_user_meta_data jsonb,
      created_at timestamptz,
      updated_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claims',true)::jsonb ->> 'sub','')::uuid;
    $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
  `);
  await db.exec(await readFile(new URL('schema.sql', root), 'utf8'));
  console.log('Schema bootstrap passed on PostgreSQL', (await db.query('show server_version')).rows[0].server_version);
  const results = await db.exec(await readFile(new URL('verify.sql', root), 'utf8'));
  console.log(results.at(-1).rows[0].result);
  const cleanup = await db.query(`select
    (select count(*)::int from auth.users) as users,
    (select count(*)::int from public.jobs) as jobs,
    (select count(*)::int from public.reward_ledger) as ledger,
    (select count(*)::int from private.audit_log) as audit`);
  if (Object.values(cleanup.rows[0]).some(value => value !== 0)) throw new Error('Verification left synthetic data behind');
  console.log('Rollback cleanup passed:', JSON.stringify(cleanup.rows[0]));
} catch (error) {
  console.error('DATABASE VERIFICATION FAILED:', error.message, 'SQLSTATE:', error.code, 'DETAIL:', error.detail ?? '', 'WHERE:', error.where ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
