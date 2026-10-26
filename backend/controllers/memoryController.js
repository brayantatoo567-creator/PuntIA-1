const memoryModel = require('../models/memoryModel');
const { listMessages, deleteMessages } = require('../models/conversationModel');
const bounded = (value, fallback, max) => String(value ?? fallback).trim().slice(0, max) || fallback;
function getMemory(req, res) {
  const userId = bounded(req.params.userId, '', 100);
  return res.json({ items: [...memoryModel.listMemories(userId), ...listMessages(userId, 50)] });
}
function saveMemory(req, res) {
  const userId = bounded(req.body?.userId, 'demo-user', 100);
  const content = String(req.body?.content || '').trim().slice(0, 2000);
  const category = bounded(req.body?.category, 'note', 40);
  if (!content) return res.status(400).json({ error: 'La memoria está vacía.' });
  return res.json({ saved: true, item: memoryModel.addMemory(userId, content, category) });
}
function deleteMemory(req, res) {
  const userId = bounded(req.params.userId, '', 100);
  const memories = memoryModel.deleteMemories(userId);
  const messages = deleteMessages(userId);
  return res.json({ deleted: true, count: memories + messages });
}
module.exports = { getMemory, saveMemory, deleteMemory };
