const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const dbFile = path.join(require('node:os').tmpdir(), 'puntia-test-' + process.pid + '.sqlite');
process.env.PUNTIA_DB_PATH = dbFile;
const { createApp } = require('../../server');
const { closeDatabaseForTests } = require('../database');
const app = createApp();

test('health endpoint reports healthy server without leaking secrets', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.ok, true);
  assert.equal(typeof response.body.ai, 'boolean');
  assert.equal(JSON.stringify(response.body).includes('OPENAI_API_KEY'), false);
});

test('chat rejects blank input without calling AI', async () => {
  const response = await request(app).post('/api/puntia/chat').send({ message: '   ' }).expect(400);
  assert.equal(response.body.error, 'Escribe un mensaje.');
});

test('memory can be saved, read and deleted', async () => {
  await request(app).post('/api/puntia/memory').send({ userId: 'test-user', content: 'Usa hilo de algodón' }).expect(200);
  const read = await request(app).get('/api/puntia/memory/test-user').expect(200);
  assert.ok(read.body.items.some(item => item.content === 'Usa hilo de algodón'));
  const deleted = await request(app).delete('/api/puntia/memory/test-user').expect(200);
  assert.equal(deleted.body.deleted, true);
});

test('chat reports missing AI configuration explicitly', async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await request(app).post('/api/puntia/chat').send({ message: 'Ayúdame con un punto bajo' }).expect(503);
  } finally {
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
  }
});

test.after(() => {
  closeDatabaseForTests();
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(dbFile + suffix); } catch {}
  }
});
