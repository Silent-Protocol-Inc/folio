// End-to-end smoke test: builds nothing itself (run `npm run build` first), starts the real server on a throwaway
// SQLite database, provisions an account and walks through sign-in, password change and a workspace save.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admissibleWorkspace } from '../server/workspace-schema.js';

const port = 4700 + Math.floor(Math.random() * 200);
const origin = `http://localhost:${port}`;
const dir = mkdtempSync(join(tmpdir(), 'folio-test-'));
const env = { ...process.env, FOLIO_ORIGIN: origin, PORT: String(port), FOLIO_HOST: '127.0.0.1', FOLIO_DB_PATH: join(dir, 'folio.sqlite') };
let server;
let cookie = '';

const call = (path, { method = 'GET', body, withOrigin = true } = {}) => fetch(origin + path, {
  method,
  headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(withOrigin && method !== 'GET' ? { origin } : {}), ...(cookie ? { cookie } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
const keepCookie = (res) => { const c = res.headers.getSetCookie().find((v) => v.startsWith('__Host-folio_session=')); if (c) cookie = c.split(';')[0]; };

before(async () => {
  server = spawn(process.execPath, ['scripts/serve.mjs'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    server.stdout.on('data', (d) => { if (String(d).includes('Folio listening')) { clearTimeout(timer); resolve(); } });
    server.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
});
after(() => { server?.kill(); rmSync(dir, { recursive: true, force: true }); });

test('serves the app with security headers', async () => {
  const res = await call('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.headers.get('content-security-policy'), /manifest-src 'self'/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.ok(Number(res.headers.get('content-length')) > 0, 'responses carry Content-Length');
  const html = await res.text();
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="black"/, 'solid iOS status bar keeps the app below the notch');
  const emailField = html.match(/<input name="email"[^>]+>/)?.[0] ?? '';
  const passwordField = html.match(/<input id="login-password"[^>]+>/)?.[0] ?? '';
  assert.doesNotMatch(emailField, /\brequired\b/, 'passkey sign-in is not blocked by the email field');
  assert.doesNotMatch(passwordField, /\brequired\b/, 'passkey sign-in is not blocked by the password field');
});

test('home-screen icons and manifest are served and cacheable', async () => {
  for (const path of ['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/icon-192.png', '/icon-512.png', '/favicon.ico']) {
    const res = await call(path);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get('content-type'), 'image/png', path);
    assert.match(res.headers.get('cache-control'), /max-age=/, path);
  }
  const manifest = await (await call('/manifest.webmanifest')).json();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.icons.length, 3);
});

test('unknown paths are 404', async () => {
  assert.equal((await call('/nope')).status, 404);
});

test('account: sign in, forced password change, workspace round trip', async () => {
  const made = spawnSync(process.execPath, ['scripts/account.mjs', 'ci@example.com'], { env, encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  const temporary = made.stdout.match(/Temporary password \(shown once\): (\S+)/)?.[1];
  assert.ok(temporary, 'account tool prints a temporary password');

  assert.deepEqual(await (await call('/api/session')).json(), { user: null });
  assert.equal((await call('/api/login', { method: 'POST', body: { email: 'ci@example.com', password: 'wrong-password' } })).status, 401);
  assert.equal((await call('/api/login', { method: 'POST', withOrigin: false, body: { email: 'ci@example.com', password: temporary } })).status, 403, 'writes need the exact Origin');

  const login = await call('/api/login', { method: 'POST', body: { email: 'ci@example.com', password: temporary } });
  assert.equal(login.status, 200);
  keepCookie(login);
  assert.ok(cookie, 'sign-in sets the session cookie');

  const changed = await call('/api/password', { method: 'POST', body: { currentPassword: temporary, newPassword: 'ci-folio-password-1' } });
  assert.equal(changed.status, 200);
  keepCookie(changed);
  assert.equal((await changed.clone().json()).user.role, 'owner', 'the first account administers workspace accounts');

  const created = await call('/api/accounts', { method: 'POST', body: { email: 'member@example.com', role: 'member', password: 'ci-folio-password-1' } });
  assert.equal(created.status, 201, 'an owner can create a member account');
  const createdBody = await created.json();
  assert.equal(createdBody.account.role, 'member');
  assert.ok(createdBody.temporaryPassword);
  const accountList = await (await call('/api/accounts')).json();
  assert.equal(accountList.accounts.length, 2);
  const ownerId = accountList.accounts.find((account) => account.email === 'ci@example.com').id;
  assert.equal((await call('/api/accounts/' + ownerId, { method: 'PUT', body: { role: 'member', password: 'ci-folio-password-1' } })).status, 400, 'an owner cannot remove their own owner role');

  const passkeyOptions = await call('/api/passkeys/login/options', { method: 'POST', body: {} });
  assert.equal(passkeyOptions.status, 200, 'discoverable passkey sign-in does not require an email');
  const passkeyBody = await passkeyOptions.json();
  assert.deepEqual(passkeyBody.options.allowCredentials ?? [], [], 'the authenticator chooses the Folio account');
  const enrollment = await call('/api/passkeys/enroll/options', { method: 'POST', body: {} });
  assert.equal(enrollment.status, 200, 'an authenticated session can enroll a passkey without re-entering its password');

  const before = await (await call('/api/workspace')).json();
  const demo = JSON.parse(readFileSync(new URL('../docs/demo/demo-workspace.json', import.meta.url), 'utf8'));
  const legacy = structuredClone(demo);
  legacy.transactions = legacy.transactions.filter((row) => !row.balanceAdjustment).map(({ accountId, ...row }) => row);
  assert.equal(admissibleWorkspace(legacy), true, 'version-1 workspaces without adjustment markers remain valid');
  const sourced = structuredClone(legacy);
  sourced.investments = [];
  sourced.accounts = [{ id: 'cash-1', name: 'Daily wallet', type: 'cash' }];
  sourced.transactions[0].accountId = 'cash-1';
  assert.equal(admissibleWorkspace(sourced), true, 'liquid accounts and linked transactions are accepted');
  sourced.transactions[0].accountId = 'missing';
  assert.equal(admissibleWorkspace(sourced), false, 'transactions cannot reference a missing liquid account');
  sourced.transactions[0].accountId = 'cash-1';
  sourced.assetCategories = [{ id: 'cash-category', name: 'Cash', type: 'cash' }];
  sourced.assetGroups = [{ id: 'wallets', categoryId: 'cash-category', name: 'Wallets' }];
  sourced.accounts[0].categoryId = 'cash-category';
  sourced.accounts[0].groupId = 'wallets';
  assert.equal(admissibleWorkspace(sourced), true, 'optional asset categories and subcategories are accepted');
  sourced.unassignedCashAssignment = { categoryId: 'cash-category', groupId: 'wallets' };
  assert.equal(admissibleWorkspace(sourced), true, 'aggregate unassigned cash can use a managed category and subcategory');
  sourced.unassignedCashAssignment.groupId = 'missing';
  assert.equal(admissibleWorkspace(sourced), false, 'unassigned cash cannot reference a missing subcategory');
  sourced.unassignedCashAssignment.groupId = 'wallets';
  sourced.accounts[0].groupId = 'missing';
  assert.equal(admissibleWorkspace(sourced), false, 'asset records cannot reference a missing subcategory');
  sourced.accounts[0].groupId = 'wallets';
  const saved = await call('/api/workspace', { method: 'PUT', body: { revision: before.revision, workspace: demo } });
  assert.equal(saved.status, 200);
  const { revision } = await saved.json();
  assert.equal(revision, before.revision + 1);

  const stale = await call('/api/workspace', { method: 'PUT', body: { revision: before.revision, workspace: demo } });
  assert.equal(stale.status, 409, 'a stale revision is rejected');

  const back = await (await call('/api/workspace')).json();
  assert.equal(back.workspace.transactions.length, demo.transactions.length);
  assert.equal(back.workspace.investments.length, demo.investments.length);
  assert.equal(back.workspace.transactions.find((row) => row.balanceAdjustment)?.category, 'Balance adjustment');

  const broken = await call('/api/workspace', { method: 'PUT', body: { revision, workspace: { ...demo, version: 2 } } });
  assert.equal(broken.status, 400, 'an invalid workspace is rejected');
  const falseMarker = structuredClone(demo);
  falseMarker.transactions[0].balanceAdjustment = false;
  assert.equal((await call('/api/workspace', { method: 'PUT', body: { revision, workspace: falseMarker } })).status, 400, 'a false adjustment marker is rejected');
});
