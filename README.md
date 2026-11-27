# PuntIA 3.1

Asistente web de crochet y amigurumi con chat IA, generador de patrones, auditoría de conteos, diagnóstico visual por imagen, memoria de conversación y empaquetado Android con Capacitor.

## Requisitos

- Node.js 20 o superior.
- npm.
- Una clave de API de OpenAI para chat, generación de patrones y diagnóstico visual.
- Para Android: Java 21, Android SDK y una URL HTTPS pública del backend.

## Instalación local

1. Descarga y descomprime el proyecto.
2. Abre una terminal dentro de la carpeta.
3. Instala dependencias:

   ```bash
   npm install
   ```

4. Copia `.env.example` a `.env` y agrega tu clave:

   ```env
   OPENAI_API_KEY=tu_clave
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_VISION_MODEL=gpt-4o
   PORT=8080
   ```

5. Inicia PuntIA:

   ```bash
   npm start
   ```

6. Abre `http://localhost:8080`.

Sin `OPENAI_API_KEY`, la interfaz y las rutas de estado funcionan, pero las funciones de IA devuelven un mensaje de configuración pendiente. No se incluye ninguna clave dentro del proyecto.

## Pruebas

```bash
npm test
```

Incluye pruebas de aceptación del caso Panda Hamburguesero y cálculos de puntos. La validación automática verifica conteos que puede interpretar; no certifica tensión, tamaño físico, forma final ni que un patrón haya sido tejido.

## Despliegue en Railway u otro hosting

Configura estas variables en el backend:

- `OPENAI_API_KEY` (necesaria para IA).
- `OPENAI_MODEL` (opcional; valor por defecto `gpt-4o-mini`).
- `OPENAI_VISION_MODEL` (opcional; valor por defecto `gpt-4o`).
- `OPENAI_TIMEOUT_MS` (opcional; valor por defecto 45000).
- `PUNTIA_DATA_DIR` (recomendado; ruta del volumen persistente para memoria).
- `PUNTIA_ALLOWED_ORIGINS` (opcional; orígenes web permitidos separados por comas; Capacitor Android ya permite `https://localhost`).
- `DIAGNOSTICS_TOKEN` (opcional; habilita el diagnóstico administrativo protegido).

**Persistencia:** la memoria se escribe en un archivo JSON. En Railway, monta un volumen persistente y configura `PUNTIA_DATA_DIR` con la ruta de montaje. Sin volumen persistente, la memoria puede perderse al recrear el contenedor. Para producción con múltiples instancias, migra la memoria a una base de datos compartida.

## Aplicación Android

El repositorio incluye `capacitor.config.json` y el workflow de compilación Android.

1. Despliega primero el backend y confirma que `/api/health` responde por HTTPS.
2. En GitHub, configura la variable de repositorio `PUNTIA_API_BASE_URL` con la URL HTTPS del backend (sin ruta adicional).
3. Ejecuta el workflow **PuntIA Android APK** desde Actions.
4. Descarga el artefacto `puntia-debug-apk` generado por GitHub Actions.

La APK se conecta al backend; no contiene la clave de OpenAI. Sin la URL real del backend no se puede generar una APK funcional conectada a IA.

## Caso Panda Hamburguesero

La aplicación contiene el caso de aceptación `PUNTIA-PANDA-001` para un amigurumi de 19 cm objetivo, nivel intermedio y piezas separadas cosidas. El auditor comprueba aritmética y continuidad de las vueltas reconocidas. La altura de 19 cm y el ajuste final requieren tejer y medir un prototipo físico.

## Límites conocidos

- El diagnóstico visual requiere una imagen válida y un modelo de visión habilitado.
- La IA requiere clave, permisos y cuota de API.
- El guardado de memoria en archivo requiere almacenamiento persistente en hosting.
- El PDF de patrón se genera mediante la opción de impresión del navegador: selecciona **Guardar como PDF**.
- Las pruebas automatizadas no sustituyen pruebas de uso real en Android ni una muestra tejida.

