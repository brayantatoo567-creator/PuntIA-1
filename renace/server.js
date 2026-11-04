import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app=express();
const PORT=Number(process.env.PORT||3000);
const MODEL=process.env.OPENAI_MODEL||"gpt-6-luna";
const dir=path.dirname(fileURLToPath(import.meta.url));
app.disable("x-powered-by");
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:"32kb"}));
app.use(express.static(path.join(dir,"public")));
app.get("/health",(_req,res)=>res.json({status:"ok",app:"RENACE",version:"0.3.0",aiConfigured:Boolean(process.env.OPENAI_API_KEY),model:MODEL}));
const limiter=rateLimit({windowMs:60000,limit:20,standardHeaders:"draft-8",legacyHeaders:false});
const schema=z.object({
 message:z.string().trim().min(1).max(4000),
 history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().min(1).max(4000)})).max(12).default([]),
 personalContext:z.string().max(5000).optional().default("")
}).strict();
const instructions="Eres RENACE, un asistente de reflexión y crecimiento personal. Escuchas con empatía, orientas con pasos concretos y actúas como mentor directo. No das siempre la razón: separas hechos, interpretaciones y emociones. No diagnosticas ni sustituyes atención profesional. No inventes recuerdos ni patrones; usa solo el contexto recibido. Si hay peligro inmediato, violencia o riesgo de autolesión, prioriza la seguridad y recomienda apoyo humano y servicios de emergencia locales. Responde en español claro, sin juzgar.";
app.post("/api/chat",limiter,async(req,res)=>{
 const parsed=schema.safeParse(req.body);
 if(!parsed.success)return res.status(400).json({error:"Solicitud inválida"});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"IA no configurada",code:"AI_NOT_CONFIGURED",message:"El servidor está listo, pero falta OPENAI_API_KEY en las variables secretas de Railway."});
 try{
  const {message,history,personalContext}=parsed.data;
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const context=personalContext?"\n\nCONTEXTO PERSONAL AUTORIZADO POR EL USUARIO:\n"+personalContext:"";
  const response=await client.responses.create({model:MODEL,instructions:instructions+context,input:[...history.slice(-12),{role:"user",content:message}],max_output_tokens:700});
  const reply=response.output_text?.trim();
  if(!reply)return res.status(502).json({error:"La IA no devolvió texto."});
  res.json({reply,model:MODEL});
 }catch(e){console.error("RENACE_AI_ERROR",{name:e?.name,status:e?.status,requestId:e?.request_id});res.status(502).json({error:"No fue posible obtener respuesta de IA. Revisa la configuración del servidor."});}
});
app.listen(PORT,"0.0.0.0",()=>console.log("RENACE listening on "+PORT));