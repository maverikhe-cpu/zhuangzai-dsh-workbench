#!/usr/bin/env node
/**
 * 一起装 (yqz) MCP stdio ↔ Streamable HTTP 代理。
 *
 * DSH 的 MCP 客户端只支持静态请求头，而一起装 MCP 的访问令牌会过期，因此用这个
 * 本地代理：DSH 以 stdio 方式启动本进程，本进程把 JSON-RPC 逐条转发到
 * https://api.1qizhuang.com/api/mcp/mcp，并自动携带 / 刷新 OAuth Bearer 令牌。
 *
 * 令牌由 yqz-auth.mjs 管理（node yqz-auth.mjs login 登录一次即可）。
 * 环境变量：YQZ_MCP_URL（覆盖端点）、YQZ_TOKEN_FILE（覆盖令牌文件）。
 */
import readline from 'node:readline';
import { getAccessToken, refreshAccessToken, MCP_URL } from './yqz-auth.mjs';

const ENDPOINT = process.env.YQZ_MCP_URL || MCP_URL;
const DEFAULT_PROTOCOL_VERSION = '2025-06-18';
const REQUEST_TIMEOUT_MS = Number(process.env.YQZ_ATTEMPT_TIMEOUT_MS || 30_000);
// 一起装的 CDN 边缘节点偶尔会超时/重置连接，只重试网络层错误（工具均为只读，重复调用安全）。
const MAX_NETWORK_RETRIES = 1;
const TOTAL_TIMEOUT_MS = Number(process.env.YQZ_TOTAL_TIMEOUT_MS || 45_000);

let sessionId = null;
let protocolVersion = DEFAULT_PROTOCOL_VERSION;
let shuttingDown = false;

const log = (...args) => console.error('[yqz-mcp-proxy]', ...args);
const isRequest = (msg) => msg && (typeof msg.id === 'number' || typeof msg.id === 'string');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function emit(payload) {
  if (shuttingDown) return;
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function emitRaw(text) {
  // 一条 SSE data 里可能塞多个 JSON-RPC 消息？规范上不会，但稳妥处理。
  const trimmed = text.trim();
  if (!trimmed) return;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    log('无法解析服务端消息:', trimmed.slice(0, 200));
    return;
  }
  if (Array.isArray(parsed)) parsed.forEach(emit);
  else emit(parsed);
}

async function postToRemote(message) {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let netAttempts = 0;
  let authAttempts = 0;
  let sessionResets = 0;
  for (;;) {
    let token;
    try {
      token = await getAccessToken();
    } catch (err) {
      throw new Error(`一起装 MCP 未登录或令牌不可用：${err.message}`);
    }
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
      'MCP-Protocol-Version': protocolVersion,
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()))),
      });
    } catch (err) {
      netAttempts += 1;
      if (netAttempts <= MAX_NETWORK_RETRIES && Date.now() + 600 < deadline) {
        const wait = Math.min(4000, 600 * 2 ** (netAttempts - 1));
        log(
          `网络错误（第 ${netAttempts}/${MAX_NETWORK_RETRIES + 1} 次）: ${err.cause?.code || err.message}，${wait}ms 后重试…`,
        );
        await sleep(wait);
        continue;
      }
      const exhausted = new Error(
        `一起装连接暂不可用；代理已重试耗尽（最多 ${MAX_NETWORK_RETRIES} 次），请停止本轮连接调用，不换业务工具重试。原因: ${err.cause?.code || err.message}`,
      );
      exhausted.retryExhausted = true;
      throw exhausted;
    }

    if (res.status === 401) {
      await res.body?.cancel?.().catch?.(() => {});
      authAttempts += 1;
      if (authAttempts <= 2) {
        log('返回 401，刷新访问令牌后重试…');
        try {
          await refreshAccessToken();
        } catch (err) {
          throw new Error(`令牌刷新失败，请重新运行 node yqz-auth.mjs login（${err.message}）`);
        }
        continue;
      }
      throw new Error('一起装 MCP 认证失败（401），令牌可能已被撤销，请重新登录。');
    }

    if (res.status === 404 && sessionId) {
      await res.body?.cancel?.().catch?.(() => {});
      // 会话过期：清掉会话 id 再试一次（服务端若是无状态会直接成功）。
      log('会话已过期（404），重置 session 后重试…');
      sessionId = null;
      sessionResets += 1;
      if (sessionResets <= 2) continue;
    }

    const sid = res.headers.get('mcp-session-id');
    if (sid) sessionId = sid;
    return res;
  }
}

function parseSseText(text, id) {
  let dataLines = [];
  const flush = () => {
    if (dataLines.length) {
      emitRaw(dataLines.join('\n'));
      dataLines = [];
    }
  };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith(':')) continue;
    const m = /^data:\s?(.*)$/.exec(line);
    if (m) dataLines.push(m[1]);
  }
  flush();
  void id;
}

async function pumpResponse(res, message) {
  if (res.status === 202 || res.status === 204) {
    await res.body?.cancel?.().catch?.(() => {});
    return;
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    await res.text().then((text) => parseSseText(text, message.id));
    return;
  }
  const text = await res.text();
  if (!res.ok) {
    if (text.trim()) {
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* 非 JSON 错误体 */
      }
      if (parsed && (parsed.error || parsed.jsonrpc)) {
        emit(parsed);
        return;
      }
    }
    if (isRequest(message)) {
      emit({
        jsonrpc: '2.0',
        id: message.id,
        error: { code: -32000, message: `一起装 MCP 返回 HTTP ${res.status}: ${text.slice(0, 400)}` },
      });
    }
    return;
  }
  if (!text.trim()) return;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) parsed.forEach(emit);
    else emit(parsed);
  } catch {
    log('无法解析响应体:', text.slice(0, 200));
  }
}

async function handleMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.method === 'initialize') {
    protocolVersion = message.params?.protocolVersion || DEFAULT_PROTOCOL_VERSION;
    sessionId = null;
  }
  const res = await postToRemote(message);
  await pumpResponse(res, message);
}

async function main() {
  // 启动即校验令牌，未登录时给出清晰提示（failOnStartupError=false 时 DSH 不会崩）。
  try {
    await getAccessToken();
    log(`已就绪，转发到 ${ENDPOINT}`);
  } catch (err) {
    log(`未就绪：${err.message}`);
    log('请运行本插件 connector/yqz-auth.mjs login 完成授权');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      log('收到无法解析的 JSON-RPC 行:', trimmed.slice(0, 200));
      return;
    }
    handleMessage(message).catch((err) => {
      log('处理消息出错:', err.message);
      if (isRequest(message)) {
        emit({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32603, message: String(err.message || err), ...(err.retryExhausted ? { data: { retryable: false, retryExhausted: true } } : {}) },
        });
      }
    });
  });
  rl.on('close', () => {
    shuttingDown = true;
    process.exit(0);
  });
}

function shutdown(signal) {
  log(`收到 ${signal}，退出`);
  shuttingDown = true;
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  log('代理启动失败:', err.message);
  process.exit(1);
});
