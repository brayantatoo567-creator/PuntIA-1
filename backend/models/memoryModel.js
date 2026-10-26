const { getDatabase } = require('../database');
function addMemory(userId, content, category) {
  const db = getDatabase();
  const result = db.prepare('INSERT INTO memories (user_id, content, category) VALUES (?, ?, ?)').run(userId, content, category);
  return db.prepare('SELECT id, user_id AS userId, content, category, created_at AS createdAt FROM memories WHERE id = ?').get(result.lastInsertRowid);
}
function listMemories(userId, limit = 50) {
  return getDatabase().prepare('SELECT id, content, category, created_at AS createdAt FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit).reverse();
}
function deleteMemories(userId) {
  return getDatabase().prepare('DELETE FROM memories WHERE user_id = ?').run(userId).changes;
}
module.exports = { addMemory, listMemories, deleteMemories };
