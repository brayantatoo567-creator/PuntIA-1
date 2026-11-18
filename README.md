# PuntIA v3

PuntIA es una aplicación web progresiva y Android (Capacitor) para aprender crochet y amigurumi. Incluye asistente conversacional, generador y validador de patrones, diagnóstico de imágenes, biblioteca de aprendizaje y mascota virtual.

## Estado del proyecto

- Plan de estabilización y lanzamiento beta: [RELEASE_MVP_PLAN.md](RELEASE_MVP_PLAN.md).
- Casos de aceptación para la beta: [BETA_ACCEPTANCE_MATRIX.md](BETA_ACCEPTANCE_MATRIX.md).
- Rama de trabajo de lanzamiento: `release/mvp-beta-2026-11`; no confundir con producción.

- La rama de auditoría tiene CI automatizada para sintaxis, cálculos de rondas, interfaz en escritorio/móvil y pruebas de API.
- Android se compila como APK de depuración mediante GitHub Actions.
- El shell de la PWA y recursos locales tienen caché offline; las funciones que usan IA requieren conexión.
- Un build exitoso no demuestra que el backend esté desplegado ni que la cuenta de IA tenga cuota.
- Consulta [ANDROID_RELEASE_CHECKLIST.md](ANDROID_RELEASE_CHECKLIST.md) antes de desplegar o distribuir.

## Requisitos

- Node.js 22 recomendado.
- Una clave de API de OpenAI válida para activar funciones de IA.
- Para producción: HTTPS, almacenamiento persistente y un secreto de sesión estable.

## Ejecutar localmente

```bash
npm install
cp .env.example .env
# Edita .env localmente y agrega las variables necesarias.
npm start
```

Servidor predeterminado: `http://localhost:8080`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `OPENAI_API_KEY` | Clave privada del servicio de IA. No subirla al repositorio. |
| `OPENAI_MODEL` | Modelo de texto; predeterminado `gpt-4o-mini`. |
| `OPENAI_VISION_MODEL` | Modelo con visión; predeterminado `gpt-4o`. |
| `OPENAI_TIMEOUT_MS` | Tiempo máximo de llamada; predeterminado `45000`. |
| `PUNTIA_SESSION_SECRET` | Secreto estable de al menos 32 bytes; obligatorio en producción. |
| `PUNTIA_ALLOWED_ORIGINS` | Orígenes web adicionales permitidos, separados por comas. Capacitor local está permitido por defecto. |
| `PORT` | Puerto HTTP; predeterminado `8080`. |

No guardes secretos en archivos versionados, capturas, issues ni registros. Usa el gestor de variables secretas del proveedor de hosting.

## Comprobación de servicio

- `GET /api/health`: indica si el proceso está activo y si existe configuración de IA. No ejecuta una llamada real al modelo.
- `POST /api/diagnostics`: diagnóstico administrativo opcional; solo funciona si se configura `DIAGNOSTICS_TOKEN` y se envía como Bearer token. No expongas ese token al cliente.

## Pruebas

```bash
npm test
npm run check
```

La CI completa también ejecuta pruebas de navegador con Chromium y validaciones HTTP. Las respuestas IA de la prueba de interfaz son simuladas para no consumir créditos; las pruebas reales de modelo deben hacerse después del despliegue con autorización y cuota disponible.

## Android

El workflow `.github/workflows/android-apk.yml` compila `puntia-debug-apk`. Configura la variable GitHub `PUNTIA_API_BASE_URL` con el dominio HTTPS real del backend. Como respaldo técnico, el workflow utiliza el host de validación de Railway; no se debe distribuir la app hasta verificar que ese host esté activo.

El APK debug es para pruebas internas. La publicación requiere firma de release/AAB, pruebas en Android físico, política de privacidad, ficha de Google Play y cuenta de desarrollador.

## Persistencia y escalado

La memoria actual usa un archivo JSON compartido y serializa escrituras dentro de un único proceso. Mantén una sola réplica y un volumen persistente hasta migrar a una base de datos transaccional. No escales horizontalmente esta implementación de memoria.

## Limitaciones conocidas

- Offline: solo shell y recursos locales; chat, generación y diagnóstico necesitan red y backend.
- La concurrencia de IA se limita por proceso; todavía hace falta rate limiting distribuido y cuotas por sesión/IP.
- La validación de imagen comprueba firma y MIME, pero aún falta decodificación completa y límites de dimensiones/píxeles.
- Los patrones reciben comprobación matemática parcial; las rondas no interpretables se marcan como no verificadas. No se afirma que un patrón esté probado físicamente.
- No declarar producción hasta completar las pruebas reales del backend y los dispositivos indicadas en el checklist.
