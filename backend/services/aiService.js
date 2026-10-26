const OpenAI = require('openai');
const SYSTEM = 'Eres PuntIA, asistente experto en crochet y amigurumi. Responde en español claro. Ayuda con patrones, conteos, materiales, técnicas y enseñanza. No afirmes haber analizado una imagen que no recibiste. Los patrones deben usar abreviaturas comunes (AM, pb, aum, dis), vueltas numeradas y conteos finales.';
let client;
function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('La IA no está configurada en el servidor.');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
async function generateText(input) {
  const response = await getClient().responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    instructions: SYSTEM,
    input
  });
  return response.output_text || '';
}
async function diagnoseImage(file) {
  const imageData = 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64');
  const response = await getClient().responses.create({
    model: process.env.OPENAI_VISION_MODEL || 'gpt-4o',
    instructions: SYSTEM + ' Analiza la pieza de crochet. Distingue observaciones visibles de hipótesis y explica cómo corregir los problemas.',
    input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Analiza esta pieza de crochet y dame un diagnóstico práctico.' },
      { type: 'input_image', image_url: imageData }
    ] }]
  });
  return response.output_text || 'No fue posible obtener un análisis.';
}
module.exports = { generateText, diagnoseImage };
