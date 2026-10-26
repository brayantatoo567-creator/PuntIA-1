const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

let database;
function getDatabase() {
  if (database) return database;
  const filename = process.env.PUNTIA_DB_PATH || path.join(__dirname, '..', '..', 'data', 'puntia.sqlite');
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  database = new Database(filename);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      emotion TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_user_created
      ON conversations(user_id, created_at);
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'note',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_memories_user_created
      ON memories(user_id, created_at);
  `);
  return database;
}
function initializeDatabase() { getDatabase(); }
function closeDatabaseForTests() { if (database) database.close(); database = undefined; }
module.exports = { getDatabase, initializeDatabase, closeDatabaseForTests };
