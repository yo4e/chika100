import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after, before } from 'node:test';
import { createApp, dailyPayload, getJapanDate } from '../src/server.js';

let server;
let baseUrl;

before(async () => {
  process.env.NODE_ENV = 'test';
  server = http.createServer(createApp({
    version: 'test-version',
    buildId: 'public-build',
    now: () => new Date('2026-08-01T15:30:00.000Z'),
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('Japan date changes at midnight JST', () => {
  assert.equal(getJapanDate(new Date('2026-08-01T14:59:59Z')), '2026-08-01');
  assert.equal(getJapanDate(new Date('2026-08-01T15:00:00Z')), '2026-08-02');
});

test('daily payload is deterministic for the same Japan date', () => {
  const morning = dailyPayload(new Date('2026-08-02T01:00:00Z'));
  const evening = dailyPayload(new Date('2026-08-02T14:59:59Z'));
  assert.deepEqual(morning, evening);
  assert.equal(morning.date, '2026-08-02');
  assert.equal(morning.seedVersion, 1);
  assert.equal(typeof morning.seed, 'number');
});

test('health, daily, and config APIs expose only public data', async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).status, 'ok');

  const dailyResponse = await fetch(`${baseUrl}/api/daily`);
  assert.equal(dailyResponse.status, 200);
  assert.equal((await dailyResponse.json()).date, '2026-08-02');

  const configResponse = await fetch(`${baseUrl}/api/config`);
  const config = await configResponse.json();
  assert.deepEqual(config, {
    version: 'test-version',
    buildId: 'public-build',
    dailyEnabled: true,
    serverDate: '2026-08-02',
  });
  assert.equal(configResponse.headers.get('x-content-type-options'), 'nosniff');
  assert.match(configResponse.headers.get('content-security-policy'), /default-src 'self'/);
});

test('the static game is served and unknown routes are safe', async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /地下百階まで/);

  const missingApi = await fetch(`${baseUrl}/api/nope`);
  assert.equal(missingApi.status, 404);
  assert.deepEqual(await missingApi.json(), { error: 'not_found' });

  const missingFile = await fetch(`${baseUrl}/not-present.js`);
  assert.equal(missingFile.status, 404);
  assert.deepEqual(await missingFile.json(), { error: 'not_found' });
});

test('write methods are rejected without processing a body', async () => {
  const response = await fetch(`${baseUrl}/api/daily`, { method: 'POST', body: 'x'.repeat(1024) });
  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: 'method_not_allowed' });
});
