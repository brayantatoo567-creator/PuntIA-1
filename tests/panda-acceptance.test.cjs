'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {parseInstruction,auditCase,auditSection}=require('../panda-pattern-audit.cjs');
const {validatePattern}=require('../pattern-validator.cjs');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','panda-hamburguesero.case.json'),'utf8'));

test('Panda case has the agreed product constraints',()=>{
  assert.equal(fixture.caseId,'PUNTIA-PANDA-001');
  assert.equal(fixture.targetHeightCm,19);
  assert.equal(fixture.level,'Intermedio');
  assert.equal(fixture.construction,'Piezas separadas cosidas');
  assert.ok(fixture.components.includes('gorra naranja con visera'));
});

test('arithmetic parser calculates stitches consumed and produced',()=>{
  assert.deepEqual(parseInstruction('6 pb'),{consumed:6,produced:6});
  assert.deepEqual(parseInstruction('6 aum'),{consumed:6,produced:12});
  assert.deepEqual(parseInstruction('(1 pb, 1 aum) x 6'),{consumed:12,produced:18});
  assert.deepEqual(parseInstruction('(1 pb, 1 dis) x 6'),{consumed:18,produced:12});
  assert.equal(parseInstruction('hacer una forma ovalada'),null);
});

test('reference head rounds pass output and round-to-round continuity',()=>{
  const result=auditSection(fixture.sections.find(x=>x.name==='Cabeza'));
  assert.equal(result.checked,23);
  assert.equal(result.invalid,0);
  assert.equal(result.unverified,0);
  assert.equal(result.valid,23);
});

test('reference ears and legs pass output and round-to-round continuity',()=>{
  for(const name of ['Oreja','Pierna']){
    const result=auditSection(fixture.sections.find(x=>x.name===name));
    assert.equal(result.invalid,0,name);
    assert.equal(result.unverified,0,name);
    assert.equal(result.valid,result.checked,name);
  }
});

test('audit rejects a wrong final stitch count',()=>{
  const result=auditSection({name:'malformed',rounds:[
    {id:'A',instruction:'6 pb',expected:6,initialBase:true},
    {id:'B',instruction:'6 aum',expected:13}
  ]});
  assert.equal(result.results[1].status,'invalid-output');
});

test('audit rejects a round that consumes the wrong number of base stitches',()=>{
  const result=auditSection({name:'broken continuity',rounds:[
    {id:'A',instruction:'6 pb',expected:6,initialBase:true},
    {id:'B',instruction:'(1 pb, 1 aum) x 6',expected:18}
  ]});
  assert.equal(result.results[1].status,'invalid-input');
});

test('production pattern validator rejects broken round continuity',()=>{
  const result=validatePattern('Vuelta 1: 6 pb (6)\nVuelta 2: (1 pb, 1 aum) x 6 (18)');
  assert.equal(result.checkedRounds,2);
  assert.equal(result.validRounds,1);
  assert.equal(result.invalidRounds,1);
  assert.match(result.results[1].reason,/consume 12 puntos.*terminó con 6/);
});

test('production pattern validator accepts a coherent head sequence',()=>{
  const result=validatePattern('Vuelta 1: 6 pb (6)\nVuelta 2: 6 aum (12)\nVuelta 3: (1 pb, 1 aum) x 6 (18)');
  assert.equal(result.validRounds,3);
  assert.equal(result.invalidRounds,0);
});

test('whole Panda acceptance fixture passes its arithmetic checks',()=>{
  const result=auditCase(fixture);
  assert.equal(result.rounds,40);
  assert.equal(result.valid,40);
  assert.equal(result.invalid,0);
  assert.equal(result.unverified,0);
  assert.equal(result.passed,true);
});
