function emotionFor(text) {
  const value = String(text || '').toLowerCase();
  if (/felicidades|lo logramos|¡listo|excelente|genial|perfecto/.test(value)) return 'excited';
  if (/no te preocupes|vamos con calma|lo corregimos|error|difícil/.test(value)) return 'concerned';
  if (/patrón|patron|vuelta|puntos|materiales|paso a paso/.test(value)) return 'focused';
  if (/¿qué|cuéntame|qué te gustaría|explorar/.test(value)) return 'curious';
  return 'happy';
}
module.exports = { emotionFor };
