'use strict';

function parseMemory(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Formato de memoria JSON inválido');
  }
  for (const items of Object.values(parsed)) {
    if (!Array.isArray(items)) throw new Error('La memoria de una sesión no es una lista');
    if (items.some(item => !item || typeof item !== 'object' || Array.isArray(item) || typeof item.content !== 'string')) {
      throw new Error('Registro de memoria inválido');
    }
  }
  return parsed;
}

module.exports = { parseMemory };
