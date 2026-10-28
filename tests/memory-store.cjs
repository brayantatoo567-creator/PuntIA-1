'use strict';
const assert = require('node:assert/strict');
const { parseMemory } = require('../memory-store.cjs');

const valid = { session_1: [{ content: 'nota', category: 'note' }] };
assert.deepEqual(parseMemory(JSON.stringify(valid)), valid, 'acepta memoria válida');
assert.deepEqual(parseMemory('{}'), {}, 'acepta memoria vacía');
assert.throws(() => parseMemory('{malformed'), SyntaxError, 'rechaza JSON corrupto');
assert.throws(() => parseMemory('null'), /Formato de memoria JSON inválido/, 'rechaza null');
assert.throws(() => parseMemory('[]'), /Formato de memoria JSON inválido/, 'rechaza arreglo raíz');
assert.throws(() => parseMemory('{"session_1":{}}'), /no es una lista/, 'rechaza sesión que no es lista');
assert.throws(() => parseMemory('{"session_1":[{}]}'), /Registro de memoria inválido/, 'rechaza registro sin contenido');
assert.throws(() => parseMemory('{"session_1":[null]}'), /Registro de memoria inválido/, 'rechaza registro nulo');
assert.throws(() => parseMemory('{"session_1":[[]]}'), /Registro de memoria inválido/, 'rechaza registro arreglo');
console.log('memory-store: 9 pruebas correctas');
