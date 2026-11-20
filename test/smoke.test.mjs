// End-to-end smoke test: builds nothing itself (run `npm run build` first), starts the real server on a throwaway
// SQLite database, provisions an account and walks through sign-in, password change and a workspace save.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  const before = await (await call('/api/workspace')).json();
  const demo = JSON.parse(readFileSync(new URL('../docs/demo/demo-workspace.json', import.meta.url), 'utf8'));
  const saved = await call('/api/workspace', { method: 'PUT', body: { revision: before.revision, workspace: demo } });
  assert.equal(saved.status, 200);
  const { revision } = await saved.json();
  assert.equal(revision, before.revision + 1);

  const stale = await call('/api/workspace', { method: 'PUT', body: { revision: before.revision, workspace: demo } });
  assert.equal(stale.status, 409, 'a stale revision is rejected');

  const back = await (await call('/api/workspace')).json();
  assert.equal(back.workspace.transactions.length, demo.transactions.length);
  assert.equal(back.workspace.investments.length, demo.investments.length);

  const broken = await call('/api/workspace', { method: 'PUT', body: { revision, workspace: { ...demo, version: 2 } } });
  assert.equal(broken.status, 400, 'an invalid workspace is rejected');
});
