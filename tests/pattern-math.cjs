#!/usr/bin/env node
'use strict';
const { calculateRound, validatePattern } = require('../pattern-validator.cjs');
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
const report = validatePattern('Vuelta 1: 6 pb (6)\nVuelta 2: (1 pb, 1 aum) x 6 (17)\nVuelta 3: tejido especial (12)');
if (report.checkedRounds !== 3 || report.validRounds !== 1 || report.invalidRounds !== 1 || report.unverifiedRounds !== 1) throw new Error('Resumen inesperado: ' + JSON.stringify(report));
console.log('Pruebas de aritmética de rondas: 7/7 correctas.');
