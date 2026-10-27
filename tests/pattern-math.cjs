#!/usr/bin/env node
'use strict';

// Conservative checks for common amigurumi round notation.
// Unknown notation is reported as unverified rather than guessed.
function calculateGroup(group) {
  const text = group.toLowerCase().replace(/\s+/g, ' ').trim();
  const token = /(\d+)\s*(pb|puntos bajos|aum|aumento|dis|disminución|disminucion)\b/g;
  let cursor = 0, output = 0, match, found = false;
  while ((match = token.exec(text)) !== null) {
    const gap = text.slice(cursor, match.index).replace(/[(),+]/g, '').trim();
    if (gap) return null;
    const count = Number(match[1]);
    if (!Number.isSafeInteger(count) || count < 1 || count > 10000) return null;
    const op = match[2];
    output += count * (op === 'aum' || op === 'aumento' ? 2 : 1);
    cursor = token.lastIndex;
    found = true;
  }
  if (!found || text.slice(cursor).replace(/[(),+]/g, '').trim()) return null;
  return output;
}
function calculateRound(line) {
  const text = line.toLowerCase().replace(/\s+/g, ' ').trim();
  const total = text.match(/\((\d+)\)\s*$/);
  if (!total) return { status: 'unverified', reason: 'No hay total final entre paréntesis.' };
  const expected = Number(total[1]);
  const round = text.replace(/\s*\(\d+\)\s*$/, '').replace(/^\s*(?:ronda|vuelta)\s*\d+\s*[:.)-]?\s*/, '').trim();
  const repeat = round.match(/^\((.+)\)\s*(?:x|×)\s*(\d+)$/);
  let actual;
  if (repeat) {
    const count = Number(repeat[2]);
    const group = calculateGroup(repeat[1]);
    if (group === null || !Number.isSafeInteger(count) || count < 1 || count > 1000) {
      return { status: 'unverified', expected, reason: 'Notación de grupo no reconocida.' };
    }
    actual = group * count;
  } else {
    actual = calculateGroup(round);
    if (actual === null) return { status: 'unverified', expected, reason: 'Notación de ronda no reconocida.' };
  }
  return { status: actual === expected ? 'valid' : 'invalid', expected, actual };
}
function validatePattern(pattern) {
  const lines = String(pattern || '').split(/\\r?\\n/).map(line => line.trim())
    .filter(line => /^(?:ronda|vuelta)\\s*\\d+\\s*[:.)-]?/i.test(line));
  const results = lines.map(line => ({ line, ...calculateRound(line) }));
  return {
    checkedRounds: results.length,
    validRounds: results.filter(x => x.status === 'valid').length,
    invalidRounds: results.filter(x => x.status === 'invalid').length,
    unverifiedRounds: results.filter(x => x.status === 'unverified').length,
    results
  };
}
function assertStatus(line, expectedStatus) {
  const result = calculateRound(line);
  if (result.status !== expectedStatus) throw new Error(`"${line}" esperaba ${expectedStatus}, obtuvo ${JSON.stringify(result)}`);
}
assertStatus('Vuelta 1: 6 pb (6)', 'valid');
assertStatus('Ronda 2: (1 pb, 1 aum) x 6 (18)', 'valid');
assertStatus('Vuelta 3: (2 pb, 1 aum) x 6 (24)', 'valid');
assertStatus('Ronda 4: (1 pb, 1 dis) x 6 (12)', 'valid');
assertStatus('Vuelta 2: (1 pb, 1 aum) x 6 (17)', 'invalid');
assertStatus('Ronda 3: instrucciones especiales (12)', 'unverified');
console.log('Pruebas de aritmética de rondas: 6/6 correctas.');
module.exports = { calculateRound };
