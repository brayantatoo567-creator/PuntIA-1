const test = require('node:test');
const assert = require('node:assert/strict');
const { emotionFor } = require('../services/emotionService');

test('classifies crochet guidance as focused', () => {
  assert.equal(emotionFor('Aquí tienes el patrón con vueltas y puntos.'), 'focused');
});
test('classifies encouraging replies as excited', () => {
  assert.equal(emotionFor('¡Excelente, lo logramos!'), 'excited');
});
