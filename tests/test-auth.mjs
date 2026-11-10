import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

// Each test gets an isolated module, fake OAuth endpoint and temporary token file.
// No real account, network access or credentials are used.
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'yqz-auth-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const tokenPath = path.join(dir, 'tokens.json');
  const initial = {
    access_token: 'test-old-access',
    refresh_token: 'test-old-refresh',
    client_id: 'test-client',
    expires_at: Date.now() + 60_000,
    ...overrides,
  };
  await writeFile(tokenPath, JSON.stringify(initial), { mode: 0o600 });
  const saved = { YQZ_TOKEN_FILE: process.env.YQZ_TOKEN_FILE, YQZ_MCP_BASE: process.env.YQZ_MCP_BASE };
  let auth;
  try {
    process.env.YQZ_TOKEN_FILE = tokenPath;
    process.env.YQZ_MCP_BASE = 'https://oauth.example.invalid';
    const url = new URL('../connector/yqz-auth.mjs', import.meta.url);
    url.searchParams.set('test', randomUUID());
    auth = await import(url.href);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const requests = [];
  let respond = () => Response.json({ access_token: 'test-new-access', expires_in: 3600 });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://oauth.example.invalid/oauth/token');
    assert.equal(options.method, 'POST');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('client_id'), 'test-client');
    requests.push(body);
    // Let overlapping callers reach the same in-flight refresh.
    await delay(25);
    return respond();
  });
  return {
    auth, dir, tokenPath, initial, requests,
    respond: (callback) => { respond = callback; },
    read: async () => JSON.parse(await readFile(tokenPath, 'utf8')),
  };
}

test('ten expiring-token callers share one refresh and persisted token', async (t) => {
  const f = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => f.auth.getAccessToken()));
  assert.deepEqual(results, Array.from({ length: 10 }, () => ({ status: 'fulfilled', value: 'test-new-access' })));
  assert.equal(f.requests.length, 1);
  const record = await f.read();
  assert.equal(record.access_token, 'test-new-access');
  assert.equal(record.refresh_token, f.initial.refresh_token);
  assert.ok(record.expires_at > Date.now() + 120_000);
  if (process.platform !== 'win32') assert.equal((await stat(f.tokenPath)).mode & 0o777, 0o600);
  assert.deepEqual(await readdir(f.dir), ['tokens.json']);
  assert.equal(await f.auth.getAccessToken(), 'test-new-access');
  assert.equal(f.requests.length, 1);
});

test('concurrent forced refreshes share a promise and later refreshes use the rotated token', async (t) => {
  const f = await fixture(t, { expires_at: Date.now() + 3_600_000 });
  f.respond(() => Response.json({ access_token: 'test-new-access', refresh_token: 'test-rotated-refresh', expires_in: 3600 }));
  const pending = Array.from({ length: 10 }, () => f.auth.refreshAccessToken());
  // Attach rejection handlers before checking identity so regressions do not leak rejections.
  const results = await Promise.allSettled(pending);
  assert.ok(pending.every((promise) => promise === pending[0]));
  assert.ok(results.every((result) => result.status === 'fulfilled' && result.value === 'test-new-access'));
  assert.equal(f.requests.length, 1);
  assert.equal((await f.read()).refresh_token, 'test-rotated-refresh');
  f.respond(() => Response.json({ access_token: 'test-second-access', expires_in: 3600 }));
  assert.equal(await f.auth.refreshAccessToken(), 'test-second-access');
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].get('refresh_token'), 'test-rotated-refresh');
  assert.equal((await f.read()).refresh_token, 'test-rotated-refresh');
});

test('automatic and forced refresh callers join the same operation', async (t) => {
  const f = await fixture(t);
  const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
    i % 2 ? f.auth.getAccessToken() : f.auth.refreshAccessToken()));
  assert.deepEqual(results, Array.from({ length: 10 }, () => ({ status: 'fulfilled', value: 'test-new-access' })));
  assert.equal(f.requests.length, 1);
});

for (const [name, response, message] of [
  ['HTTP rejection', () => Response.json({ error: 'invalid_grant' }, { status: 400 }), /refresh failed \(400\)/],
  ['invalid JSON', () => new Response('not json'), /JSON|Unexpected token/],
]) {
  test(`${name} is shared, leaves the record unchanged, and allows a later retry`, async (t) => {
    const f = await fixture(t);
    f.respond(response);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => f.auth.getAccessToken()));
    assert.equal(f.requests.length, 1);
    assert.ok(results.every((result) => result.status === 'rejected' && message.test(result.reason.message)));
    assert.ok(results.every((result) => result.reason === results[0].reason));
    assert.deepEqual(await f.read(), f.initial);
    f.respond(() => Response.json({ access_token: 'test-recovered-access', expires_in: 3600 }));
    assert.equal(await f.auth.getAccessToken(), 'test-recovered-access');
    assert.equal(f.requests.length, 2);
  });
}

test('missing refresh token does not poison the next attempt', async (t) => {
  const f = await fixture(t, { refresh_token: null });
  await assert.rejects(f.auth.refreshAccessToken(), /no refresh_token/);
  assert.equal(f.requests.length, 0);
  await writeFile(f.tokenPath, JSON.stringify({ ...f.initial, refresh_token: 'test-added-refresh' }));
  assert.equal(await f.auth.refreshAccessToken(), 'test-new-access');
  assert.equal(f.requests.length, 1);
});

test('a failed token-file rename rejects all waiters and allows a later retry', async (t) => {
  const f = await fixture(t);
  f.respond(async () => {
    // Replace only the test file with a directory after the refresh read.
    // The atomic rename must fail, rather than reporting an unpersisted token.
    await rm(f.tokenPath, { recursive: true, force: true });
    await mkdir(f.tokenPath, { recursive: true });
    return Response.json({ access_token: 'test-unpersisted-access', expires_in: 3600 });
  });
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => f.auth.refreshAccessToken()));
  assert.equal(f.requests.length, 1);
  assert.ok(results.every((result) => result.status === 'rejected' && result.reason.syscall === 'rename'));
  assert.ok(results.every((result) => result.reason === results[0].reason));
  await rm(f.tokenPath, { recursive: true });
  await writeFile(f.tokenPath, JSON.stringify(f.initial), { mode: 0o600 });
  f.respond(() => Response.json({ access_token: 'test-recovered-access', expires_in: 3600 }));
  assert.equal(await f.auth.refreshAccessToken(), 'test-recovered-access');
  assert.equal(f.requests.length, 2);
  assert.equal((await f.read()).access_token, 'test-recovered-access');
  assert.deepEqual(await readdir(f.dir), ['tokens.json']);
});

test('a sufficiently fresh token does not call the OAuth endpoint', async (t) => {
  const f = await fixture(t, { expires_at: Date.now() + 3_600_000 });
  assert.equal(await f.auth.getAccessToken(), 'test-old-access');
  assert.equal(f.requests.length, 0);
  assert.deepEqual(await f.read(), f.initial);
});
