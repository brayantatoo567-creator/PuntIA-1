'use strict';

function parseRound(line) {
  const text=String(line||'').toLowerCase().replace(/\s+/g,' ').trim();
  const match=text.match(/^(?:vuelta|ronda)\s*(\d+)\s*[:.)-]?\s*(.*?)\s*\((\d+)\)\s*$/i);
  if(!match)return {status:'unverified',reason:'Formato de vuelta no reconocido.'};
  const number=Number(match[1]),body=match[2],expected=Number(match[3]);
  const repeat=body.match(/^\((.+)\)\s*(?:x|×)\s*(\d+)$/);
  const group=repeat?repeat[1]:body, multiplier=repeat?Number(repeat[2]):1;
  const token=/(\d+)\s*(pb|puntos bajos|aum|aumento|dis|disminución|disminucion)\b/g;
  let cursor=0,input=0,output=0,found=false,m;
  while((m=token.exec(group))!==null){
    if(group.slice(cursor,m.index).replace(/[(),+]/g,'').trim())return {status:'unverified',number,expected,reason:'Hay operaciones no reconocidas.'};
    const n=Number(m[1]);if(!Number.isSafeInteger(n)||n<1||n>10000)return {status:'unverified',number,expected,reason:'Cantidad fuera de rango.'};
    const op=m[2];input+=n*(op==='aum'||op==='aumento'?1:op.startsWith('dis')||op.startsWith('dismin')?2:1);
    output+=n*(op==='aum'||op==='aumento'?2:1);found=true;cursor=token.lastIndex;
  }
  if(!found||group.slice(cursor).replace(/[(),+]/g,'').trim())return {status:'unverified',number,expected,reason:'Notación no reconocida.'};
  input*=multiplier;output*=multiplier;
  return {status:output===expected?'valid':'invalid',number,expected,actual:output,input,output,reason:output===expected?'':'El total escrito no coincide con las operaciones.'};
}
function validatePattern(pattern){
 const lines=String(pattern||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>/^(?:vuelta|ronda)\s*\d+/i.test(x));
 const results=lines.map(line=>({line,...parseRound(line)}));
 return {checkedRounds:results.length,validRounds:results.filter(x=>x.status==='valid').length,invalidRounds:results.filter(x=>x.status==='invalid').length,unverifiedRounds:results.filter(x=>x.status==='unverified').length,results};
}
function validateProject(pattern){
 const text=String(pattern||''),issues=[];
 const inventoryBlock=text.match(/INVENTARIO DE PIEZAS\s*([\s\S]*?)(?=PIEZA\s*:|ENSAMBLAJE\b|$)/i);
 const declared=inventoryBlock?(inventoryBlock[1].match(/^\s*[-•]\s*(.+?)\s*$/gm)||[]).map(x=>x.replace(/^\s*[-•]\s*/, '').trim().toLowerCase()):[];
 const sections=[...text.matchAll(/^PIEZA\s*:\s*(.+?)\s*$/gim)];
 if(!inventoryBlock||!declared.length)issues.push('Falta un inventario explícito de piezas.');
 if(!sections.length)issues.push('No hay secciones PIEZA: con instrucciones separadas.');
 const built=sections.map((m,index)=>{
   const name=m[1].trim(),start=m.index+m[0].length,end=index+1<sections.length?sections[index+1].index:(text.search(/^ENSAMBLAJE\b/im)>=0?text.search(/^ENSAMBLAJE\b/im):text.length);
   const body=text.slice(start,end),lines=body.split(/\r?\n/).map(x=>x.trim()).filter(x=>/^(?:vuelta|ronda)\s*\d+/i.test(x));
   if(!lines.length)issues.push('La pieza "'+name+'" no contiene vueltas numeradas.');
   const rounds=lines.map(parseRound);
   rounds.forEach((r,i)=>{
     if(r.status!=='valid')issues.push('La pieza "'+name+'", vuelta '+(r.number||'?')+': '+(r.reason||'conteo incorrecto'));
     if(r.number!==i+1)issues.push('La pieza "'+name+'" tiene numeración discontinua; se esperaba vuelta '+(i+1)+'.');
     if(i>0&&r.input!==rounds[i-1].output)issues.push('La pieza "'+name+'", vuelta '+r.number+' consume '+r.input+' puntos, pero la anterior termina con '+rounds[i-1].output+'.');
   });
   return {name,rounds:rounds.length,valid:rounds.length>0&&rounds.every(r=>r.status==='valid')};
 });
 const names=built.map(x=>x.name.toLowerCase());
 for(const name of declared)if(!names.includes(name))issues.push('La pieza declarada "'+name+'" no tiene instrucciones.');
 for(const name of names)if(!declared.includes(name))issues.push('La pieza "'+name+'" no aparece en el inventario.');
 const assembly=text.match(/^ENSAMBLAJE\b([\s\S]*)$/im);
 if(!assembly)issues.push('Falta la sección ENSAMBLAJE.');
 else for(const name of declared)if(!assembly[1].toLowerCase().includes(name))issues.push('El ensamblaje no indica dónde unir "'+name+'".');
 if(!/MATERIALES\b/i.test(text))issues.push('Falta la sección MATERIALES.');
 const math=validatePattern(text);
 if(!math.checkedRounds)issues.push('No se detectaron vueltas verificables.');
 return {ok:issues.length===0,issues,pieces:built.length,checkedRounds:math.checkedRounds,validRounds:math.validRounds,invalidRounds:math.invalidRounds,unverifiedRounds:math.unverifiedRounds,pieceResults:built};
}
module.exports={calculateRound:parseRound,parseRound,validatePattern,validateProject};
