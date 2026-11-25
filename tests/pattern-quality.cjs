'use strict';
const {validateProject}=require('../pattern-validator.cjs');
const shapes={
sphere:['6 pb (6)','(1 pb, 1 aum) x 3 (9)','(2 pb, 1 aum) x 3 (12)','12 pb (12)','(2 pb, 1 dis) x 3 (9)','(1 pb, 1 dis) x 3 (6)'],
tube:['6 pb (6)','6 pb (6)','(1 pb, 1 aum) x 3 (9)','9 pb (9)','9 pb (9)','(1 pb, 1 dis) x 3 (6)','6 pb (6)'],
cone:['4 pb (4)','4 pb (4)','(1 pb, 1 aum) x 2 (6)','6 pb (6)','(2 pb, 1 aum) x 2 (8)','8 pb (8)','(2 pb, 1 dis) x 2 (6)'],
oval:['6 pb (6)','(1 pb, 1 aum) x 3 (9)','9 pb (9)','(1 pb, 1 dis) x 3 (6)','6 pb (6)'],
disk:['6 pb (6)','6 aum (12)','(1 pb, 1 aum) x 6 (18)','(2 pb, 1 aum) x 6 (24)'],
leaf:['6 pb (6)','(1 pb, 1 aum) x 3 (9)','9 pb (9)','(1 pb, 1 dis) x 3 (6)','6 pb (6)']
};
const C=[
['Dragón articulado',[['cuerpo','sphere'],['cabeza','sphere'],['hocico','oval'],['ala izquierda','leaf'],['ala derecha','leaf'],['pata delantera izquierda','tube'],['pata delantera derecha','tube'],['pata trasera izquierda','tube'],['pata trasera derecha','tube'],['cuerno izquierdo','cone'],['cuerno derecho','cone'],['cola','cone']]],
['Pulpo explorador',[['cabeza','sphere'],...Array.from({length:8},(_,i)=>['tentáculo '+(i+1),'tube'])]],
['Casa con jardín',[['cuerpo de casa','tube'],['techo','cone'],['puerta','oval'],['ventana izquierda','disk'],['ventana derecha','disk'],['chimenea','tube'],['árbol','cone'],['tronco','tube'],['flor','leaf'],['cerca','tube']]],
['Criatura asimétrica de tres ojos',[['cuerpo','sphere'],['ojo central','sphere'],['ojo izquierdo','sphere'],['ojo derecho','sphere'],['brazo largo','tube'],['brazo corto','tube'],['pierna','tube'],['antena','cone']]],
['Nave espacial abstracta',[['cabina','sphere'],['fuselaje','tube'],['ala izquierda','leaf'],['ala derecha','leaf'],['motor izquierdo','tube'],['motor derecho','tube'],['punta','cone']]],
['Caracol con caparazón',[['cuerpo','tube'],['caparazón','sphere'],['cuerno izquierdo','tube'],['cuerno derecho','tube'],['ojo izquierdo','sphere'],['ojo derecho','sphere']]],
['Medusa luminosa',[['campana','sphere'],...Array.from({length:7},(_,i)=>['filamento '+(i+1),'tube'])]],
['Robot jardinero',[['cabeza','disk'],['torso','tube'],['brazo izquierdo','tube'],['brazo derecho','tube'],['pierna izquierda','tube'],['pierna derecha','tube'],['regadera','oval'],['flor','leaf']]],
['Árbol con frutos',[['copa','sphere'],['tronco','tube'],...Array.from({length:5},(_,i)=>['fruto '+(i+1),'sphere']),['raíz izquierda','tube'],['raíz derecha','tube']]],
['Castillo fantástico',[['torre central','tube'],['torre izquierda','tube'],['torre derecha','tube'],['techo central','cone'],['techo izquierdo','cone'],['techo derecho','cone'],['puerta','oval'],['bandera','leaf']]],
['Murciélago invertido',[['cuerpo','sphere'],['cabeza','sphere'],['ala izquierda','leaf'],['ala derecha','leaf'],['oreja izquierda','cone'],['oreja derecha','cone'],['pata izquierda','tube'],['pata derecha','tube']]],
['Cangrejo de pinzas desiguales',[['caparazón','sphere'],['pinza grande','cone'],['pinza pequeña','cone'],...Array.from({length:6},(_,i)=>['pata '+(i+1),'tube']),['ojo izquierdo','sphere'],['ojo derecho','sphere']]],
['Guitarra con correa',[['cuerpo','oval'],['mástil','tube'],['cabeza','oval'],['botón superior','sphere'],['botón inferior','sphere'],['correa','leaf']]],
['Hongo casa',[['tallo','tube'],['sombrero','disk'],['puerta','oval'],['ventana','disk'],['chimenea','tube'],['escalón','disk']]],
['Pulpo-cactus híbrido',[['cuerpo cactus','sphere'],...Array.from({length:5},(_,i)=>['brazo '+(i+1),'tube']),['flor superior','leaf'],['maceta','cone']]],
['Escultura abstracta de anillos',[['núcleo','sphere'],['aro vertical','tube'],['aro horizontal','tube'],['espiral izquierda','cone'],['espiral derecha','cone'],['base','disk']]]
];
function build(name,parts){
 const names=parts.map(x=>x[0]);let s='PROYECTO: '+name+'\nMATERIALES\n- Hilo, aguja adecuada, relleno, marcador y aguja lanera.\nINVENTARIO DE PIEZAS\n'+names.map(n=>'- '+n).join('\n')+'\n\n';
 for(const [n,shape] of parts)s+='PIEZA: '+n+'\n'+shapes[shape].map((r,i)=>'Vuelta '+(i+1)+': '+r).join('\n')+'\n\n';
 return s+'ENSAMBLAJE\n'+names.map(n=>'- Unir '+n+' al cuerpo o soporte conforme al diseño; asegurar y rematar cabos.').join('\n')+'\n';
}
let report=[];
for(const [name,parts] of C){const v=validateProject(build(name,parts));report.push({figure:name,pieces:v.pieces,rounds:v.checkedRounds,ok:v.ok&&v.pieces===parts.length&&v.checkedRounds===v.validRounds,issues:v.issues});}
const sample=build(C[0][0],C[0][1]);
const bad=[
['total incorrecto',sample.replace('Vuelta 2: (1 pb, 1 aum) x 3 (9)','Vuelta 2: (1 pb, 1 aum) x 3 (10)')],
['entrada incompatible',sample.replace('Vuelta 3: (2 pb, 1 aum) x 3 (12)','Vuelta 3: (3 pb, 1 aum) x 3 (15)')],
['pieza ausente',sample.replace(/PIEZA: cola[\s\S]*?(?=ENSAMBLAJE)/,'')],
['ensamblaje ausente',sample.replace(/ENSAMBLAJE[\s\S]*/,'')],
['pieza no inventariada',sample.replace('INVENTARIO DE PIEZAS','INVENTARIO DE PIEZAS\n- pieza fantasma')]
];
const negative=bad.map(([name,txt])=>({case:name,detected:!validateProject(txt).ok}));
const passed=report.filter(x=>x.ok).length,failed=report.length-passed;
if(passed!==16||negative.some(x=>!x.detected))throw new Error(JSON.stringify({report,negative}));
console.log(JSON.stringify({total:15,passed,failed,report,negative},null,2));
