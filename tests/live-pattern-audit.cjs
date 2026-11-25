'use strict';
const {validatePattern,validateProject}=require('../pattern-validator.cjs');
const BASE=String(process.env.TEJILUME_BASE_URL||'https://puntia-beta.onrender.com').replace(/\/+$/,'');
const IDEAS=[
'Un dragón pequeño de fantasía con cabeza grande, hocico, cuatro patas, dos alas, dos cuernos, cola larga con punta y tres placas dorsales. Debe tener piezas separadas y simetría en las extremidades.',
'Un pulpo explorador con cabeza redonda, ocho tentáculos separados de largo parecido, pequeños detalles bordados y una mochila de buzo.',
'Una casa de campo con cuerpo, techo inclinado adaptado a crochet, puerta, dos ventanas, chimenea, árbol, flores y una cerca de jardín.',
'Una criatura asimétrica de tres ojos: un brazo largo, otro corto, una sola pierna central, una antena torcida y un cuerpo irregular. No la conviertas en una figura simétrica.',
'Una nave espacial abstracta con cabina, fuselaje, dos alas de formas distintas, dos motores, punta y dos aros decorativos tejidos por separado.',
'Un caracol fantástico con cuerpo, caparazón espiral aproximado mediante volumen enrollado, dos antenas y dos ojos. Explica cómo fijar el caparazón sin que se venza.',
'Una medusa luminosa con campana, siete tentáculos de longitudes alternadas, detalles bordados y una base para que pueda exhibirse.',
'Un robot jardinero con cabeza, torso, dos brazos, dos piernas, regadera, flor y mochila de herramientas. Todas las piezas deben poder ensamblarse.',
'Un árbol miniatura con tronco, raíces visibles, copa, cinco frutos independientes y pequeñas hojas. Debe sostenerse de pie con una base tejida.',
'Un castillo fantástico con torre central y dos torres laterales, tres techos, puerta, bandera y almenas representadas con piezas simples tejibles.',
'Un murciélago invertido con cuerpo, cabeza, orejas, dos alas desiguales, dos patas y detalles bordados. Las alas deben tener una unión resistente.',
'Un cangrejo con caparazón, una pinza grande y otra pequeña, seis patas, dos ojos y una base estable. Mantén la asimetría de las pinzas.',
'Una guitarra de juguete con cuerpo, mástil, cabeza, botones, correa y cuerdas bordadas. Las piezas deben ser planas o reforzadas para conservar la forma.',
'Una casa-hongo con tallo, sombrero, puerta, ventana, chimenea y escalón. Incluye una base estable y explica cómo fijar el sombrero.',
'Un híbrido pulpo-cactus con cuerpo central, cinco brazos/tentáculos, maceta, flor superior y espinas bordadas sin piezas puntiagudas rígidas.'
];
async function main(){
 const health=await fetch(BASE+'/api/health',{signal:AbortSignal.timeout(20000)});
 const h=await health.json();
 if(!health.ok||!h.ok||!h.database)throw new Error('Render API/PostgreSQL no está saludable: '+JSON.stringify(h));
 if(!h.ai)throw new Error('Render no tiene OPENAI_API_KEY configurada; las pruebas reales de IA no pueden ejecutarse.');
 const report=[];
 for(let i=0;i<IDEAS.length;i++){
   const form=new FormData();
   form.append('idea',IDEAS[i]);form.append('height','18-22 cm');form.append('level','Intermedio');form.append('yarn','Hilo de algodón');form.append('style','Diseño tejible, fiel a la idea, con piezas identificadas');
   let row={figure:i+1,idea:IDEAS[i],passed:false};
   try{
     const response=await fetch(BASE+'/api/imaginaria/create',{method:'POST',body:form,signal:AbortSignal.timeout(150000)});
     const data=await response.json();
     if(!response.ok)throw new Error('HTTP '+response.status+': '+String(data.error||'sin detalle').slice(0,350));
     const math=validatePattern(data.pattern),structure=validateProject(data.pattern);
     row={figure:i+1,name:data.name||'Figura '+(i+1),passed:data.status==='structure_and_math_checked'&&structure.ok&&math.checkedRounds>0&&math.invalidRounds===0&&math.unverifiedRounds===0,pieces:structure.pieces,rounds:math.checkedRounds,validRounds:math.validRounds,invalidRounds:math.invalidRounds,unverifiedRounds:math.unverifiedRounds,issues:structure.issues};
     if(!row.passed)row.error='La respuesta no superó la verificación local independiente.';
   }catch(e){row.error=String(e.message||e).slice(0,500);}
   report.push(row);
   console.log(JSON.stringify({progress:i+1,total:IDEAS.length,passed:report.filter(x=>x.passed).length,failed:report.filter(x=>!x.passed).length,last:row}));
 }
 const passed=report.filter(x=>x.passed).length,failed=report.length-passed;
 console.log(JSON.stringify({liveAi:true,total:report.length,passed,failed,report},null,2));
 if(failed)process.exitCode=1;
}
main().catch(e=>{console.error('LIVE AUDIT FAILED:',e.message);process.exitCode=1});
