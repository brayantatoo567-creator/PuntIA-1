const express=require('express');
const multer=require('multer');
const OpenAI=require('openai');
const path=require('path');
const crypto=require('crypto');
const { validatePattern, validateProject } = require('./pattern-validator.cjs');
const { parseMemory } = require('./memory-store.cjs');
const { Pool } = require('pg');
const { createAdminPanel } = require('./admin-panel.cjs');
const app=express();
const allowedOrigins=new Set(String(process.env.PUNTIA_ALLOWED_ORIGINS||'https://localhost,capacitor://localhost').split(',').map(value=>value.trim()).filter(Boolean));
function requestOrigin(req){const proto=String(req.get('x-forwarded-proto')||req.protocol).split(',')[0].trim();return proto+'://'+req.get('host');}
app.use((req,res,next)=>{
  const origin=req.get('origin');
  if(!origin)return next();
  if(origin!==requestOrigin(req)&&!allowedOrigins.has(origin))return res.status(403).json({error:'Origen no autorizado.'});
  res.set('Access-Control-Allow-Origin',origin);
  res.set('Access-Control-Allow-Credentials','true');
  res.vary('Origin');
  if(req.method==='OPTIONS'){
    res.set('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers','Content-Type,Authorization');
    res.set('Access-Control-Max-Age','600');
    return res.status(204).end();
  }
  next();
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:8*1024*1024,files:1,fields:4,parts:5},fileFilter:(req,file,cb)=>{if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype))return cb(new Error('Formato de imagen no admitido. Usa JPG, PNG, WEBP o GIF.'));cb(null,true);}});
app.use(express.json({limit:'2mb'}));

// Anonymous sessions use a signed, HttpOnly cookie. Client-supplied user IDs are never
// accepted as proof of identity for memory access.
const isProduction=process.env.NODE_ENV==='production'||Boolean(process.env.RENDER)||Boolean(process.env.RAILWAY_ENVIRONMENT);
const databaseUrl=String(process.env.DATABASE_URL||'').trim();
if(isProduction&&!databaseUrl)throw new Error('DATABASE_URL es obligatorio en producción para proteger la memoria de PuntIA.');
const pool=databaseUrl?new Pool({connectionString:databaseUrl,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000}):null;
if(pool)pool.on('error',error=>console.error('PuntIA PostgreSQL idle client error:',error?.code||error?.name||'unknown'));
const configuredSessionSecret=String(process.env.SESSION_SECRET||process.env.PUNTIA_SESSION_SECRET||'');
if(isProduction&&Buffer.byteLength(configuredSessionSecret,'utf8')<32){
  throw new Error('PUNTIA_SESSION_SECRET es obligatorio en producción y debe tener al menos 32 bytes.');
}
const sessionSecret=configuredSessionSecret||crypto.randomBytes(32).toString('hex');
if(!configuredSessionSecret) console.warn('SESSION_SECRET no configurado; las sesiones se invalidarán al reiniciar el proceso.');
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
    res.append('Set-Cookie',SESSION_COOKIE+'='+encodeURIComponent(sessionId+'.'+signSessionId(sessionId))+'; Path=/; HttpOnly; SameSite='+(secure?'None':'Lax')+'; Max-Age=2592000'+(secure?'; Secure':''));
  }
  next();
}
app.use(establishSession);
const adminPanel=createAdminPanel({app,pool,publicDir:path.join(__dirname,'public')});
app.use(express.static(path.join(__dirname,'public')));
app.use(['/api/puntia/chat','/api/puntia/generate-pattern','/api/puntia/diagnose','/api/imaginaria/create','/api/imaginaria/step-image'],adminPanel.aiMiddleware);
app.use(['/api/puntia/test-key','/api/diagnostics'],adminPanel.keyOnlyMiddleware);
function openAiClient(req){const apiKey=String(req.openAiKey||'').trim();if(!apiKey){const e=new Error('API key no configurada');e.code='AI_NOT_CONFIGURED';throw e;}if(apiKey.length<20||apiKey.length>500){const e=new Error('API key inválida');e.code='AI_KEY_INVALID';throw e;}return new OpenAI({apiKey,timeout:Number(process.env.OPENAI_TIMEOUT_MS||45000),maxRetries:0});}
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
app.use(['/api/puntia/chat','/api/puntia/generate-pattern','/api/puntia/diagnose','/api/puntia/test-key','/api/diagnostics','/api/imaginaria/create','/api/imaginaria/step-image'],limitAiConcurrency);
// Per-session quotas protect the single-instance beta from loops and sequential abuse.
const requestWindows=new Map();
const RATE_LIMIT_WINDOW_MS=15*60*1000;
const RATE_LIMITS={'/api/puntia/chat':30,'/api/puntia/generate-pattern':10,'/api/puntia/diagnose':5,'/api/puntia/test-key':5,'/api/diagnostics':5,'/api/imaginaria/create':6,'/api/imaginaria/step-image':8};
function rateLimitAi(req,res,next){
  const max=RATE_LIMITS[req.path];if(!max)return next();
  const identity=req.path==='/api/diagnostics'?String(req.ip||'unknown'):String(req.puntiaUserId||req.ip||'unknown');
  const key=req.path+':'+identity;const now=Date.now();
  let bucket=requestWindows.get(key);if(!bucket||now-bucket.startedAt>=RATE_LIMIT_WINDOW_MS)bucket={startedAt:now,count:0};
  bucket.count++;requestWindows.set(key,bucket);
  if(requestWindows.size>5000){for(const [k,v] of requestWindows){if(now-v.startedAt>=RATE_LIMIT_WINDOW_MS)requestWindows.delete(k);}}
  if(bucket.count>max){const retry=Math.max(1,Math.ceil((RATE_LIMIT_WINDOW_MS-(now-bucket.startedAt))/1000));res.set('Retry-After',String(retry));return res.status(429).json({error:'Alcanzaste el límite temporal de esta función. Espera antes de volver a intentarlo.',retryAfter:retry});}
  next();
}
app.use(rateLimitAi);
const SYSTEM=`Eres Tejilume, un estudio de diseño técnico de crochet y amigurumi. Tu misión es convertir ideas inusuales en estructuras tejibles, con instrucciones claras y conteos coherentes. Responde en español claro. Ayuda con patrones, conteos, materiales, técnicas, corrección de errores y enseñanza. No inventes que una foto fue analizada si no la recibiste. Cuando generes patrones, usa abreviaturas comunes (AM, pb, aum, dis), vueltas numeradas y conteos finales.`;
app.get('/api/health',async(req,res)=>{let database=false,ai=false;try{if(pool){await pool.query('SELECT 1');database=true;}else database=!isProduction;}catch(error){console.error('TEJILUME database health check failed:',error?.code||error?.name||'unknown');}try{ai=await adminPanel.aiConfigured();}catch{}res.status(database?200:503).json({ok:database,ai,database,model:TEXT_MODEL,vision:VISION_MODEL});});app.post('/api/diagnostics',async(req,res)=>{const diagnosticToken=process.env.DIAGNOSTICS_TOKEN;if(!diagnosticToken)return res.status(503).json({error:'Diagnóstico administrativo no habilitado.'});const auth=String(req.get('authorization')||'');if(auth!==`Bearer ${diagnosticToken}`)return res.status(401).json({error:'No autorizado.'});const result={memory:{ok:false,message:'No comprobada'},ai:{ok:false,message:'No comprobada'}};try{if(!pool)throw new Error('DATABASE_URL no configurada');await pool.query('SELECT 1 FROM puntia_memory_sessions LIMIT 1');result.memory={ok:true,message:'PostgreSQL conectado y tabla de memoria disponible'};}catch(e){result.memory={ok:false,message:'No se pudo comprobar la base de datos de memoria'};console.error('PuntIA database diagnostic failed:',e?.code||e?.name||'unknown')}try{const output=await responseText(req,[{role:'user',content:'Responde exactamente: PUNTIA_OK'}]);result.ai={ok:output.includes('PUNTIA_OK'),message:output.includes('PUNTIA_OK')?'Llamada real a la IA verificada':'La IA respondió, pero no devolvió el texto de prueba esperado'};}catch(e){result.ai={ok:false,message:e?.status===400?'La API rechazó la solicitud (HTTP 400); revisa modelo y compatibilidad.':e?.status===401||e?.status===403?'La clave o sus permisos fueron rechazados.':e?.status===429?'Límite o cuota de IA alcanzado.':'La llamada real a la IA falló; revisa los registros del servidor.'};console.error('PuntIA AI diagnostic failed:',e?.status||e?.code||e?.name||'unknown')}res.json({ok:result.memory.ok&&result.ai.ok,...result});});
async function responseText(req,input,model=TEXT_MODEL){const client=openAiClient(req);const r=await client.responses.create({model,input,instructions:SYSTEM});const output=String(r.output_text||'').trim();if(!output)throw new Error('La IA devolvió una respuesta vacía.');return output;}
function sendApiError(res,e,fallback){if(e?.code==='AI_NOT_CONFIGURED')return res.status(503).json({error:'La IA no está configurada en el servidor.'});const timedOut=e?.name==='APIConnectionTimeoutError'||e?.code==='ETIMEDOUT'||e?.code==='UND_ERR_CONNECT_TIMEOUT';console.error('PuntIA API error:',e?.status||e?.code||e?.name||'unknown');if(timedOut)return res.status(504).json({error:'La generación tardó demasiado. Inténtalo de nuevo; si se repite, revisa el modelo y la conexión del servidor.'});if(e?.status===429)return res.status(429).json({error:'El servicio de IA alcanzó su límite de uso. Revisa la cuota o inténtalo más tarde.'});if(e?.status===401||e?.status===403)return res.status(503).json({error:'La configuración de acceso al servicio de IA no es válida. Revisa la clave y los permisos del servidor.'});return res.status(500).json({error:fallback});}
function textField(value,fallback,max){const v=String(value??fallback).trim();return v.slice(0,max)||fallback;}
function validMemoryUserId(value){const id=String(value||'').trim();return id.length>=32&&id.length<=100&&/^[a-zA-Z0-9_-]+$/.test(id)&&id!=='demo-user';}
app.post('/api/puntia/test-key',async(req,res)=>{try{const output=await responseText(req,[{role:'user',content:'Responde exactamente: PUNTIA_CONECTADA'}]);if(!output.includes('PUNTIA_CONECTADA'))return res.status(502).json({ok:false,error:'La API respondió, pero la prueba no fue concluyente.'});res.json({ok:true,message:'Conexión con OpenAI correcta.'});}catch(e){return sendApiError(res,e,'No se pudo validar la clave.')}});
app.post('/api/puntia/chat',async(req,res)=>{try{const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({error:'Escribe un mensaje.'});if(message.length>8000)return res.status(413).json({error:'El mensaje supera el límite de 8000 caracteres.'});const userId=req.puntiaUserId;const recentMemory=userId?await readMemory(userId,12):[];const memories=recentMemory.map(x=>x.content).join('\\n');const context=memories?'Memoria relevante y reciente del usuario (úsala solo si ayuda):\n'+memories+'\n\nMensaje actual: '+message:message;const reply=await responseText(req,[{role:'user',content:context}]);if(userId){await mutateMemory(userId,current=>{current.push({content:'Usuario: '+message,category:'conversation',createdAt:new Date().toISOString()},{content:'PuntIA: '+reply,category:'assistant_reply',createdAt:new Date().toISOString()});return current.slice(-200)});}res.json({reply,emotion:emotionFor(reply),memorySaved:Boolean(userId)})}catch(e){return sendApiError(res,e,'No se pudo responder. Inténtalo de nuevo.')}});
app.post('/api/puntia/generate-pattern',async(req,res)=>{try{const name=textField(req.body?.name,'amigurumi',160),level=textField(req.body?.level,'Intermedio',60),height=textField(req.body?.height,'15 cm',40),style=textField(req.body?.style,'tierno y clásico',120);const prompt=`Genera un patrón de crochet/amigurumi que pueda seguirse y comprobarse para: ${name}. Nivel: ${level}. Tamaño aproximado: ${height}. Estilo: ${style}. Responde en español y usa esta estructura: 1) materiales con cantidades aproximadas; 2) abreviaturas; 3) piezas separadas con rondas numeradas; 4) cada ronda indica puntos y total final entre paréntesis; 5) instrucciones de relleno y ensamblaje; 6) consejos de seguridad si es un juguete infantil. Mantén coherencia matemática entre aumentos, disminuciones y conteos. No afirmes que el patrón fue probado físicamente. Si una cuenta no cuadra, corrígela antes de responder.`;const pattern=await responseText(req,[{role:'user',content:prompt}]);if(pattern.length<80)return res.status(502).json({error:'La respuesta generada fue demasiado corta. Inténtalo de nuevo.'});const validation=validatePattern(pattern);res.json({pattern,name,height,level,validation:{checkedRounds:validation.checkedRounds,validRounds:validation.validRounds,invalidRounds:validation.invalidRounds,unverifiedRounds:validation.unverifiedRounds}})}catch(e){return sendApiError(res,e,'No se pudo generar el patrón. Inténtalo de nuevo.')}});
app.post('/api/imaginaria/create',upload.single('image'),async(req,res)=>{try{
  const idea=textField(req.body?.idea,'',3000),level=textField(req.body?.level,'Intermedio',40),height=textField(req.body?.height,'15 cm',40),style=textField(req.body?.style,'fiel a la idea original',120),yarn=textField(req.body?.yarn,'Hilo de algodón',100);
  if(!idea&&!req.file)return res.status(400).json({error:'Describe tu idea o sube una fotografía.'});
  let visualBrief='';
  if(req.file){
    const detectedMime=detectImageMime(req.file.buffer);
    if(!detectedMime||detectedMime!==req.file.mimetype)return res.status(415).json({error:'La imagen no coincide con su formato declarado.'});
    const client=openAiClient(req),data=`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const vision=await client.responses.create({model:VISION_MODEL,instructions:'Analiza la imagen para convertir su sujeto en un diseño de crochet/amigurumi. Describe únicamente rasgos visuales, silueta, proporciones, colores, piezas separables y detalles importantes. Propón simplificaciones tejibles sin perder la identidad visual. No inventes medidas ni afirmes que el objeto ya fue tejido.',input:[{role:'user',content:[{type:'input_text',text:'Prepara una ficha visual técnica para construir esta idea con crochet. Si el usuario añadió instrucciones, respétalas: '+(idea||'Convierte la imagen en un proyecto de crochet.')},{type:'input_image',image_url:data}]}]});
    visualBrief=String(vision.output_text||'').trim();
    if(!visualBrief)return res.status(502).json({error:'No se pudo interpretar la fotografía. Prueba con una imagen más clara.'});
  }
  const brief=[idea?'Idea del usuario: '+idea:'',visualBrief?'Análisis visual de la fotografía: '+visualBrief:''].filter(Boolean).join('\n\n');
  const prompt=`Actúa como diseñadora técnica experta en crochet y amigurumi. Convierte esta idea en un patrón detallado que una persona pueda intentar tejer: \n${brief}\n\nParámetros: nivel ${level}; altura aproximada ${height}; hilo ${yarn}; estilo ${style}.\n\nREGLAS OBLIGATORIAS: no rechaces ideas absurdas; tradúcelas a formas tejibles mediante piezas, volúmenes, uniones y estructuras alternativas. Si algo no puede reproducirse literalmente, explica la adaptación más cercana. No inventes pruebas físicas. Da materiales con cantidades, abreviaturas, tensión orientativa. OBLIGATORIO: crea primero un bloque INVENTARIO DE PIEZAS con una línea '- nombre exacto' por cada pieza; después desarrolla cada una con el encabezado PIEZA: nombre exacto y sus vueltas numeradas desde Vuelta 1. No omitas patas, brazos, ojos, accesorios, soportes ni piezas de unión. La secuencia de cada pieza debe ser continua y cada vuelta debe consumir exactamente los puntos de la vuelta anterior. Termina con ENSAMBLAJE y menciona cada pieza del inventario por su nombre exacto. Incluye MATERIALES. Cada vuelta matemática debe usar notación simple reconocible: "Vuelta N: X pb, Y aum, Z dis (TOTAL)"; los grupos repetidos deben expresarse como "(1 pb, 1 aum) x 6 (18)". Explica cambios de color, relleno, montaje, bordado y seguridad. Incluye una sección "Guía visual por etapas" con 4-6 etapas concretas y qué debe verse al terminar cada una. Si no hay información suficiente, declara supuestos razonables y continúa. Responde en español claro, con instrucciones ejecutables, sin afirmar que está probado físicamente.`;
  let pattern=await responseText(req,[{role:'user',content:prompt}]);
  if(pattern.length<300)return res.status(502).json({error:'La respuesta del generador fue incompleta. Inténtalo de nuevo.'});
  let validation=validatePattern(pattern),projectValidation=validateProject(pattern);
  if(validation.invalidRounds>0||validation.unverifiedRounds>0||!projectValidation.ok){
    const correction=await responseText(req,[{role:'user',content:'Repara este patrón para que sea ejecutable y supere todas las comprobaciones. Conserva el diseño y las piezas. Debes incluir MATERIALES, INVENTARIO DE PIEZAS, una sección PIEZA: por cada elemento inventariado, vueltas numeradas sin saltos desde 1, cada vuelta debe consumir exactamente los puntos de la vuelta anterior, y ENSAMBLAJE mencionando todas las piezas. Corrige tanto totales como entradas/salidas de puntos. No ocultes piezas ni declares pruebas físicas.\n\nProblemas detectados: '+JSON.stringify(projectValidation.issues)+'\n\nVueltas con problemas: '+JSON.stringify(validation.results.filter(x=>x.status!=='valid'))+'\n\nPatrón original:\n'+pattern}]);
    if(correction.length>300){pattern=correction;validation=validatePattern(pattern);projectValidation=validateProject(pattern);}
  }
  const verified=projectValidation.ok&&validation.checkedRounds>0&&validation.invalidRounds===0&&validation.unverifiedRounds===0;
  if(!verified)return res.status(422).json({error:'El patrón no superó la revisión de estructura y puntos. No se entregó como patrón listo para tejer.',validation:{...projectValidation,math:validation}});
  res.json({name:idea||'Diseño desde fotografía',pattern,visualBrief,height,level,validation:{checkedRounds:validation.checkedRounds,validRounds:validation.validRounds,invalidRounds:validation.invalidRounds,unverifiedRounds:validation.unverifiedRounds,pieces:projectValidation.pieces,issues:projectValidation.issues,results:validation.results},status:'structure_and_math_checked',notice:'El inventario, las piezas, el orden y los conteos reconocidos superaron las comprobaciones automáticas. Esto no sustituye una muestra tejida físicamente.'});
}catch(e){return sendApiError(res,e,'No se pudo crear el proyecto. Revisa la conexión e inténtalo de nuevo.')}});
app.post('/api/imaginaria/step-image',async(req,res)=>{try{
  const step=textField(req.body?.step,'Vista del proyecto terminado',900),context=textField(req.body?.context,'Proyecto de crochet',2500),stage=textField(req.body?.stage,'Etapa del tejido',100);
  const client=openAiClient(req);
  const prompt='Crea una lámina didáctica clara y realista de crochet/amigurumi para enseñar la etapa: '+stage+'. Instrucción exacta: '+step+'. Contexto del patrón: '+context+'. Mostrar una sola etapa de construcción, materiales y puntos visibles coherentes con la instrucción. Vista cercana, iluminación limpia, fondo neutro, sin texto, sin marcas de agua, sin collage, sin manos deformes. La imagen debe parecer una fotografía editorial de una pieza tejida a mano y no una ilustración decorativa.';
  const generated=await client.images.generate({model:process.env.OPENAI_IMAGE_MODEL||'gpt-image-1',prompt,size:'1024x1024',n:1});
  const encoded=generated?.data?.[0]?.b64_json;
  if(!encoded)return res.status(502).json({error:'El generador de imágenes no devolvió una imagen.'});
  res.json({image:'data:image/png;base64,'+encoded,stage});
}catch(e){return sendApiError(res,e,'No se pudo generar la imagen de esta etapa. Revisa el acceso al modelo de imágenes.')}});
app.post('/api/puntia/diagnose',upload.single('image'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'Falta la imagen.'});const detectedMime=detectImageMime(req.file.buffer);if(!detectedMime||detectedMime!==req.file.mimetype)return res.status(415).json({error:'El contenido no coincide con el formato de imagen declarado.'});const client=openAiClient(req);const b64=req.file.buffer.toString('base64');const data=`data:${req.file.mimetype};base64,${b64}`;const r=await client.responses.create({model:VISION_MODEL,instructions:`${SYSTEM}\nAnaliza la imagen de tejido como instructor de crochet. Identifica solamente problemas visibles o indica que no son concluyentes. Explica: problema, dónde, por qué puede ocurrir, cómo corregirlo y cómo evitarlo.`,input:[{role:'user',content:[{type:'input_text',text:'Analiza esta pieza de crochet y dame un diagnóstico práctico.'},{type:'input_image',image_url:data}]}]});res.json({analysis:r.output_text||'No fue posible obtener un análisis.'})}catch(e){return sendApiError(res,e,'No se pudo analizar la imagen. Verifica el archivo e inténtalo de nuevo.')}});
// --- PuntIA virtual companion: persistent memory and emotion state ---
const fs=require('fs');
const MEMORY_FILE=path.join(__dirname,'data','puntia-memory.json');
function detectImageMime(buffer){if(!Buffer.isBuffer(buffer))return null;if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'image/jpeg';if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return 'image/png';if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return 'image/webp';if(buffer.length>=6&&['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6)))return 'image/gif';return null;}
async function readMemory(userId,limit=50){
  if(pool){const result=await pool.query('SELECT content,category,created_at FROM puntia_memory WHERE session_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2',[userId,Math.max(1,Math.min(200,limit))]);return result.rows.reverse().map(row=>({content:row.content,category:row.category,createdAt:new Date(row.created_at).toISOString()}));}
  const db=readLocalMemory();return (db[userId]||[]).slice(-limit);
}
function readLocalMemory(){try{return parseMemory(fs.readFileSync(MEMORY_FILE,'utf8'));}catch(error){if(error?.code==='ENOENT')return {};console.error('PuntIA local memory read failed:',error?.code||error?.name||'invalid-data');throw new Error('No se pudo leer la memoria local; se cancela la operación para evitar sobrescribir datos dañados.');}}
function writeLocalMemory(data){fs.mkdirSync(path.dirname(MEMORY_FILE),{recursive:true});const tmp=MEMORY_FILE+'.'+process.pid+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(data,null,2),{encoding:'utf8',flag:'wx',mode:0o600});fs.renameSync(tmp,MEMORY_FILE);}finally{try{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}catch{}}}
let memoryQueue=Promise.resolve();
function withMemoryLock(userId,task){const current=memoryQueue.then(task,task);memoryQueue=current.then(()=>undefined,()=>undefined);return current;}
async function mutateMemory(userId,mutator){
 if(pool){const client=await pool.connect();try{await client.query('BEGIN');await client.query('INSERT INTO puntia_memory_sessions(session_id) VALUES($1) ON CONFLICT(session_id) DO NOTHING',[userId]);await client.query('SELECT session_id FROM puntia_memory_sessions WHERE session_id=$1 FOR UPDATE',[userId]);const rows=await client.query('SELECT content,category,created_at FROM puntia_memory WHERE session_id=$1 ORDER BY created_at ASC,id ASC',[userId]);const current=rows.rows.map(row=>({content:row.content,category:row.category,createdAt:new Date(row.created_at).toISOString()}));const next=mutator(current)||current;const safe=Array.isArray(next)?next.slice(-200):current;await client.query('DELETE FROM puntia_memory WHERE session_id=$1',[userId]);for(const item of safe)await client.query('INSERT INTO puntia_memory(session_id,content,category,created_at) VALUES($1,$2,$3,$4)',[userId,String(item.content||''),String(item.category||'note'),item.createdAt||new Date().toISOString()]);await client.query('UPDATE puntia_memory_sessions SET updated_at=NOW() WHERE session_id=$1',[userId]);await client.query('COMMIT');return safe.length;}catch(error){try{await client.query('ROLLBACK')}catch{}throw error;}finally{client.release();}}
 return withMemoryLock(userId,()=>{const db=readLocalMemory();const current=Array.isArray(db[userId])?db[userId].slice():[];const next=mutator(current);db[userId]=Array.isArray(next)?next.slice(-200):current;writeLocalMemory(db);return db[userId].length;});
}
async function deleteUserMemory(userId){if(pool){await pool.query('DELETE FROM puntia_memory_sessions WHERE session_id=$1',[userId]);return true;}return withMemoryLock(userId,()=>{const db=readLocalMemory();delete db[userId];writeLocalMemory(db);return true;});}
function emotionFor(text){const t=String(text||'').toLowerCase();if(/felicidades|lo logramos|¡listo|excelente|genial|perfecto/.test(t))return 'excited';if(/no te preocupes|vamos con calma|lo corregimos|error|difícil/.test(t))return 'concerned';if(/patrón|patron|vuelta|puntos|materiales|paso a paso/.test(t))return 'focused';if(/¿qué|cuéntame|qué te gustaría|explorar/.test(t))return 'curious';return 'happy'}
function rejectCrossOriginMutation(req,res,next){
  const origin=req.get('origin');
  if(!origin)return next();
  if(origin!==requestOrigin(req)&&!allowedOrigins.has(origin))return res.status(403).json({error:'Solicitud de otro origen bloqueada.'});
  next();
}
app.use('/api/puntia/memory',(req,res,next)=>{
  if(req.method==='POST'||req.method==='DELETE')return rejectCrossOriginMutation(req,res,next);
  next();
});
app.get('/api/puntia/memory/:userId',async(req,res)=>{try{res.json({items:await readMemory(req.puntiaUserId,50)})}catch(error){console.error('PuntIA memory read failed:',error?.code||error?.name||'unknown');res.status(500).json({error:'No se pudo leer la memoria.'})}});
app.post('/api/puntia/memory',(req,res)=>{const userId=req.puntiaUserId;const content=String(req.body?.content||'').trim().slice(0,2000);const category=String(req.body?.category||'note').slice(0,40);if(!content)return res.status(400).json({error:'La memoria está vacía.'});mutateMemory(userId,current=>{current.push({content,category,createdAt:new Date().toISOString()});return current.slice(-200)}).then(count=>res.json({saved:true,count})).catch(()=>res.status(500).json({error:'No se pudo guardar la memoria.'}))});
app.delete('/api/puntia/memory/:userId',async(req,res)=>{try{await deleteUserMemory(req.puntiaUserId);res.json({deleted:true})}catch(error){console.error('PuntIA memory delete failed:',error?.code||error?.name||'unknown');res.status(500).json({error:'No se pudo borrar la memoria.'})}});
// Unknown API paths must return JSON 404 instead of silently serving the SPA shell.
app.use('/api', (req,res)=>res.status(404).json({error:'Ruta API no encontrada.'}));
app.get(/.*/,(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.use((err,req,res,next)=>{if(err instanceof multer.MulterError){const status=err.code==='LIMIT_FILE_SIZE'?413:400;return res.status(status).json({error:err.code==='LIMIT_FILE_SIZE'?'La imagen supera el límite de 8 MB.':'No se pudo recibir la imagen.'});}if(err?.message==='Formato de imagen no admitido. Usa JPG, PNG, WEBP o GIF.')return res.status(415).json({error:err.message});console.error('PuntIA request error:',err?.name||'unknown');return res.status(500).json({error:'Error interno del servidor.'});});

const port=Number(process.env.PORT||8080);adminPanel.init().then(()=>app.listen(port,()=>console.log(`TEJILUME escuchando en ${port}`))).catch(error=>{console.error('TEJILUME startup failed:',error?.code||error?.name||'unknown');process.exit(1);});
