const multer = require('multer');
const { addMessage, recentMessages } = require('../models/conversationModel');
const { generateText, diagnoseImage } = require('../services/aiService');
const { emotionFor } = require('../services/emotionService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const accepted = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!accepted.includes(file.mimetype)) return callback(new Error('Formato de imagen no admitido. Usa JPG, PNG, WEBP o GIF.'));
    callback(null, true);
  }
});
const bounded = (value, fallback, max) => String(value ?? fallback).trim().slice(0, max) || fallback;
function apiError(res, error, fallback) {
  if (error?.code === 'AI_NOT_CONFIGURED') return res.status(503).json({ error: error.message });
  console.error('PuntIA AI error:', error?.status || error?.code || error?.name || 'unknown');
  return res.status(502).json({ error: fallback });
}
async function chat(req, res) {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe un mensaje.' });
  if (message.length > 8000) return res.status(413).json({ error: 'El mensaje supera el límite de 8000 caracteres.' });
  const userId = bounded(req.body?.userId, 'demo-user', 100);
  try {
    const context = recentMessages(userId, 12).map(item => ({ role: item.role, content: item.content }));
    const reply = await generateText([...context, { role: 'user', content: message }]);
    addMessage({ userId, role: 'user', content: message });
    addMessage({ userId, role: 'assistant', content: reply, emotion: emotionFor(reply) });
    return res.json({ reply, emotion: emotionFor(reply), memorySaved: true });
  } catch (error) {
    return apiError(res, error, 'No se pudo responder. Inténtalo de nuevo.');
  }
}
async function generatePattern(req, res) {
  const name = bounded(req.body?.name, 'amigurumi', 160);
  const level = bounded(req.body?.level, 'Intermedio', 60);
  const height = bounded(req.body?.height, '15 cm', 40);
  const style = bounded(req.body?.style, 'tierno y clásico', 120);
  try {
    const pattern = await generateText([{ role: 'user', content:
      `Genera un patrón de crochet/amigurumi funcional y detallado para: ${name}. Nivel: ${level}. Tamaño: ${height}. Estilo: ${style}. Incluye materiales, abreviaturas, cabeza, cuerpo, extremidades, ensamblaje y conteo por vuelta.`
    }]);
    return res.json({ pattern, name, height, level });
  } catch (error) {
    return apiError(res, error, 'No se pudo generar el patrón. Inténtalo de nuevo.');
  }
}
async function diagnose(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Falta la imagen.' });
  try { return res.json({ analysis: await diagnoseImage(req.file) }); }
  catch (error) { return apiError(res, error, 'No se pudo analizar la imagen. Verifica el archivo e inténtalo de nuevo.'); }
}
module.exports = { chat, generatePattern, diagnose, upload };
