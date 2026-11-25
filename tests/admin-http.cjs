'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { Pool } = require('pg');
const { createAdminPanel } = require('../admin-panel.cjs');

process.env.NODE_ENV = 'production';
process.env.RENDER = 'true';
const testPassword = crypto.randomBytes(24).toString('hex');
process.env.ADMIN_PASSWORD = testPassword;
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
process.env.MASTER_KEY = crypto.randomBytes(32).toString('hex');
process.env.DATABASE_URL ||= 'postgres://postgres:postgres@127.0.0.1:5432/tejilume_test';
delete process.env.OPENAI_API_KEY;
const validKey = 'sk-' + crypto.randomBytes(24).toString('hex');
const invalidKey = 'sk-' + crypto.randomBytes(24).toString('hex');
const quotaKey = 'sk-' + crypto.randomBytes(24).toString('hex');
process.env.TEST_INVALID_KEY = invalidKey;
process.env.TEST_QUOTA_KEY = quotaKey;

class FakeOpenAI {
  constructor({ apiKey }) {
    this.responses = { create: async () => {
      if (apiKey === process.env.TEST_INVALID_KEY) throw Object.assign(new Error('redacted test failure'), { status: 401 });
      if (apiKey === process.env.TEST_QUOTA_KEY) throw Object.assign(new Error('insufficient_quota'), { status: 429, code: 'insufficient_quota' });
      return { output_text: 'TEJILUME_OK' };
    }};
  }
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  const admin = createAdminPanel({ app, pool, publicDir: require('node:path').join(__dirname, '..', 'public'), OpenAIClient: FakeOpenAI });
  app.post('/quota-test', admin.aiMiddleware, async (req, res) => {
    if (!(await admin.consumeGenerationQuota(req, res))) return;
    res.json({ ok: true, counted: true });
  });
  await admin.init();
  await pool.query('DELETE FROM tejilume_admin_login_attempts');
  await pool.query('DELETE FROM tejilume_ai_usage');
  await pool.query("UPDATE tejilume_admin_settings SET key_ciphertext=NULL,key_iv=NULL,key_tag=NULL,key_last4=NULL,ai_enabled=TRUE,daily_limit=25 WHERE id=1");
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const post = (path, body, ip, cookie) => fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}), ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body)
  });
  const get = (path, cookie) => fetch(base + path, { headers: cookie ? { cookie } : {} });
  let capturedLogs = '';
  const originalError = console.error;
  console.error = (...args) => { capturedLogs += args.join(' ') + '\n'; };

  try {
    const setup = await (await get('/api/admin/setup-status')).json();
    assert.equal(setup.configured, true, 'required configuration and PostgreSQL must be detected');

    for (let i = 1; i <= 5; i++) {
      const bad = await post('/api/admin/login', { username: 'admin', password: 'wrong-password' }, '203.0.113.77');
      assert.equal(bad.status, i === 5 ? 429 : 401, 'fifth failed attempt must lock the IP');
    }
    const locked = await post('/api/admin/login', { username: 'admin', password: testPassword }, '203.0.113.77');
    assert.equal(locked.status, 429, 'locked IP remains blocked');

    const login = await post('/api/admin/login', { username: 'admin', password: testPassword }, '203.0.113.78');
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert.match(setCookie, /SameSite=None/i);
    assert.match(setCookie, /Max-Age=43200/i);
    const cookie = setCookie.split(';')[0];
    assert.equal(cookie.includes(validKey), false, 'session cookie must not contain the API key');
    const statusBefore = await get('/api/admin/status', cookie);
    assert.equal(statusBefore.status, 200);
    assert.equal((await statusBefore.json()).keySaved, false);

      const saved = await post('/api/admin/key', { apiKey: validKey }, null, cookie);
    assert.equal(saved.status, 200);
    const savedJson = await saved.json();
    assert.equal(savedJson.ok, true);
    assert.equal(savedJson.keyLast4, validKey.slice(-4));
    assert.equal(JSON.stringify(savedJson).includes(validKey), false);

    const invalid = await post('/api/admin/key', { apiKey: invalidKey }, null, cookie);
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /Clave inválida/i);
    const quota = await post('/api/admin/key', { apiKey: quotaKey }, null, cookie);
    assert.equal(quota.status, 429);
    assert.match((await quota.json()).error, /cuota/i);

    const persistedPool = new Pool({ connectionString: process.env.DATABASE_URL });
    const persisted = await persistedPool.query('SELECT key_ciphertext,key_iv,key_tag,key_last4 FROM tejilume_admin_settings WHERE id=1');
    assert.equal(persisted.rows[0].key_last4, validKey.slice(-4));
    assert.ok(persisted.rows[0].key_ciphertext && persisted.rows[0].key_iv && persisted.rows[0].key_tag);
    assert.equal(persisted.rows[0].key_ciphertext.includes(validKey), false);
    await persistedPool.end();

    const off = await post('/api/admin/settings', { aiEnabled: false, dailyLimit: 1 }, null, cookie);
    assert.equal(off.status, 200);
    assert.equal((await post('/quota-test', {}, '203.0.113.79')).status, 503, 'AI-off must block generation');
    const on = await post('/api/admin/settings', { aiEnabled: true, dailyLimit: 1 }, null, cookie);
    assert.equal(on.status, 200);

    const utcDate = await pool.query("SELECT (NOW() AT TIME ZONE 'UTC')::date AS today");
    await pool.query('DELETE FROM tejilume_ai_usage WHERE usage_date=$1', [utcDate.rows[0].today]);
    const simultaneous = await Promise.all([
      post('/quota-test', {}, '203.0.113.80'),
      post('/quota-test', {}, '203.0.113.81')
    ]);
    const codes = simultaneous.map(r => r.status).sort();
    assert.deepEqual(codes, [200, 429], 'two concurrent requests at a limit of one must admit exactly one');
    const usage = await pool.query('SELECT generations FROM tejilume_ai_usage WHERE usage_date=$1', [utcDate.rows[0].today]);
    assert.equal(Number(usage.rows[0].generations), 1, 'concurrent requests must increment exactly once');

    const statusResponse = await get('/api/admin/status', cookie);
    const statusJson = await statusResponse.json();
    assert.equal(statusJson.generationsToday, 1);
    assert.equal(statusJson.keyLast4, validKey.slice(-4));
    const tomorrow = await pool.query("SELECT (NOW() AT TIME ZONE 'UTC')::date + 1 AS tomorrow");
    await pool.query('INSERT INTO tejilume_ai_usage(usage_date,generations) VALUES($1,88) ON CONFLICT(usage_date) DO UPDATE SET generations=88', [tomorrow.rows[0].tomorrow]);
    const afterFutureUsage = await get('/api/admin/status', cookie);
    assert.equal((await afterFutureUsage.json()).generationsToday, 1, 'usage is scoped to the current UTC date; future-day rows do not leak into today');
    assert.equal(JSON.stringify(statusJson).includes(validKey), false);

    const logout = await post('/api/admin/logout', {}, null, cookie);
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/i);
    assert.equal((await get('/api/admin/status')).status, 401, 'without the cleared browser cookie, admin access must be denied');
    assert.equal(capturedLogs.includes(validKey), false, 'logs must not contain the API key');
    console.log('Admin HTTP integration: setup status, five-attempt lockout, Secure/HttpOnly cookie, save+test, invalid/quota errors, DB persistence, AI-off, concurrent atomic quota, and logout passed.');
  } finally {
    console.error = originalError;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
