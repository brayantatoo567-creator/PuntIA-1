#!/usr/bin/env node
'use strict';

// Validador conservador para notación común de rondas de amigurumi.
// Solo evalúa líneas cuyo patrón puede interpretar sin ambigüedad; no sustituye
// una revisión artesanal y no intenta adivinar formatos desconocidos.

function calculateGroup(group) {
  const text = group.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return null;
  let output = 0;
  let consumed = '';
  const token = /(\d+)\s*(pb|puntos bajos|aum|aumento|dis|disminución|disminucion)\b/g;
  let match;
  while ((match = token.exec(text)) !== null) {
    const prefix = text.slice(consumed.length, match.index).replace(/[(),+]/g, '').trim();
    if (prefix) return null;
    const count = Number(match[1]);
    if (!Number.isSafeInteger(count) || count < 1 || count > 10000) return null;
    const op = match[2];
    output += count * (op === 'aum' || op === 'aumento' ? 2 : op === 'dis' || op.startsWith('disminución') || op.startsWith('disminucion') ? 1 : 1);
    consumed = text.slice(0, token.lastIndex);
  }
  const rest = text.slice(consumed.length).replace(/[(),+]/g, '').trim();
  if (!consumed || rest) return null;
  return output;
}

function expectedCount(line) {
  const m = line.match(/\((\d+)\)\s*$/);
  return m ? Number(m[1]) : null;
}

function calculateRound(line) {
  const text = line.toLowerCase().replace(/\s+/g, ' ').trim();
  const expected = expectedCount(text);
  if (expected === null) return { status: 'unverified', reason: 'No hay total final entre paréntesis.' };
  const round = text.replace(/\s*\(\d+\)\s*$/, '').replace(/^\s*(?:ronda|vuelta)\s*\d+\s*[:.)-]?\s*/, '').trim();
  const repeat = round.match(/^\((.+)\)\s*(?:x|×)\s*(\d+)$/);
  if (repeat) {
    const repetitions = Number(repeat[2]);
    const groupOutput = calculateGroup(repeat[1]);
    if (groupOutput === null || !Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 1000) {
      return { status: 'unverified', expected, reason: 'Notación de grupo no reconocida.' };
    }
    const actual = groupOutput * repetitions;
    return { status: actual === expected ? 'valid' : 'invalid', expected, actual };
  }
  const simple = calculateGroup(round);
  if (simple === null) return { status: 'unverified', expected, reason: 'Notación de ronda no reconocida.' };
  return { status: simple === expected ? 'valid' : 'invalid', expected, actual: simple };
}

function assertStatus(line, expectedStatus) {
  const result = calculateRound(line);
  if (result.status !== expectedStatus) {
    throw new Error(`"${line}" esperaba ${expectedStatus}, obtuvo ${JSON.stringify(result)}`);
  }
}

assertStatus('Vuelta 1: 6 pb (6)', 'valid');
assertStatus('Ronda 2: (1 pb, 1 aum) x 6 (18)', 'valid');
assertStatus('Vuelta 3: (2 pb, 1 aum) x 6 (24)', 'valid');
assertStatus('Ronda 4: (1 pb, 1 dis) x 6 (12)', 'valid');
assertStatus('Vuelta 2: (1 pb, 1 aum) x 6 (17)', 'invalid');
assertStatus('Ronda 3: instrucciones especiales (12)', 'unverified');

console.log('Pruebas de aritmética de rondas: 6/6 correctas.');
module.exports = { calculateRound };
