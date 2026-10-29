/**
 * PuntIA — Motor de Tejido Verificable
 * Deterministic crochet stitch arithmetic and pattern validation.
 * CommonJS, no runtime dependencies.
 *
 * Important: arithmetic validation does not prove physical fit, gauge, or that
 * a design has been test-crocheted. Those are represented as separate statuses.
 */
'use strict';

const STITCHES = new Set(['sc', 'hdc', 'dc', 'tr', 'ch', 'slst', 'inc', 'dec']);
const STATUS = Object.freeze({
  VERIFIED_ARITHMETIC: 'verified_arithmetic',
  NEEDS_REVIEW: 'needs_review',
  INVALID: 'invalid'
});

function assertInteger(value, label, min = 0) {
  if (!Number.isInteger(value) || value < min) {
    throw new TypeError(`${label} must be an integer >= ${min}`);
  }
}

function stitchCount(instructions) {
  if (!Array.isArray(instructions) || instructions.length === 0) {
    throw new TypeError('instructions must be a non-empty array');
  }
  let total = 0;
  for (const item of instructions) {
    if (!item || !STITCHES.has(item.stitch)) {
      throw new TypeError(`Unsupported stitch: ${item && item.stitch}`);
    }
    assertInteger(item.count, 'instruction count', 0);
    // Chains are included only when the row explicitly says they count as stitches.
    if (item.stitch === 'inc') total += item.count * 2;
    else if (item.stitch === 'dec') total += item.count;
    else if (item.stitch !== 'ch' || item.countsAsStitch === true) total += item.count;
  }
  return total;
}

/**
 * Validate a pattern made of rows/rounds. Each row must declare the expected
 * stitch total and structured instructions; free-text-only instructions are
 * never labelled arithmetically verified.
 */
function validatePattern(pattern) {
  const errors = [];
  const warnings = [];
  if (!pattern || typeof pattern !== 'object') {
    return { status: STATUS.INVALID, errors: ['pattern must be an object'], warnings: [], checks: [] };
  }
  if (typeof pattern.title !== 'string' || !pattern.title.trim()) errors.push('Missing pattern title');
  if (!Array.isArray(pattern.rows) || pattern.rows.length === 0) errors.push('Pattern must contain at least one row or round');

  const checks = [];
  let previousTotal = null;
  for (let i = 0; Array.isArray(pattern.rows) && i < pattern.rows.length; i++) {
    const row = pattern.rows[i];
    const label = row && (row.label || `Row ${i + 1}`);
    if (!row || !Array.isArray(row.instructions)) {
      errors.push(`${label}: missing structured instructions`);
      continue;
    }
    try {
      const calculated = stitchCount(row.instructions);
      const expected = row.expectedStitches;
      if (!Number.isInteger(expected) || expected < 0) {
        errors.push(`${label}: expectedStitches must be a non-negative integer`);
      } else if (calculated !== expected) {
        errors.push(`${label}: declared total ${expected}, calculated total ${calculated}`);
      }
      if (row.inputStitches != null) {
        assertInteger(row.inputStitches, `${label} inputStitches`, 0);
        if (row.inputStitches !== previousTotal && previousTotal !== null) {
          warnings.push(`${label}: inputStitches (${row.inputStitches}) does not match prior row total (${previousTotal}); confirm shaping or joining`);
        }
      }
      checks.push({ label, calculatedStitches: calculated, expectedStitches: expected, passed: calculated === expected });
      previousTotal = calculated;
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  }

  if (!pattern.materials || !Array.isArray(pattern.materials.yarn) || pattern.materials.yarn.length === 0) {
    warnings.push('Materials: yarn details are missing; add fiber, weight, and estimated quantity');
  }
  if (!pattern.materials || !pattern.materials.hook) warnings.push('Materials: hook size is missing');
  if (!pattern.gauge) warnings.push('Gauge is unspecified; final dimensions cannot be reliably estimated');
  if (pattern.physicalTested !== true) warnings.push('Physical test not confirmed; arithmetic checks do not replace a test swatch or finished sample');
  if (pattern.referencesVerified !== true) warnings.push('External references have not been independently verified');

  return {
    status: errors.length ? STATUS.INVALID : (warnings.length ? STATUS.NEEDS_REVIEW : STATUS.VERIFIED_ARITHMETIC),
    errors,
    warnings,
    checks,
    verification: {
      arithmetic: errors.length === 0,
      materialsComplete: Boolean(pattern.materials && Array.isArray(pattern.materials.yarn) && pattern.materials.yarn.length && pattern.materials.hook),
      gaugeSpecified: Boolean(pattern.gauge),
      physicalTested: pattern.physicalTested === true,
      referencesVerified: pattern.referencesVerified === true
    }
  };
}

/**
 * Create a standard closed sphere / amigurumi base with adjustable round count.
 * This is a deterministic starter shape, not a claim to reproduce arbitrary
 * characters or guarantee dimensions without gauge and a physical test.
 */
function generateSpherePattern({ title = 'Esfera básica de amigurumi', increaseRounds = 6, materials = {} } = {}) {
  assertInteger(increaseRounds, 'increaseRounds', 2);
  if (increaseRounds > 20) throw new RangeError('increaseRounds must be <= 20');
  const rows = [];
  rows.push({
    label: 'Vuelta 1',
    instructions: [{ stitch: 'sc', count: 6 }],
    expectedStitches: 6
  });
  for (let round = 2; round <= increaseRounds; round++) {
    const total = round * 6;
    rows.push({
      label: `Vuelta ${round}`,
      instructions: [
        { stitch: 'sc', count: (round - 2) * 6 },
        { stitch: 'inc', count: 6, note: 'Cada aumento equivale a 2 puntos bajos' }
      ],
      expectedStitches: total,
      formula: `6 × ${round} = ${total}`
    });
  }
  // Straight section holds the maximum circumference.
  const maxStitches = increaseRounds * 6;
  rows.push({
    label: `Vueltas ${increaseRounds + 1}–${increaseRounds + 3}`,
    instructions: [{ stitch: 'sc', count: maxStitches }],
    expectedStitches: maxStitches,
    note: 'Repetir esta vuelta 3 veces'
  });
  // Decrease section mirrors the increase section.
  for (let step = increaseRounds - 1; step >= 1; step--) {
    rows.push({
      label: `Disminución ${increaseRounds * 2 + 4 - step}`,
      instructions: [
        { stitch: 'sc', count: Math.max(0, (step - 1) * 6) },
        { stitch: 'dec', count: 6, note: 'Cada disminución consume 2 puntos y produce 1' }
      ],
      expectedStitches: step * 6,
      formula: `6 × ${step} = ${step * 6}`
    });
  }
  const pattern = {
    title,
    technique: 'crochet',
    projectType: 'amigurumi-sphere',
    difficulty: 'beginner',
    terminology: 'US',
    materials: {
      yarn: materials.yarn || [],
      hook: materials.hook || null,
      stuffing: materials.stuffing ?? true,
      notions: materials.notions || ['marcador de vueltas', 'aguja lanera', 'tijeras']
    },
    gauge: materials.gauge || null,
    notes: [
      'Trabajar en espiral salvo que se indique lo contrario.',
      'Usar un marcador al inicio de cada vuelta.',
      'Rellenar gradualmente antes de cerrar.',
      'Las medidas finales dependen del hilo, gancho y tensión.'
    ],
    physicalTested: false,
    referencesVerified: false,
    rows
  };
  return { pattern, validation: validatePattern(pattern) };
}

module.exports = { STITCHES, STATUS, stitchCount, validatePattern, generateSpherePattern };
