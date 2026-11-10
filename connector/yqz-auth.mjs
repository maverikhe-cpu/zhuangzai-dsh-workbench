#!/usr/bin/env node
/**
 * 一起装 (yqz) MCP OAuth 2.0 helper.
 *
 * The 一起装 MCP endpoint (https://api.1qizhuang.com/api/mcp/mcp) only accepts a
 * Bearer token. DSH's built-in MCP client supports static headers only, so this
 * module performs the OAuth authorization-code + PKCE dance once, stores the
 * refreshable token record, and refreshes it transparently afterwards.
 *
 * Commands (run with node):
 *   node yqz-auth.mjs login     # browser login -> saves token record
 *   node yqz-auth.mjs status    # show token status
 *   node yqz-auth.mjs refresh   # force a refresh (needs a valid refresh_token)
 *   node yqz-auth.mjs token     # print a currently valid access token
 *
 * Env overrides: YQZ_MCP_BASE (default https://api.1qizhuang.com/api/mcp),
 *                YQZ_TOKEN_FILE (default ~/.config/zhuangzai/yqz-oauth.json)
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BASE = (process.env.YQZ_MCP_BASE || 'https://api.1qizhuang.com/api/mcp').replace(/\/+$/, '');
export const MCP_URL = process.env.YQZ_MCP_URL || `${BASE}/mcp`;
export const TOKEN_PATH = process.env.YQZ_TOKEN_FILE || path.join(os.homedir(), '.config', 'zhuangzai', 'yqz-oauth.json');
export const REDIRECT_URI = process.env.YQZ_REDIRECT_URI || 'http://127.0.0.1:33418/oauth/callback';

const AUTH_URL = `${BASE}/oauth/authorize`;
const TOKEN_URL = `${BASE}/oauth/token`;
const REGISTER_URL = `${BASE}/oauth/register`;
const HTTP_TIMEOUT_MS = Number(process.env.YQZ_HTTP_TIMEOUT_MS || 30000);

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function log(...args) {
  console.error('[yqz-auth]', ...args);
}

/** fetch with a hard timeout and a couple of retries for the flaky CDN edges. */
export async function fetchWithRetry(url, options = {}, { retries = 3, timeoutMs = HTTP_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 500 && attempt < retries) {
        lastErr = new Error(`HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function readRecord() {
  try {
    return JSON.parse(await readFile(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function writeRecord(record) {
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  const tmp = `${TOKEN_PATH}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(record, null, 2), { mode: 0o600 });
  await rename(tmp, TOKEN_PATH);
}

async function registerClient() {
  const res = await fetchWithRetry(REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'DeepSeek Harness',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`client registration failed (${res.status}): ${text}`);
  const body = JSON.parse(text);
  if (!body.client_id) throw new Error(`client registration returned no client_id: ${text}`);
  return body.client_id;
}

async function exchangeCode({ code, verifier, clientId }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
  });
  const res = await fetchWithRetry(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token exchange failed (${res.status}): ${text}`);
  return { ...JSON.parse(text), client_id: clientId, redirect_uri: REDIRECT_URI };
}

function toRecord(tok) {
  const now = Date.now();
  const expiresIn = Number(tok.expires_in || 3600);
  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || null,
    token_type: tok.token_type || 'Bearer',
    scope: tok.scope || '',
    expires_in: expiresIn,
    expires_at: now + expiresIn * 1000,
    obtained_at: new Date(now).toISOString(),
    client_id: tok.client_id,
    redirect_uri: tok.redirect_uri || REDIRECT_URI,
    token_endpoint: TOKEN_URL,
  };
}

let refreshPromise = null;

/** Force a refresh, sharing an in-flight refresh with other callers. */
export function refreshAccessToken() {
  if (!refreshPromise) {
    // Keep the whole read/request/write operation shared, including the rename.
    // Clear failures too so the next call can retry instead of reusing a rejection.
    refreshPromise = refreshStoredAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function refreshStoredAccessToken() {
  const record = await readRecord();
  if (!record?.refresh_token) throw new Error('no refresh_token; run: node yqz-auth.mjs login');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: record.refresh_token,
    client_id: record.client_id,
  });
  const res = await fetchWithRetry(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`refresh failed (${res.status}): ${text}`);
  const next = toRecord({ ...JSON.parse(text), client_id: record.client_id });
  next.refresh_token = JSON.parse(text).refresh_token || record.refresh_token;
  await writeRecord(next);
  log('access token refreshed, expires', new Date(next.expires_at).toISOString());
  return next.access_token;
}

/** Return a valid access token, refreshing it when it is about to expire. */
export async function getAccessToken() {
  const record = await readRecord();
  if (!record?.access_token) throw new Error('not logged in; run: node yqz-auth.mjs login');
  if (record.expires_at && record.expires_at - Date.now() > 120_000) return record.access_token;
  return refreshAccessToken();
}

export async function login() {
  const clientId = await registerClient();
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(16));
  const authUrl = new URL(AUTH_URL);
  authUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  }).toString();

  const port = Number(new URL(REDIRECT_URI).port || 80);
  const cbPath = new URL(REDIRECT_URI).pathname;

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname !== cbPath) {
        res.writeHead(404).end('not found');
        return;
      }
      const err = url.searchParams.get('error');
      const gotState = url.searchParams.get('state');
      const gotCode = url.searchParams.get('code');
      const reply = (status, html) => {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      };
      if (err) {
        reply(400, `<h3>授权失败</h3><p>${err}</p><p>${url.searchParams.get('error_description') || ''}</p>`);
        server.close();
        reject(new Error(`authorization failed: ${err}`));
        return;
      }
      if (gotState !== state || !gotCode) {
        reply(400, '<h3>state 校验失败</h3>');
        server.close();
        reject(new Error('state mismatch or missing code'));
        return;
      }
      reply(200, '<h3>授权成功 ✅</h3><p>可以关闭此页面，回到 DeepSeek Harness 继续。</p>');
      server.close();
      resolve(gotCode);
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      log(`listening on ${REDIRECT_URI}`);
      log('opening browser for 一起装 authorization …');
      log('if the browser did not open, visit manually:\n' + authUrl.toString());
      if (process.platform === 'darwin') execFile('open', [authUrl.toString()], (e) => e && log('open failed:', e.message));
      else if (process.platform === 'linux') execFile('xdg-open', [authUrl.toString()], (e) => e && log('open failed:', e.message));
      else log('请复制上面的授权链接到浏览器打开。');
    });
    setTimeout(() => {
      server.close();
      reject(new Error('login timed out after 15 minutes'));
    }, 15 * 60 * 1000).unref();
  });

  const record = toRecord(await exchangeCode({ code, verifier, clientId }));
  await writeRecord(record);
  log('login complete; token saved to', TOKEN_PATH);
  return record;
}

export async function status() {
  const record = await readRecord();
  if (!record) return { logged_in: false, token_file: TOKEN_PATH };
  const left = Math.round((record.expires_at - Date.now()) / 1000);
  return {
    logged_in: true,
    token_file: TOKEN_PATH,
    expires_at: new Date(record.expires_at).toISOString(),
    expires_in_seconds: left,
    has_refresh_token: Boolean(record.refresh_token),
    client_id: record.client_id,
  };
}

async function main() {
  const cmd = process.argv[2] || 'status';
  if (cmd === 'login') {
    await login();
  } else if (cmd === 'refresh') {
    await refreshAccessToken();
  } else if (cmd === 'token') {
    process.stdout.write((await getAccessToken()) + '\n');
  } else if (cmd === 'status') {
    console.log(JSON.stringify(await status(), null, 2));
  } else {
    log('unknown command:', cmd, '(use login | status | refresh | token)');
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    log('ERROR:', err.message);
    process.exit(1);
  });
}
