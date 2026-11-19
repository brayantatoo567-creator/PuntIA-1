'use strict';
(function(root){
const safeName=s=>String(s||'').replace(/[<>]/g,'').trim().slice(0,70)||'Proyecto sin nombre';
function round(n,label,formula,total){return label+' '+formula+' ('+total+' pts)';}
function makePattern(v){
 const base=Number(v.base),inc=Number(v.inc),straight=Number(v.straight),dec=Number(v.dec),shape=v.shape;
 if(![6,8].includes(base)||!Number.isInteger(inc)||inc<1||inc>10||!Number.isInteger(straight)||straight<0||straight>40||!Number.isInteger(dec)||dec<1||dec>10)throw Error('Revisa los valores. Aumentos: 1–10; vueltas rectas: 0–40; disminuciones: 1–10.');
 if(shape==='sphere'&&dec!==inc)throw Error('Para una esfera con '+inc+' vueltas de aumento, usa '+inc+' vueltas de disminución.');
 const lines=['PUNTIA · PATRÓN BASE','Proyecto: '+safeName(v.name),'Pieza: '+({sphere:'Esfera / cabeza cerrada',cylinder:'Cilindro / cuerpo tubular',flat:'Círculo plano'}[shape]),'Hilo y gancho: '+v.yarn,'Puntos iniciales: '+base+' pb en anillo mágico (AM).','Abreviaturas: AM = anillo mágico; pb = punto bajo; aum = aumento (2 pb en un punto); dis = disminución invisible.','','INSTRUCCIONES'];
 let total=base;
 lines.push(round(1,'Vuelta','AM, '+base+' pb',total));
 for(let i=1;i<=inc;i++){total=base*(i+1);const formula=i===1?base+' aum':'('+(i-1)+' pb, 1 aum) × '+base;lines.push(round(i+1,'Vuelta',formula,total));}
 if(shape==='flat'){lines.push('Continuar aumentando de la misma forma si necesitas un diámetro mayor.');}
 else{
  for(let i=1;i<=straight;i++)lines.push(round(inc+1+i,'Vuelta',total+' pb',total));
  if(shape==='sphere'){
   for(let i=inc-1;i>=0;i--){total=base*(i+1);const formula=i===0?base+' dis':'('+i+' pb, 1 dis) × '+base;lines.push(round(inc+straight+(inc-1-i)+2,'Vuelta',formula,total));}
   lines.push('Rellenar gradualmente antes de cerrar. Cortar dejando hebra y cerrar los puntos restantes con aguja lanera.');
  }else lines.push('El cilindro queda abierto por arriba. Añade una tapa o continúa el cuerpo según tu diseño.');
 }
 lines.push('','REVISIÓN','Los totales de las rondas generadas son coherentes con las operaciones básicas indicadas.','No incluye muestra de tensión, medidas garantizadas, uniones, detalles ni prueba física. Teje una muestra y adapta el patrón.');
 return lines.join('\n');
}

root.PuntiaPatternBuilder={makePattern};
if(typeof module!=='undefined'&&module.exports)module.exports=root.PuntiaPatternBuilder;
})(typeof window!=='undefined'?window:globalThis);
