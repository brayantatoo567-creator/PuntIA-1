'use strict';

const crypto = require('crypto');
const express = require('express');
const OpenAI = require('openai');

const COOKIE = 'tejilume_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
function parseMasterKey(raw) {
  const value = String(raw || '').trim();
  const key = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('MASTER_KEY debe representar exactamente 32 bytes (64 caracteres hexadecimales o Base64).');
  return key;
}
function encryptSecret(plain, masterKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}
function decryptSecret(record, masterKey) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
function cookieOptions(isProduction) {
  return { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/', maxAge: SESSION_MS };
}
function makeToken(secret) {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + SESSION_MS, nonce: crypto.randomBytes(24).toString('hex') })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + signature;
}
function verifyToken(token, secret) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(data.iat) && Number.isFinite(data.exp) && data.iat <= Date.now() + 30000 && data.exp > Date.now() && data.exp - data.iat <= SESSION_MS;
  } catch { return false; }
}
function getCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

function createAdminPanel({ app, pool, publicDir }) {
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  const sessionSecret = String(process.env.SESSION_SECRET || '');
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);
  const masterKey = process.env.MASTER_KEY ? parseMasterKey(process.env.MASTER_KEY) : null;
  if (isProduction && !pool) throw new Error('DATABASE_URL es obligatorio para el panel de administración.');
  if (isProduction && Buffer.byteLength(adminPassword, 'utf8') < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  if (isProduction && Buffer.byteLength(sessionSecret, 'utf8') < 32) throw new Error('SESSION_SECRET debe tener al menos 32 bytes.');
  if (isProduction && !masterKey) throw new Error('MASTER_KEY es obligatorio en producción.');

  async function init() {
    if (!pool) return;
    await pool.query(String.raw\`
      CREATE TABLE IF NOT EXISTS tejilume_admin_settings (
        id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        key_ciphertext TEXT,
        key_iv TEXT,
        key_tag TEXT,
        key_last4 VARCHAR(4),
        ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        daily_limit INTEGER NOT NULL DEFAULT 25 CHECK (daily_limit BETWEEN 1 AND 10000),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO tejilume_admin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
      CREATE TABLE IF NOT EXISTS tejilume_ai_usage (
        usage_date DATE PRIMARY KEY,
        generations INTEGER NOT NULL DEFAULT 0 CHECK (generations >= 0)
      );
      CREATE TABLE IF NOT EXISTS tejilume_admin_login_attempts (
        ip_hash TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL DEFAULT 0,
        window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        blocked_until TIMESTAMPTZ
      );
    \`);
  }

  function requireAdmin(req, res, next) {
    if (!sessionSecret || !verifyToken(getCookie(req, COOKIE), sessionSecret)) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    next();
  }
  function ipHash(req) {
    return crypto.createHmac('sha256', sessionSecret).update(String(req.ip || req.socket?.remoteAddress || 'unknown')).digest('hex');
  }
  async function attemptAllowed(req) {
    const result = await pool.query('SELECT blocked_until FROM tejilume_admin_login_attempts WHERE ip_hash=$1', [ipHash(req)]);
    return !result.rows[0]?.blocked_until || new Date(result.rows[0].blocked_until).getTime() <= Date.now();
  }
  async function recordFailure(req) {
    const key = ipHash(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO tejilume_admin_login_attempts(ip_hash) VALUES($1) ON CONFLICT(ip_hash) DO NOTHING', [key]);
      const result = await client.query('SELECT failed_count,window_started_at FROM tejilume_admin_login_attempts WHERE ip_hash=$1 FOR UPDATE', [key]);
      let count = Number(result.rows[0].failed_count || 0);
      const started = new Date(result.rows[0].window_started_at).getTime();
      if (Date.now() - started > LOCK_MS) count = 0;
      count += 1;
      const blocked = count >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MS) : null;
      await client.query('UPDATE tejilume_admin_login_attempts SET failed_count=$2,window_started_at=$3,blocked_until=$4 WHERE ip_hash=$1', [key, count, count === 1 ? new Date() : result.rows[0].window_started_at, blocked]);
      await client.query('COMMIT');
      return { blocked: Boolean(blocked), remaining: Math.max(0, MAX_ATTEMPTS - count) };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  const router = express.Router();
  router.post('/login', async (req, res) => {
    try {
      if (!pool || !adminPassword || !sessionSecret) return res.status(503).json({ error: 'Panel administrativo no configurado para este entorno.' });
      if (!(await attemptAllowed(req))) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' });
      const username = String(req.body?.username || '').slice(0, 80);
      const password = String(req.body?.password || '').slice(0, 500);
      if (!safeEqual(username, 'admin') || !safeEqual(password, adminPassword)) {
        const state = await recordFailure(req);
        return res.status(state.blocked ? 429 : 401).json({ error: state.blocked ? 'Acceso bloqueado durante 15 minutos por demasiados intentos.' : 'Usuario o contraseña incorrectos.' });
      }
      await pool.query('DELETE FROM tejilume_admin_login_attempts WHERE ip_hash=$1', [ipHash(req)]);
      res.cookie(COOKIE, makeToken(sessionSecret), cookieOptions(isProduction));
      res.set('Cache-Control', 'no-store');
      return res.json({ ok: true });
    } catch (error) {
      console.error('TEJILUME admin login failed:', error?.code || error?.name || 'unknown');
      return res.status(503).json({ error: 'No se pudo iniciar sesión. Inténtalo más tarde.' });
    }
  });
  router.post('/logout', requireAdmin, (req, res) => {
    res.clearCookie(COOKIE, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' });
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true });
  });
  router.get('/status', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query(String.raw\`
        SELECT s.key_last4, s.ai_enabled, s.daily_limit,
          COALESCE(u.generations,0)::int AS generations
        FROM tejilume_admin_settings s
        LEFT JOIN tejilume_ai_usage u ON u.usage_date=(NOW() AT TIME ZONE 'UTC')::date
        WHERE s.id=1
      \`);
      const row = result.rows[0];
      res.set('Cache-Control', 'no-store');
      res.json({
        keySaved: Boolean(row.key_last4),
        keyLast4: row.key_last4 || null,
        fallbackConfigured: Boolean(process.env.OPENAI_API_KEY),
        aiEnabled: row.ai_enabled,
        dailyLimit: row.daily_limit,
        generationsToday: row.generations
      });
    } catch (error) {
      console.error('TEJILUME admin status failed:', error?.code || error?.name || 'unknown');
      res.status(503).json({ error: 'No se pudo consultar el estado del panel.' });
    }
  });
  router.post('/key', requireAdmin, async (req, res) => {
    try {
      const key = String(req.body?.apiKey || '').trim();
      if (key.length < 20 || key.length > 500 || !/^[A-Za-z0-9_-]+$/.test(key)) return res.status(400).json({ error: 'La clave no tiene un formato válido.' });
      if (!pool || !masterKey) return res.status(503).json({ error: 'Almacenamiento seguro no configurado.' });
      const encrypted = encryptSecret(key, masterKey);
      await pool.query('UPDATE tejilume_admin_settings SET key_ciphertext=$1,key_iv=$2,key_tag=$3,key_last4=$4,updated_at=NOW() WHERE id=1',
        [encrypted.ciphertext, encrypted.iv, encrypted.tag, key.slice(-4)]);
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, keySaved: true, keyLast4: key.slice(-4), message: 'Clave cifrada y guardada en el servidor.' });
    } catch (error) {
      console.error('TEJILUME admin key save failed:', error?.code || error?.name || 'unknown');
      res.status(503).json({ error: 'No se pudo guardar la clave. Revisa la conexión segura con la base de datos.' });
    }
  });
  router.post('/settings', requireAdmin, async (req, res) => {
    const enabled = req.body?.aiEnabled;
    const limit = Number(req.body?.dailyLimit);
    if (typeof enabled !== 'boolean' || !Number.isInteger(limit) || limit < 1 || limit > 10000) {
      return res.status(400).json({ error: 'Configura un tope diario entero entre 1 y 10000.' });
    }
    try {
      await pool.query('UPDATE tejilume_admin_settings SET ai_enabled=$1,daily_limit=$2,updated_at=NOW() WHERE id=1', [enabled, limit]);
      res.json({ ok: true, aiEnabled: enabled, dailyLimit: limit });
    } catch (error) {
      console.error('TEJILUME admin settings failed:', error?.code || error?.name || 'unknown');
      res.status(503).json({ error: 'No se pudo guardar la configuración.' });
    }
  });
  router.post('/test', requireAdmin, async (req, res) => {
    try {
      const apiKey = await resolveApiKey();
      if (!apiKey) return res.status(503).json({ ok: false, error: 'No hay una clave de OpenAI guardada ni una clave de respaldo en el entorno.' });
      const client = new OpenAI({ apiKey, timeout: 20000, maxRetries: 0 });
      const response = await client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', input: [{ role: 'user', content: 'Responde exactamente: TEJILUME_OK' }] });
      const output = String(response.output_text || '');
      if (!output.includes('TEJILUME_OK')) return res.status(502).json({ ok: false, error: 'OpenAI respondió, pero la prueba mínima no fue concluyente.' });
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, message: 'La conexión con OpenAI funciona.', source: await keySource() });
    } catch (error) {
      const status = error?.status === 401 || error?.status === 403 ? 401 : error?.status === 429 ? 429 : 502;
      console.error('TEJILUME OpenAI connection test failed:', error?.status || error?.code || error?.name || 'unknown');
      res.status(status).json({ ok: false, error: status === 401 ? 'OpenAI rechazó la clave o sus permisos.' : status === 429 ? 'OpenAI alcanzó el límite o la cuota de la cuenta.' : 'No se pudo completar la llamada de prueba a OpenAI.' });
    }
  });
  app.use('/api/admin', router);
  app.get('/admin', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(require('path').join(publicDir, 'admin.html'));
  });

  async function resolveApiKey() {
    if (!pool) return String(process.env.OPENAI_API_KEY || '').trim();
    const result = await pool.query('SELECT key_ciphertext,key_iv,key_tag FROM tejilume_admin_settings WHERE id=1');
    const row = result.rows[0];
    if (row?.key_ciphertext && row?.key_iv && row?.key_tag) {
      try { return decryptSecret({ ciphertext: row.key_ciphertext, iv: row.key_iv, tag: row.key_tag }, masterKey); }
      catch (error) {
        console.error('TEJILUME stored key decryption failed:', error?.code || error?.name || 'unknown');
        const e = new Error('La clave guardada no se puede descifrar; revisa MASTER_KEY.');
        e.code = 'AI_KEY_STORAGE_ERROR';
        throw e;
      }
    }
    return String(process.env.OPENAI_API_KEY || '').trim();
  }
  async function keySource() {
    const result = await pool.query('SELECT key_ciphertext FROM tejilume_admin_settings WHERE id=1');
    return result.rows[0]?.key_ciphertext ? 'admin' : 'environment';
  }
  async function aiMiddleware(req, res, next) {
    try {
      if (!pool) { req.openAiKey=String(process.env.OPENAI_API_KEY||'').trim(); return next(); }
      const settings = await pool.query('SELECT ai_enabled,daily_limit FROM tejilume_admin_settings WHERE id=1');
      if (!settings.rows.length) return res.status(503).json({ error: 'El panel de administración no está inicializado.' });
      if (!settings.rows[0].ai_enabled) return res.status(503).json({ error: 'La generación con IA está desactivada por el administrador.' });
      const key = await resolveApiKey();
      if (!key) return res.status(503).json({ error: 'La IA no está configurada en el servidor.' });
      req.openAiKey = key;
      const usage = await pool.query(String.raw\`
        INSERT INTO tejilume_ai_usage(usage_date,generations) VALUES ((NOW() AT TIME ZONE 'UTC')::date,1)
        ON CONFLICT(usage_date) DO UPDATE SET generations=tejilume_ai_usage.generations+1
        WHERE tejilume_ai_usage.generations < $1
        RETURNING generations
      \`, [settings.rows[0].daily_limit]);
      if (!usage.rows.length) return res.status(429).json({ error: 'Se alcanzó el tope diario de generaciones configurado por el administrador.' });
      req.tejilumeUsageCount = usage.rows[0].generations;
      next();
    } catch (error) {
      console.error('TEJILUME AI guard failed:', error?.code || error?.name || 'unknown');
      return res.status(503).json({ error: error?.code === 'AI_KEY_STORAGE_ERROR' ? 'No se pudo leer la clave cifrada. Revisa MASTER_KEY.' : 'No se pudo comprobar la configuración de IA.' });
    }
  }
  async function keyOnlyMiddleware(req, res, next) {
    try {
      const key = await resolveApiKey();
      req.openAiKey = key;
      next();
    } catch (error) {
      console.error('TEJILUME AI key lookup failed:', error?.code || error?.name || 'unknown');
      res.status(503).json({ error: 'No se pudo leer la configuración de IA.' });
    }
  }
  async function aiConfigured() {
    try { return Boolean(await resolveApiKey()); } catch { return false; }
  }
  return { init, aiMiddleware, keyOnlyMiddleware, aiConfigured };
}

module.exports = { createAdminPanel, encryptSecret, decryptSecret, parseMasterKey, verifyToken };