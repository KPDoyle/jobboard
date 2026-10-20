import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const root = new URL('../', import.meta.url);
const authSource = await readFile(new URL('lib/supabase.ts', root), 'utf8');
const accountSource = await readFile(new URL('app/account/page.tsx', root), 'utf8');
const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 };
let passed = 0;
let requests = [];
let onGet = () => {};
let remoteUserOverride = null;
const isolatedOptions = [];
const memberA = '11111111-1111-4111-8111-111111111111';
const memberB = '22222222-2222-4222-8222-222222222222';
function user(id) { return { id, aud: 'authenticated', role: 'authenticated', email: `${id}@example.test`, app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z' }; }
function token(id, expiry = Math.floor(Date.now() / 1000) + 3600) {
  return [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, exp: expiry })).toString('base64url'), 'test-signature'].join('.');
}
function session(id, expiry) { return { user: user(id), access_token: token(id, expiry), refresh_token: 'must-not-be-used' }; }
async function mockFetch(input, init = {}) {
  const url = String(input);
  const method = init.method ?? 'GET';
  const authorization = new Headers(init.headers).get('authorization');
  requests.push({ url, method, authorization, body: init.body });
  assert.ok(url.endsWith('/auth/v1/user'), 'Auth tests must never send a refresh-token request');
  const payload = JSON.parse(Buffer.from(authorization.replace('Bearer ', '').split('.')[1], 'base64url').toString());
  if (payload.exp <= Date.now() / 1000) return new Response(JSON.stringify({ code: 'bad_jwt', msg: 'Expired token' }), { status: 401, headers: { 'content-type': 'application/json' } });
  if (method === 'GET') onGet();
  return new Response(JSON.stringify(user(remoteUserOverride ?? payload.sub)), { status: 200, headers: { 'content-type': 'application/json' } });
}
const compiled = ts.transpileModule(authSource, { compilerOptions: options }).outputText;
const authModule = { exports: {} };
const localRequire = (name) => name === '@supabase/supabase-js' ? {
  createClient(url, key, config = {}) {
    if (config.auth?.persistSession === false) isolatedOptions.push(config.auth);
    return createClient(url, key, { ...config, global: { ...config.global, fetch: mockFetch } });
  },
} : require(name);
new Function('require', 'module', 'exports', 'process', 'window', 'fetch', compiled)(
  localRequire, authModule, authModule.exports,
  { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' } },
  { location: { origin: 'https://vantage-kevindoyle.vercel.app' } }, mockFetch,
);
const auth = authModule.exports;

try {
  const redirects = [
    [null, '/workspace'], ['', '/workspace'], ['/workspace', '/workspace'],
    ['/jobs/123?ref=abc#apply', '/jobs/123?ref=abc#apply'], ['/account/reset-password', '/account/reset-password'],
    ['https://evil.example', '/workspace'], ['//evil.example', '/workspace'],
    ['/\\evil.example', '/workspace'], ['/\n/evil.example', '/workspace'], ['javascript:alert(1)', '/workspace'],
    ['/auth/callback', '/workspace'], ['/a/../auth/callback', '/workspace'],
    ['/a/..//evil.example', '/workspace'], ['/%2e%2e//evil.example', '/workspace'],
    ['/a/..///evil.example/path', '/workspace'], ['/././a/../..//evil.example', '/workspace'],
  ];
  for (const [input, expected] of redirects) { assert.equal(auth.safeNextPath(input), expected, `Unsafe redirect: ${JSON.stringify(input)}`); passed++; }
  assert.equal(auth.authCallbackUrl(), 'https://vantage-kevindoyle.vercel.app/auth/callback?next=%2Fworkspace'); passed++;
  assert.equal(auth.authCallbackUrl('//evil.example'), 'https://vantage-kevindoyle.vercel.app/auth/callback?next=%2Fworkspace'); passed++;
  assert.equal(auth.authCallbackUrl('/account/reset-password', true), 'https://vantage-kevindoyle.vercel.app/auth/callback?next=%2Faccount%2Freset-password&recovery=1'); passed++;

  // Change the caller's session object during token verification. The password
  // update must still carry the original account's token, with no shared state.
  const original = session(memberA);
  const originalToken = original.access_token;
  onGet = () => { Object.assign(original, session(memberB)); };
  await auth.updatePasswordForSession(original, memberA, 'a-new-test-password', () => true);
  assert.deepEqual(requests.map(({ method, authorization }) => ({ method, authorization })), [
    { method: 'GET', authorization: `Bearer ${originalToken}` }, { method: 'PUT', authorization: `Bearer ${originalToken}` },
  ]);
  assert.equal(JSON.parse(requests[1].body).password, 'a-new-test-password'); passed++;

  requests = []; let current = true;
  onGet = () => { current = false; };
  await assert.rejects(auth.updatePasswordForSession(session(memberA), memberA, 'test-password', () => current));
  assert.equal(requests.filter(request => request.method === 'PUT').length, 0); passed++;

  requests = []; onGet = () => {}; remoteUserOverride = memberB;
  await assert.rejects(auth.updatePasswordForSession(session(memberA), memberA, 'test-password', () => true));
  assert.equal(requests.filter(request => request.method === 'PUT').length, 0); passed++;

  requests = []; remoteUserOverride = null;
  await assert.rejects(auth.updatePasswordForSession(session(memberA), memberB, 'test-password', () => true));
  assert.equal(requests.length, 0); passed++;
  await assert.rejects(auth.updatePasswordForSession(session(memberA), memberA, 'test-password', () => false));
  assert.equal(requests.length, 0); passed++;

  await assert.rejects(auth.updatePasswordForSession(session(memberA, Math.floor(Date.now() / 1000) - 60), memberA, 'test-password', () => true));
  assert.deepEqual(requests.map(request => request.method), ['GET']); passed++;
  for (const config of isolatedOptions) {
    assert.equal(config.persistSession, false);
    assert.equal(config.autoRefreshToken, false);
    assert.equal(config.detectSessionInUrl, false);
  }
  assert.equal(new Set(isolatedOptions.map(config => config.storageKey)).size, isolatedOptions.length); passed++;

  // Exercise the actual export handler with delayed microtasks and a minimal
  // browser surface. No component rendering or real account data is involved.
  const accountAst = ts.createSourceFile('account.tsx', accountSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let exportHandler;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'exportData') exportHandler = node;
    ts.forEachChild(node, visit);
  }
  visit(accountAst);
  assert.ok(exportHandler, 'Account export handler exists');
  function exportHarness() {
    const state = { mounted: { current: true }, identity: { current: { id: memberA, generation: 1 } }, blobs: [], clicks: 0, messages: [] };
    const scope = {
      supabase: { auth: { getUser: async () => ({ data: { user: user(memberA) }, error: null }) } },
      user: user(memberA), busy: false, mounted: state.mounted, identity: state.identity,
      setBusy: () => {}, feedback: (message) => state.messages.push(message),
      getProfile: async () => ({ id: memberA, display_name: 'Member A' }),
      listMyApplications: async () => [{ id: 'application', candidate_id: memberA }],
      listMyReferrals: async () => [{ id: 'referral', job_id: 'job', candidate_id: memberB, candidate_name: 'Private candidate', status: 'applied', created_at: '', jobs: null }],
      listLedger: async () => [], listRedemptions: async () => [], listSavedJobs: async () => [],
      URL: { createObjectURL: blob => { state.blobs.push(blob); return 'blob:account-data'; }, revokeObjectURL: () => {} },
      document: { createElement: () => ({ click: () => state.clicks++, remove: () => {} }), body: { appendChild: () => {} } },
      window: { setTimeout: callback => callback() },
    };
    const output = ts.transpileModule(`const run = ${exportHandler.getText(accountAst)}; export { run };`, { compilerOptions: options }).outputText;
    const mod = { exports: {} };
    new Function('module', 'exports', ...Object.keys(scope), output)(mod, mod.exports, ...Object.values(scope));
    return { state, run: mod.exports.run };
  }
  const success = exportHarness(); await success.run();
  assert.equal(success.state.clicks, 1);
  const downloaded = JSON.parse(await success.state.blobs[0].text());
  assert.equal(downloaded.account.id, memberA);
  assert.ok(!('candidate_id' in downloaded.referrals[0]) && !('candidate_name' in downloaded.referrals[0])); passed++;
  const unmounted = exportHarness(); const unmountedTask = unmounted.run(); unmounted.state.mounted.current = false; await unmountedTask;
  assert.equal(unmounted.state.clicks, 0); assert.equal(unmounted.state.blobs.length, 0); passed++;
  const switched = exportHarness(); const switchedTask = switched.run();
  switched.state.identity.current = { id: memberB, generation: 2 };
  switched.state.identity.current = { id: memberA, generation: 3 };
  await switchedTask; assert.equal(switched.state.clicks, 0); passed++;
  console.log(`${passed} auth regression checks passed: redirects, callback URLs, access-token-bound password updates, and export cancellation.`);
} finally {
  await auth.supabase?.auth.dispose();
}
