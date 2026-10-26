# PuntIA v3

Dashboard responsive inspirado en la interfaz de referencia proporcionada. Incluye chat IA, generador de patrones, validador, diagnóstico por foto, voz, proyectos, diagramas y salida a impresión/PDF.

## Variables de entorno (Railway u otro servidor)
- `OPENAI_API_KEY`: clave del servicio de OpenAI (obligatoria para funciones de IA).
- `OPENAI_MODEL`: modelo de texto disponible para tu cuenta. Por defecto, `gpt-4o-mini`.
- `OPENAI_VISION_MODEL`: modelo con visión disponible para tu cuenta. Por defecto, `gpt-4o`.
- `OPENAI_TIMEOUT_MS`: tiempo máximo de espera de la llamada al modelo en milisegundos. Por defecto, `45000`.

**Importante:** no configures un nombre de modelo hasta confirmar que está disponible en tu cuenta. La API devuelve un error claro si la clave, los permisos, la cuota o el tiempo de espera impiden completar la solicitud.

## Ejecutar
npm install
npm start
