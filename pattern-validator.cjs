'use strict';

const { parseInstruction } = require('./panda-pattern-audit.cjs');

function calculateRound(line) {
  const text=String(line||'').toLowerCase().replace(/\s+/g,' ').trim();
  const total=text.match(/\((\d+)\)\s*$/);
  if(!total) return {status:'unverified',reason:'No hay total final entre paréntesis.'};
  const expected=Number(total[1]);
  const instruction=text.replace(/\s*\(\d+\)\s*$/,'').replace(/^\s*(?:ronda|vuelta)\s*\d+\s*[:.)-]?\s*/,'').trim();
  const counts=parseInstruction(instruction);
  if(!counts) return {status:'unverified',expected,reason:'Notación de ronda no reconocida.'};
  return {status:counts.produced===expected?'valid':'invalid',expected,actual:counts.produced,consumed:counts.consumed,produced:counts.produced};
}

function validatePattern(pattern) {
  const lines=String(pattern||'').split(/\r?\n/).map(line=>line.trim())
    .filter(line=>/^(?:ronda|vuelta)\s*\d+\s*[:.)-]?/i.test(line));
  let previous=null;
  const results=lines.map(line=>{
    const result={line,...calculateRound(line)};
    if(result.status==='valid'&&previous!==null&&result.consumed!==previous){
      result.status='invalid';
      result.reason='La vuelta consume '+result.consumed+' puntos, pero la vuelta anterior terminó con '+previous+'.';
      result.inputExpected=previous;
    }
    if(Number.isInteger(result.expected)) previous=result.expected;
    else previous=null;
    return result;
  });
  return {
    checkedRounds:results.length,
    validRounds:results.filter(x=>x.status==='valid').length,
    invalidRounds:results.filter(x=>x.status==='invalid').length,
    unverifiedRounds:results.filter(x=>x.status==='unverified').length,
    results
  };
}

function assertStatus(line,expectedStatus){
  const result=calculateRound(line);
  if(result.status!==expectedStatus) throw new Error('"'+line+'" esperaba '+expectedStatus+', obtuvo '+JSON.stringify(result));
}
assertStatus('Vuelta 1: 6 pb (6)','valid');
assertStatus('Ronda 2: (1 pb, 1 aum) x 6 (18)','valid');
assertStatus('Vuelta 3: (2 pb, 1 aum) x 6 (24)','valid');
assertStatus('Ronda 4: (1 pb, 1 dis) x 6 (12)','valid');
assertStatus('Vuelta 2: (1 pb, 1 aum) x 6 (17)','invalid');
assertStatus('Ronda 3: instrucciones especiales (12)','unverified');

module.exports={calculateRound,validatePattern};
