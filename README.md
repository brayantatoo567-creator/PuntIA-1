# Imaginaria 1.0

Imaginaria convierte ideas escritas o fotografías en proyectos de crochet y amigurumi. El flujo principal crea un patrón por piezas y vueltas, revisa las cuentas que el validador puede interpretar y permite generar imágenes didácticas por etapa.

## Ejecutar

Requisitos: Node.js 22, una clave de OpenAI y PostgreSQL en producción.

```bash
npm install
cp .env.example .env
npm start
```

## Variables de entorno

- `OPENAI_API_KEY`: clave privada del servidor. No subirla al repositorio.
- `OPENAI_MODEL`: modelo de texto.
- `OPENAI_VISION_MODEL`: modelo con visión para fotografías.
- `OPENAI_IMAGE_MODEL`: modelo de generación de imágenes (predeterminado `gpt-image-1`).
- `DATABASE_URL`: PostgreSQL obligatorio en producción.
- `PUNTIA_SESSION_SECRET`: secreto estable de sesión (mínimo 32 bytes).
- `DIAGNOSTICS_TOKEN`: token opcional para diagnóstico administrativo.
- `PORT`: puerto HTTP.

## Funciones principales

- `POST /api/imaginaria/create`: crea un patrón desde una descripción o una fotografía (multipart: `idea`, `height`, `level`, `yarn`, `style`, `image`).
- `POST /api/imaginaria/step-image`: genera una imagen didáctica de una etapa (`stage`, `step`, `context`).
- `POST /api/puntia/test-key`: prueba la conexión de IA.
- `GET /api/health`: comprueba la salud del servidor y la base de datos.

La interfaz permite configurar la URL del backend y una clave temporal de prueba desde el panel inferior. Para uso público, configura la clave como secreto del servidor y no distribuyas una clave privada en el navegador.

## Calidad y límites

El validador actual comprueba aritmética de rondas que reconoce (pb, aum y dis). Las rondas no interpretables se marcan como no verificadas. Un resultado sin errores matemáticos detectados no equivale a una prueba física: antes de comercializar un patrón hay que tejer una muestra, comprobar medidas, tensión, ensamblaje y correspondencia visual.

Las imágenes son referencias didácticas generadas por IA y no sustituyen la lectura del patrón. Las llamadas de IA e imágenes requieren internet y consumen cuota. No hay generaciones ilimitadas.

## Pruebas

```bash
npm test
npm run check
```

En producción, configura almacenamiento persistente PostgreSQL, HTTPS, variables secretas y límites de consumo. El APK de depuración no debe distribuirse como versión comercial sin firma, revisión de privacidad y pruebas en dispositivos reales.
