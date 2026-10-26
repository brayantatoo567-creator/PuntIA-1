const express = require('express');
const path = require('node:path');
const { initializeDatabase } = require('./backend/database');
const assistantRoutes = require('./backend/routes/assistantRoutes');
const memoryRoutes = require('./backend/routes/memoryRoutes');

function createApp() {
  initializeDatabase();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ai: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      vision: process.env.OPENAI_VISION_MODEL || 'gpt-4o'
    });
  });
  app.use('/api/puntia', assistantRoutes);
  app.use('/api/puntia', memoryRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta de API no encontrada.' }));
  app.get('*path', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.use((err, _req, res, _next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'La imagen supera el límite de 8 MB.' });
    }
    if (err && err.message === 'Formato de imagen no admitido. Usa JPG, PNG, WEBP o GIF.') {
      return res.status(415).json({ error: err.message });
    }
    console.error('PuntIA request error:', err?.name || 'unknown');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  createApp().listen(port, () => console.log(`PuntIA escuchando en el puerto ${port}`));
}

module.exports = { createApp };
