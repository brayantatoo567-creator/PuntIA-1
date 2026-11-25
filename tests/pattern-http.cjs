'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { Pool } = require('pg');
const path = require('node:path');

const root = path.join(__dirname, '..');
const apiKey = 'sk-' + crypto.randomBytes(24).toString('hex');
const adminPassword = crypto.randomBytes(24).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');
const masterKey = crypto.randomBytes(32).toString('hex');
const patternText = [
  'Patrón de amigurumi de prueba para verificar la ruta de generación de TEJILUME.',
  'Materiales: hilo de algodón, gancho adecuado, relleno y aguja lanera.',
  'Abreviaturas: AM = anillo mágico, pb = punto bajo, aum = aumento, dis = disminución.',
  'Cabeza:',
  'R1: 6 pb en AM (6)',
  'R2: 6 aum (12)',
  'R3: 12 pb (12)',
  'R4: 6 dis (6)',
  'Rellenar antes de cerrar y rematar. Ensamblar con costura firme.'
].join('\n');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}
function waitForServer(url, child) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = async () => {
      if (child.exitCode !== null) return reject(new Error('TEJILUME server exited before becoming healthy.'));
      try {
        const response = await fetch(url);
        if (response.ok) return resolve();
      } catch {}
      if (Date.now() - started > 30000) return reject(new Error('TEJILUME server health timeout.'));
      setTimeout(poll, 300);
    };
    poll();
  });
}

(async () => {
  let mockCalls = 0;
  let authorization = '';
  const mock = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/responses') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    mockCalls++;
    authorization = req.headers.authorization || '';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'resp_tejilume_mock',
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: 'completed',
      model: 'gpt-4o-mini',
      output_text: patternText,
      output: [{ id: 'msg_tejilume_mock', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', annotations: [], text: patternText }] }]
    }));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const mockPort = mock.address().port;
  const appPort = await freePort();
  const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/tejilume_test';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      RENDER: 'true',
      PORT: String(appPort),
      DATABASE_URL: databaseUrl,
      ADMIN_PASSWORD: adminPassword,
      SESSION_SECRET: sessionSecret,
      MASTER_KEY: masterKey,
      OPENAI_API_KEY: apiKey,
      OPENAI_BASE_URL: 'http://127.0.0.1:' + mockPort + '/v1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const base = 'http://127.0.0.1:' + appPort;
    await waitForServer(base + '/api/health', child);
    await pool.query("UPDATE tejilume_admin_settings SET key_ciphertext=NULL,key_iv=NULL,key_tag=NULL,key_last4=NULL,ai_enabled=TRUE,daily_limit=1 WHERE id=1");
    await pool.query("DELETE FROM tejilume_ai_usage WHERE usage_date=(NOW() AT TIME ZONE 'UTC')::date");
    const first = await fetch(base + '/api/puntia/generate-pattern', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'pulpo pequeño', level: 'Principiante', height: '10 cm', style: 'clásico' })
    });
    assert.equal(first.status, 200, 'pattern generation route should return success through the OpenAI client');
    const result = await first.json();
    assert.ok(result.pattern && result.pattern.length > 80);
    assert.equal(authorization, 'Bearer ' + apiKey, 'server must send the configured key to the provider');
    assert.equal(JSON.stringify(result).includes(apiKey), false, 'API response must not expose the key');

    const second = await fetch(base + '/api/puntia/generate-pattern', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'otro amigurumi', level: 'Principiante' })
    });
    assert.equal(second.status, 429, 'the configured daily limit must block the next generation');
    assert.equal(mockCalls, 1, 'the provider must be called only once');
    const today = await pool.query("SELECT generations FROM tejilume_ai_usage WHERE usage_date=(NOW() AT TIME ZONE 'UTC')::date");
    assert.equal(Number(today.rows[0].generations), 1, 'one successful generation request increments the UTC counter exactly once');
    assert.equal(logs.includes(apiKey), false, 'server logs must not expose the API key');
    console.log('Pattern HTTP integration: actual TEJILUME route + OpenAI SDK mock, one-count increment, response/log redaction and daily-limit rejection passed.');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => mock.close(resolve));
    await pool.end();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
