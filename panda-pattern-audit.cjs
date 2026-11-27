'use strict';

function parseInstruction(source) {
  let text=String(source||'').toLowerCase().replace(/\s+/g,' ').trim();
  const repeat=text.match(/^\((.+)\)\s*(?:x|×)\s*(\d+)$/);
  const multiplier=repeat?Number(repeat[2]):1;
  if(repeat) text=repeat[1];
  if(!Number.isSafeInteger(multiplier)||multiplier<1||multiplier>1000) return null;
  const token=/(\d+)\s*(pb|aum|dis)\b/g;
  let cursor=0,consumed=0,produced=0,match,found=false;
  while((match=token.exec(text))!==null){
    const gap=text.slice(cursor,match.index).replace(/[(),+]/g,'').trim();
    if(gap) return null;
    const n=Number(match[1]),op=match[2];
    if(!Number.isSafeInteger(n)||n<1||n>10000) return null;
    found=true;
    if(op==='pb'){consumed+=n;produced+=n;}
    if(op==='aum'){consumed+=n;produced+=n*2;}
    if(op==='dis'){consumed+=n*2;produced+=n;}
    cursor=token.lastIndex;
  }
  if(!found||text.slice(cursor).replace(/[(),+]/g,'').trim()) return null;
  return {consumed:consumed*multiplier,produced:produced*multiplier};
}

function auditSection(section) {
  const results=[];
  let previous=null;
  for(const round of (section.rounds||[])){
    const calc=parseInstruction(round.instruction);
    if(!calc){
      results.push({id:round.id,status:'unverified',reason:'Notación no reconocida.'});
      previous=Number.isInteger(round.expected)?round.expected:null;
      continue;
    }
    const expected=round.expected;
    const outputOk=Number.isInteger(expected)&&calc.produced===expected;
    const continuityOk=round.initialBase===true||previous===null||calc.consumed===previous;
    const status=!outputOk?'invalid-output':!continuityOk?'invalid-input':'valid';
    results.push({id:round.id,status,consumed:calc.consumed,produced:calc.produced,expected,previous});
    previous=Number.isInteger(expected)?expected:calc.produced;
  }
  return {name:section.name,checked:results.length,valid:results.filter(x=>x.status==='valid').length,invalid:results.filter(x=>x.status.startsWith('invalid')).length,unverified:results.filter(x=>x.status==='unverified').length,results};
}

function auditCase(testCase) {
  const sections=(testCase.sections||[]).map(auditSection);
  const rounds=sections.reduce((n,s)=>n+s.checked,0);
  const invalid=sections.reduce((n,s)=>n+s.invalid,0);
  const unverified=sections.reduce((n,s)=>n+s.unverified,0);
  return {caseId:testCase.caseId,rounds,valid:rounds-invalid-unverified,invalid,unverified,passed:rounds>0&&invalid===0&&unverified===0,sections};
}

module.exports={parseInstruction,auditSection,auditCase};
