# PuntIA

PuntIA es una aplicación de apoyo para crochet y amigurumi. Este repositorio conserva la interfaz web y añade un backend Express modular con SQLite, además de la base de un cliente Android nativo en Kotlin.

## Componentes

- `public/`: interfaz web existente.
- `backend/`: API separada en rutas, controladores, servicios, modelos y persistencia.
- `backend/database/`: SQLite para conversaciones y memorias.
- `app/`: cliente Android nativo Kotlin.
- `app/src/test/`: pruebas unitarias.
- `app/src/androidTest/`: pruebas instrumentadas en emulador/dispositivo.

## Requisitos

- Node.js 20 o posterior y npm.
- JDK 17.
- Android Studio, Android SDK 35 y Gradle compatible con Android Gradle Plugin 8.7.3.
- Una clave de API válida para activar la IA. Sin ella, los endpoints de IA responden HTTP 503.

## Ejecutar el backend

1. Copia `.env.example` a `.env` y configura `OPENAI_API_KEY`. No subas `.env` a Git.
2. Instala dependencias: `npm install`.
3. Ejecuta las pruebas: `npm test`.
4. Inicia el servidor: `npm start`.

La API escucha en `http://localhost:8080` por defecto. Comprueba `GET /api/health`.

### Rutas principales

- `POST /api/puntia/chat` — JSON: `{ "message": "...", "userId": "..." }`.
- `POST /api/puntia/generate-pattern` — JSON con `name`, `level`, `height` y `style`.
- `POST /api/puntia/diagnose` — multipart/form-data con campo `image`.
- `GET /api/puntia/memory/:userId` — consulta memoria y mensajes recientes.
- `POST /api/puntia/memory` — JSON con `userId`, `content` y `category`.
- `DELETE /api/puntia/memory/:userId` — elimina las memorias guardadas.

SQLite se crea automáticamente. En alojamiento efímero, el archivo puede perderse al reiniciar o redesplegar; configura `PUNTIA_DB_PATH` sobre un volumen persistente antes de producción. Las rutas de memoria aún requieren autenticación y autorización antes de almacenar datos privados de usuarios reales.

## Ejecutar Android

1. Abre el repositorio en Android Studio.
2. Confirma JDK 17 y Android SDK 35.
3. Sincroniza Gradle y ejecuta la configuración `app` en un emulador o dispositivo.
4. El cliente usa inicialmente la URL de validación configurada en `app/build.gradle.kts`. Cambia `PUNTIA_API_BASE_URL` para usar otro backend de pruebas.

El cliente valida entradas, realiza peticiones fuera del hilo principal y muestra errores de red/API. La clave de IA debe permanecer en el servidor.

- Pruebas unitarias: tarea Gradle `testDebugUnitTest`.
- Pruebas instrumentadas: `connectedDebugAndroidTest` con un emulador o dispositivo conectado.

## Seguridad y producción

- No guardes claves de IA en el APK, repositorio ni frontend.
- Añade autenticación y autorización antes de habilitar memorias privadas.
- Configura un volumen persistente para SQLite en el servidor.
- Las pruebas automatizadas no prueban que el proveedor de IA esté disponible; para eso se requiere una prueba de humo con credenciales válidas.
