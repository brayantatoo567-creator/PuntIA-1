const { getDatabase } = require('../database');
function addMessage({ userId, role, content, emotion = null }) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO conversations (user_id, role, content, emotion) VALUES (?, ?, ?, ?)')
    .run(userId, role, content, emotion);
  return db.prepare('SELECT id, user_id AS userId, role, content, emotion, created_at AS createdAt FROM conversations WHERE id = ?')
    .get(result.lastInsertRowid);
}
function recentMessages(userId, limit = 12) {
  return getDatabase().prepare('SELECT role, content FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit).reverse();
}
function listMessages(userId, limit = 50) {
  return getDatabase().prepare('SELECT id, role, content, emotion, created_at AS createdAt FROM conversations WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit).reverse();
}
module.exports = { addMessage, recentMessages, listMessages };
