import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const app=express();
const PORT=Number(process.env.PORT||3000);
const MODEL=process.env.OPENAI_MODEL||"gpt-6-luna";
const client=process.env.OPENAI_API_KEY?new OpenAI({apiKey:process.env.OPENAI_API_KEY}):null;

app.use(express.json({limit:"12mb"}));
app.use(express.static(path.join(__dirname,"public")));
app.get("/api/health",(_req,res)=>res.json({ok:true,aiConfigured:Boolean(client),model:MODEL}));

const SYSTEM=`Eres PuntIA, experto en crochet y amigurumi. Responde en español de México.
Genera patrones claros, reproducibles y matemáticamente coherentes.
Devuelve SOLO JSON: {"pattern":{"name":"string","height":"20 cm","difficulty":"Básico|Intermedio|Avanzado","collection":"string","petName":"string","colors":[["nombre","hex"]],"head":[[vuelta,instruccion,puntos]],"body":[[vuelta,instruccion,puntos]]}}`;

function extractJson(text){
  const cleaned=String(text||"").replace(/```json|```/gi,"").trim();
  const a=cleaned.indexOf("{"),b=cleaned.lastIndexOf("}");
  if(a<0||b<a)throw new Error("JSON inválido");
  return JSON.parse(cleaned.slice(a,b+1));
}

app.post("/api/puntia/generate-pattern",async(req,res)=>{
  try{
    const prompt=typeof req.body?.prompt==="string"?req.body.prompt.trim():"";
    if(!prompt)return res.status(400).json({error:"Falta el prompt."});
    if(!client)return res.status(503).json({error:"OPENAI_API_KEY no está configurada."});
    const r=await client.responses.create({model:MODEL,instructions:SYSTEM,input:prompt});
    res.json(extractJson(r.output_text));
  }catch(e){console.error(e);res.status(500).json({error:"No se pudo generar el patrón con IA."});}
});

app.post("/api/puntia/diagnose",async(req,res)=>{
  try{
    const image=req.body?.image;
    if(typeof image!=="string"||!image.startsWith("data:image/"))return res.status(400).json({error:"Imagen no válida."});
    if(!client)return res.status(503).json({error:"OPENAI_API_KEY no está configurada."});
    const r=await client.responses.create({
      model:MODEL,
      instructions:"Eres el módulo de diagnóstico visual de PuntIA para crochet/amigurumi. Explica qué parece estar mal, dónde, por qué puede ocurrir, cómo corregirlo paso a paso y tu nivel de certeza. Si la foto no permite determinar algo, dilo claramente. No inventes detalles.",
      input:[{role:"user",content:[
        {type:"input_text",text:"Analiza esta pieza de crochet y dame un diagnóstico práctico."},
        {type:"input_image",image_url:image}
      ]}]
    });
    res.json({analysis:r.output_text});
  }catch(e){console.error(e);res.status(500).json({error:"No se pudo analizar la imagen."});}
});

app.get("*",(_req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("PuntIA: http://localhost:"+PORT));
