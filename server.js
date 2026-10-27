const express=require('express');
const multer=require('multer');
const OpenAI=require('openai');
const path=require('path');
const crypto=require('crypto');
const { validatePattern } = require('./pattern-validator.cjs');
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:4,parts:5},fileFilter:(req,file,cb)=>{if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype))return cb(new Error('Formato de imagen no admitido. Usa JPG, PNG, WEBP o GIF.'));cb(null,true);}});
app.use(express.json({limit:'2mb'}));

// Anonymous sessions use a signed, HttpOnly cookie. Client-supplied user IDs are never
// accepted as proof of identity for memory access.
const isProduction=process.env.NODE_ENV==='production'||Boolean(process.env.RAILWAY_ENVIRONMENT);
const configuredSessionSecret=String(process.env.PUNTIA_SESSION_SECRET||'');
if(isProduction&&Buffer.byteLength(configuredSessionSecret,'utf8')<32){
  throw new Error('PUNTIA_SESSION_SECRET es obligatorio en producción y debe tener al menos 32 bytes.');
}
const sessionSecret=configuredSessionSecret||crypto.randomBytes(32).toString('hex');
if(!configuredSessionSecret) console.warn('PUNTIA_SESSION_SECRET no configurado; las sesiones se invalidarán al reiniciar el proceso.');
const SESSION_COOKIE='puntia_sid';
function signSessionId(id){return crypto.createHmac('sha256',sessionSecret).update(id).digest('base64url');}
function parseCookies(header){const result={};for(const part of String(header||'').split(';')){const index=part.indexOf('=');if(index>0){const key=part.slice(0,index).trim();try{result[key]=decodeURIComponent(part.slice(index+1).trim())}catch{}}}return result;}
function establishSession(req,res,next){
  const cookies=parseCookies(req.headers.cookie);
  const candidate=String(cookies[SESSION_COOKIE]||'');
  const [id,signature,...extra]=candidate.split('.');
  let valid=false;
  if(!extra.length&&/^[a-f0-9]{64}$/.test(id||'')&&signature){
    const expected=Buffer.from(signSessionId(id));
    const received=Buffer.from(signature);
    valid=expected.length===received.length&&crypto.timingSafeEqual(expected,received);
  }
  const sessionId=valid?id:crypto.randomBytes(32).toString('hex');
  req.puntiaUserId=sessionId;
  if(!valid){
    const secure=process.env.NODE_ENV==='production'||Boolean(process.env.RAILWAY_ENVIRONMENT);
    res.append('Set-Cookie',SESSION_COOKIE+'='+encodeURIComponent(sessionId+'.'+signSessionId(sessionId))+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'+(secure?'; Secure':''));
  }
  next();
}
app.use(establishSession);
app.use(express.static(path.join(__dirname,'public')));
const client=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:Number(process.env.OPENAI_TIMEOUT_MS||45000),maxRetries:0}):null;
const TEXT_MODEL=process.env.OPENAI_MODEL||'gpt-4o-mini';
const VISION_MODEL=process.env.OPENAI_VISION_MODEL||'gpt-4o';
const configuredAiConcurrency=Number.parseInt(process.env.MAX_ACTIVE_AI_REQUESTS||'4',10);
const MAX_ACTIVE_AI_REQUESTS=Number.isInteger(configuredAiConcurrency)?Math.min(20,Math.max(1,configuredAiConcurrency)):4;
let activeAiRequests=0;
function limitAiConcurrency(req,res,next){
  if(activeAiRequests>=MAX_ACTIVE_AI_REQUESTS){
    res.set('Retry-After','2');
    return res.status(429).json({error:'PuntIA está atendiendo otras solicitudes. Espera unos segundos e inténtalo de nuevo.'});
  }
  activeAiRequests++;
  let released=false;
  const release=()=>{if(released)return;released=true;activeAiRequests=Math.max(0,activeAiRequests-1);};
  res.once('finish',release);
  res.once('close',release);
  next();
}
app.use(['/api/puntia/chat','/api/puntia/generate-pattern','/api/puntia/diagnose','/api/diagnostics'],limitAiConcurrency);
const SYSTEM=`Eres PuntIA, asistente experto en crochet y amigurumi. Responde en español claro. Ayuda con patrones, conteos, materiales, técnicas, corrección de errores y enseñanza. No inventes que una foto fue analizada si no la recibiste. Cuando generes patrones, usa abreviaturas comunes (AM, pb, aum, dis), vueltas numeradas y conteos finales.`;
app.get('/api/health',(req,res)=>res.json({ok:true,ai:Boolean(client),model:TEXT_MODEL,vision:VISION_MODEL}));app.post('/api/diagnostics',async(req,res)=>{const diagnosticToken=process.env.DIAGNOSTICS_TOKEN;if(!diagnosticToken)return res.status(503).json({error:'Diagnóstico administrativo no habilitado.'});const auth=String(req.get('authorization')||'');if(auth!==`Bearer ${diagnosticToken}`)return res.status(401).json({error:'No autorizado.'});const result={memory:{ok:false,message:'No comprobada'},ai:{ok:false,message:'No comprobada'}};let testFile='';try{const fs=require('fs');const dir=path.join(__dirname,'data');fs.mkdirSync(dir,{recursive:true});testFile=path.join(dir,'.puntia-diagnostic-'+Date.now()+'.tmp');const marker='puntia-write-test-'+Date.now();fs.writeFileSync(testFile,marker,{encoding:'utf8',flag:'wx'});const read=fs.readFileSync(testFile,'utf8');if(read!==marker)throw new Error('La lectura no coincide con lo escrito');result.memory={ok:true,message:'Lectura y escritura verificadas'};}catch(e){result.memory={ok:false,message:'No se pudo escribir y leer el archivo de prueba'};console.error('PuntIA memory diagnostic failed:',e?.code||e?.name||'unknown')}finally{if(testFile){try{require('fs').unlinkSync(testFile)}catch{}}}try{const output=await responseText([{role:'user',content:'Responde exactamente: PUNTIA_OK'}]);result.ai={ok:output.includes('PUNTIA_OK'),message:output.includes('PUNTIA_OK')?'Llamada real a la IA verificada':'La IA respondió, pero no devolvió el texto de prueba esperado'};}catch(e){result.ai={ok:false,message:e?.status===400?'La API rechazó la solicitud (HTTP 400); revisa modelo y compatibilidad.':e?.status===401||e?.status===403?'La clave o sus permisos fueron rechazados.':e?.status===429?'Límite o cuota de IA alcanzado.':'La llamada real a la IA falló; revisa los registros del servidor.'};console.error('PuntIA AI diagnostic failed:',e?.status||e?.code||e?.name||'unknown')}res.json({ok:result.memory.ok&&result.ai.ok,...result});});
async function responseText(input,model=TEXT_MODEL){if(!client){const e=new Error('OPENAI_API_KEY no configurada');e.code='AI_NOT_CONFIGURED';throw e;}const r=await client.responses.create({model,input,instructions:SYSTEM});const output=String(r.output_text||'').trim();if(!output)throw new Error('La IA devolvió una respuesta vacía.');return output;}
function sendApiError(res,e,fallback){if(e?.code==='AI_NOT_CONFIGURED')return res.status(503).json({error:'La IA no está configurada en el servidor.'});const timedOut=e?.name==='APIConnectionTimeoutError'||e?.code==='ETIMEDOUT'||e?.code==='UND_ERR_CONNECT_TIMEOUT';console.error('PuntIA API error:',e?.status||e?.code||e?.name||'unknown');if(timedOut)return res.status(504).json({error:'La generación tardó demasiado. Inténtalo de nuevo; si se repite, revisa el modelo y la conexión del servidor.'});if(e?.status===429)return res.status(429).json({error:'El servicio de IA alcanzó su límite de uso. Revisa la cuota o inténtalo más tarde.'});if(e?.status===401||e?.status===403)return res.status(503).json({error:'La configuración de acceso al servicio de IA no es válida. Revisa la clave y los permisos del servidor.'});return res.status(500).json({error:fallback});}
function textField(value,fallback,max){const v=String(value??fallback).trim();return v.slice(0,max)||fallback;}
function validMemoryUserId(value){const id=String(value||'').trim();return id.length>=32&&id.length<=100&&/^[a-zA-Z0-9_-]+$/.test(id)&&id!=='demo-user';}
app.post('/api/puntia/chat',async(req,res)=>{try{const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({error:'Escribe un mensaje.'});if(message.length>8000)return res.status(413).json({error:'El mensaje supera el límite de 8000 caracteres.'});const userId=req.puntiaUserId;const db=userId?readMemory():{};const memories=userId?(db[userId]||[]).slice(-12).map(x=>x.content).join('\n'):'';const context=memories?'Memoria relevante y reciente del usuario (úsala solo si ayuda):\n'+memories+'\n\nMensaje actual: '+message:message;const reply=await responseText([{role:'user',content:context}]);if(userId){await mutateMemory(userId,current=>{current.push({content:'Usuario: '+message,category:'conversation',createdAt:new Date().toISOString()},{content:'PuntIA: '+reply,category:'assistant_reply',createdAt:new Date().toISOString()});return current.slice(-200)});}res.json({reply,emotion:emotionFor(reply),memorySaved:Boolean(userId)})}catch(e){return sendApiError(res,e,'No se pudo responder. Inténtalo de nuevo.')}});
app.post('/api/puntia/generate-pattern',async(req,res)=>{try{const name=textField(req.body?.name,'amigurumi',160),level=textField(req.body?.level,'Intermedio',60),height=textField(req.body?.height,'15 cm',40),style=textField(req.body?.style,'tierno y clásico',120);const prompt=`Genera un patrón de crochet/amigurumi que pueda seguirse y comprobarse para: ${name}. Nivel: ${level}. Tamaño aproximado: ${height}. Estilo: ${style}. Responde en español y usa esta estructura: 1) materiales con cantidades aproximadas; 2) abreviaturas; 3) piezas separadas con rondas numeradas; 4) cada ronda indica puntos y total final entre paréntesis; 5) instrucciones de relleno y ensamblaje; 6) consejos de seguridad si es un juguete infantil. Mantén coherencia matemática entre aumentos, disminuciones y conteos. No afirmes que el patrón fue probado físicamente. Si una cuenta no cuadra, corrígela antes de responder.`;const pattern=await responseText([{role:'user',content:prompt}]);if(pattern.length<80)return res.status(502).json({error:'La respuesta generada fue demasiado corta. Inténtalo de nuevo.'});const validation=validatePattern(pattern);res.json({pattern,name,height,level,validation:{checkedRounds:validation.checkedRounds,validRounds:validation.validRounds,invalidRounds:validation.invalidRounds,unverifiedRounds:validation.unverifiedRounds}})}catch(e){return sendApiError(res,e,'No se pudo generar el patrón. Inténtalo de nuevo.')}});
app.post('/api/puntia/diagnose',upload.single('image'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'Falta la imagen.'});const detectedMime=detectImageMime(req.file.buffer);if(!detectedMime||detectedMime!==req.file.mimetype)return res.status(415).json({error:'El contenido no coincide con el formato de imagen declarado.'});if(!client)return res.status(503).json({error:'OPENAI_API_KEY no configurada'});const b64=req.file.buffer.toString('base64');const data=`data:${req.file.mimetype};base64,${b64}`;const r=await client.responses.create({model:VISION_MODEL,instructions:`${SYSTEM}\nAnaliza la imagen de tejido como instructor de crochet. Identifica solamente problemas visibles o indica que no son concluyentes. Explica: problema, dónde, por qué puede ocurrir, cómo corregirlo y cómo evitarlo.`,input:[{role:'user',content:[{type:'input_text',text:'Analiza esta pieza de crochet y dame un diagnóstico práctico.'},{type:'input_image',image_url:data}]}]});res.json({analysis:r.output_text||'No fue posible obtener un análisis.'})}catch(e){return sendApiError(res,e,'No se pudo analizar la imagen. Verifica el archivo e inténtalo de nuevo.')}});
// --- PuntIA virtual companion: persistent memory and emotion state ---
const fs=require('fs');
const MEMORY_FILE=path.join(__dirname,'data','puntia-memory.json');
function detectImageMime(buffer){if(!Buffer.isBuffer(buffer))return null;if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'image/jpeg';if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return 'image/png';if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'image/webp';if(buffer.length>=6&&['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6)))return 'image/gif';return null;}
function readMemory(){try{return JSON.parse(fs.readFileSync(MEMORY_FILE,'utf8'))}catch{return {}}}
function writeMemory(data){fs.mkdirSync(path.dirname(MEMORY_FILE),{recursive:true});const tmp=MEMORY_FILE+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(data,null,2),{encoding:'utf8',flag:'wx',mode:0o600});fs.renameSync(tmp,MEMORY_FILE);}finally{try{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}catch{}}}
// The JSON file stores all users together, so mutations must be serialized globally.
let memoryQueue=Promise.resolve();
function withMemoryLock(userId,task){
  const current=memoryQueue.then(task,task);
  memoryQueue=current.then(()=>undefined,()=>undefined);
  return current;
}
function mutateMemory(userId,mutator){
  return withMemoryLock(userId,()=>{
    const db=readMemory();
    const current=Array.isArray(db[userId])?db[userId].slice():[];
    const next=mutator(current);
    db[userId]=Array.isArray(next)?next.slice(-200):current;
    writeMemory(db);
    return db[userId].length;
  });
}
function deleteUserMemory(userId){
  return withMemoryLock(userId,()=>{
    const db=readMemory();
    delete db[userId];
    writeMemory(db);
    return true;
  });
}
function emotionFor(text){const t=String(text||'').toLowerCase();if(/felicidades|lo logramos|¡listo|excelente|genial|perfecto/.test(t))return 'excited';if(/no te preocupes|vamos con calma|lo corregimos|error|difícil/.test(t))return 'concerned';if(/patrón|patron|vuelta|puntos|materiales|paso a paso/.test(t))return 'focused';if(/¿qué|cuéntame|qué te gustaría|explorar/.test(t))return 'curious';return 'happy'}
app.get('/api/puntia/memory/:userId',(req,res)=>{const userId=req.puntiaUserId;const db=readMemory();res.json({items:(db[userId]||[]).slice(-50)})});
app.post('/api/puntia/memory',(req,res)=>{const userId=req.puntiaUserId;const content=String(req.body?.content||'').trim().slice(0,2000);const category=String(req.body?.category||'note').slice(0,40);if(!content)return res.status(400).json({error:'La memoria está vacía.'});mutateMemory(userId,current=>{current.push({content,category,createdAt:new Date().toISOString()});return current.slice(-200)}).then(count=>res.json({saved:true,count})).catch(()=>res.status(500).json({error:'No se pudo guardar la memoria.'}))});
function rejectCrossOriginMutation(req,res,next){
  const origin=req.get('origin');
  if(!origin)return next();
  const forwardedProto=String(req.get('x-forwarded-proto')||req.protocol).split(',')[0].trim();
  const expectedOrigin=forwardedProto+'://'+req.get('host');
  if(origin!==expectedOrigin)return res.status(403).json({error:'Solicitud de otro origen bloqueada.'});
  next();
}
app.use('/api/puntia/memory',(req,res,next)=>{
  if(req.method==='POST'||req.method==='DELETE')return rejectCrossOriginMutation(req,res,next);
  next();
});
app.delete('/api/puntia/memory/:userId',(req,res)=>{const userId=req.puntiaUserId;deleteUserMemory(userId).then(()=>res.json({deleted:true})).catch(()=>res.status(500).json({error:'No se pudo borrar la memoria.'}))});
app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.use((err,req,res,next)=>{if(err instanceof multer.MulterError){const status=err.code==='LIMIT_FILE_SIZE'?413:400;return res.status(status).json({error:err.code==='LIMIT_FILE_SIZE'?'La imagen supera el límite de 8 MB.':'No se pudo recibir la imagen.'});}if(err?.message==='Formato de imagen no admitido. Usa JPG, PNG, WEBP o GIF.')return res.status(415).json({error:err.message});console.error('PuntIA request error:',err?.name||'unknown');return res.status(500).json({error:'Error interno del servidor.'});});

const port=Number(process.env.PORT||8080);app.listen(port,()=>console.log(`PuntIA v3 escuchando en ${port}`));
