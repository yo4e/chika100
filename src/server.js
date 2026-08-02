import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultPublicDir = path.join(moduleDir, 'public');
const startedAt = Date.now();

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

export function getJapanDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function hashSeed(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function dailyPayload(now = new Date()) {
  const date = getJapanDate(now);
  return {
    date,
    seed: hashSeed(`chika100:daily:v1:${date}`),
    label: `${date}便`,
    seedVersion: 1,
  };
}

function sendJson(response, statusCode, payload, method = 'GET') {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    ...securityHeaders,
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes['.json'],
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(method === 'HEAD' ? undefined : body);
}

function safeStaticPath(publicDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const requested = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(publicDir, requested);
  return resolved === publicDir || resolved.startsWith(`${publicDir}${path.sep}`) ? resolved : null;
}

async function serveStatic(response, method, publicDir, pathname) {
  let filePath = safeStaticPath(publicDir, pathname);
  if (!filePath) {
    sendJson(response, 400, { error: 'bad_request' }, method);
    return;
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
    await access(filePath);
    const fileInfo = await stat(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const shouldRevalidate = ['.html', '.css', '.js', '.webmanifest'].includes(extension);
    response.writeHead(200, {
      ...securityHeaders,
      'Cache-Control': shouldRevalidate ? 'no-cache' : 'public, max-age=3600',
      'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
      'Content-Length': fileInfo.size,
    });
    if (method === 'HEAD') response.end();
    else createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: 'not_found' }, method);
  }
}

export function createApp(options = {}) {
  const publicDir = path.resolve(options.publicDir ?? defaultPublicDir);
  const version = options.version ?? process.env.APP_VERSION ?? '1.0.0';
  const buildId = options.buildId ?? process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? 'local';

  return async function app(request, response) {
    const requestStartedAt = Date.now();
    const method = request.method ?? 'GET';
    let statusCode = 500;

    response.on('finish', () => {
      statusCode = response.statusCode;
      if (process.env.NODE_ENV !== 'test') {
        console.log(JSON.stringify({
          level: 'info',
          method,
          path: request.url?.split('?')[0],
          status: statusCode,
          durationMs: Date.now() - requestStartedAt,
        }));
      }
    });

    try {
      if (!['GET', 'HEAD'].includes(method)) {
        sendJson(response, 405, { error: 'method_not_allowed' }, method);
        return;
      }

      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === '/api/health') {
        sendJson(response, 200, {
          status: 'ok',
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        }, method);
        return;
      }
      if (url.pathname === '/api/daily') {
        sendJson(response, 200, dailyPayload(options.now?.() ?? new Date()), method);
        return;
      }
      if (url.pathname === '/api/config') {
        sendJson(response, 200, {
          version,
          buildId,
          dailyEnabled: true,
          serverDate: getJapanDate(options.now?.() ?? new Date()),
        }, method);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'not_found' }, method);
        return;
      }

      await serveStatic(response, method, publicDir, url.pathname);
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', message: 'request_failed', detail: error.message }));
      if (!response.headersSent) sendJson(response, 500, { error: 'internal_error' }, method);
      else response.destroy();
    }
  };
}

export function startServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const host = options.host ?? '0.0.0.0';
  const server = http.createServer(createApp(options));
  server.requestTimeout = 10_000;
  server.headersTimeout = 12_000;
  server.listen(port, host, () => {
    console.log(JSON.stringify({ level: 'info', message: 'server_started', host, port }));
  });
  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) startServer();
