# PuntIA — checklist de liberación Android y backend

## Estado

Esta rama prepara la interfaz web para Android mediante Capacitor y añade caché del shell para uso sin conexión. El APK es de depuración; todavía no es una versión firmada de distribución.

## Configuración requerida antes de compilar

### Variable de GitHub Actions

Recomendado: configurar la variable de repositorio `PUNTIA_API_BASE_URL` con la URL HTTPS del backend que realmente esté desplegado. Si no existe, el workflow usa como respaldo `https://puntia-validation-production.up.railway.app`; ese dominio debe estar activo y verificado antes de entregar el APK a usuarios. La compilación por sí sola no comprueba que el servidor responda.

### Variables del servicio backend en Railway

- `OPENAI_API_KEY`: clave real de OpenAI, guardada como variable secreta.
- `PUNTIA_SESSION_SECRET`: secreto aleatorio de al menos 32 bytes. No guardarlo en Git ni en comentarios.
- `PUNTIA_ALLOWED_ORIGINS`: por defecto se permiten `https://localhost` y `capacitor://localhost` para el WebView de Capacitor. Añadir aquí el origen web real si la aplicación se sirve desde otro dominio.

La cookie de sesión usa `HttpOnly`, `Secure` y `SameSite=None` en producción para que las solicitudes autenticadas desde Android puedan enviar credenciales entre orígenes. CORS solo permite orígenes configurados o el mismo origen del backend.

## Pruebas obligatorias

1. Confirmar que el servicio Railway está activo y que `GET /api/health` responde `200` con `ok: true` y `ai: true`.
2. Probar chat, generación de patrón, diagnóstico de imagen y memoria desde una sesión nueva.
3. Probar que dos sesiones no pueden leer ni borrar la memoria de la otra.
4. Probar la preflight CORS desde `https://localhost` y rechazar un origen ajeno.
5. Instalar el APK en Android 10 y 11; comprobar navegación, sesión, chat, patrones, cámara/galería y memoria.
6. Bloquear el CDN de Three.js y confirmar que se muestra la mascota SVG y que el resto de la interfaz continúa funcionando.
7. Abrir PuntIA sin red después de la primera carga. El shell y los recursos locales deben abrir; las funciones de IA deben mostrar claramente que requieren conexión.

## Limitaciones conocidas que impiden declarar producción

- La caché offline conserva el shell y recursos locales; no almacena patrones, mensajes ni resultados de IA para uso offline.
- El limitador actual de IA es de concurrencia por proceso; falta rate limiting distribuido y cuotas por sesión/IP.
- La comprobación de imágenes valida firma y MIME, pero falta decodificación completa y límites de dimensiones/píxeles.
- La memoria JSON está protegida frente a escrituras concurrentes en un proceso, pero no coordina varias réplicas. Mantener una sola réplica hasta migrar a almacenamiento transaccional.
- Los patrones solo tienen validación matemática parcial; los resultados no verificados deben mostrarse como tales.
- No se debe desplegar la rama de auditoría sobre producción hasta completar configuración, pruebas reales y revisión de PR.

## Construcción

El workflow `.github/workflows/android-apk.yml` genera `puntia-debug-apk` y conserva el artefacto durante 14 días. La CI ejecuta pruebas de sintaxis, aritmética, interfaz de escritorio/móvil y endpoints negativos; las respuestas de IA en la prueba de interfaz están simuladas. Para distribución pública falta configurar firma Android fuera del repositorio, generar un AAB de release, validar la política de privacidad y probar en dispositivos físicos.
