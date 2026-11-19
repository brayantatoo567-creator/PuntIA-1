'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../public');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?path.join(root,'constructor.html'):path.join(root,pathname.replace(/^\//,''));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(data);});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const port=server.address().port;
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://127.0.0.1:'+port+'/constructor.html');
  await page.locator('#builder button[type="submit"]').click();
  await page.locator('#output').waitFor();
  let output=await page.locator('#output').innerText();
  assert.match(output,/Vuelta 1: AM, 6 pb \(6 pts\)/);
  assert.match(output,/Vuelta 12: 6 dis \(6 pts\)/);
  await page.locator('#save').click();
  await page.getByRole('button',{name:'Abrir'}).click();
  assert.match(await page.locator('#output').innerText(),/Proyecto: Mi primera pieza/);
  await page.getByRole('button',{name:'Eliminar'}).click();
  assert.match(await page.locator('#savedList').innerText(),/Todavía no hay patrones/);
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.goto('http://127.0.0.1:'+port+'/constructor.html');
  await mobile.locator('#shape').selectOption('cylinder');
  await mobile.locator('#builder button[type="submit"]').click();
  assert.match(await mobile.locator('#output').innerText(),/El cilindro queda abierto por arriba/);
  const dimensions=await mobile.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(dimensions.scroll<=dimensions.client+1,'La interfaz móvil tiene desbordamiento horizontal');
  console.log('Constructor UI: generación, guardado, apertura, eliminación y vista móvil correctos.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
