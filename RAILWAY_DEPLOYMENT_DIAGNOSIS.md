# PuntIA — diagnóstico de despliegues Railway

**Revisión:** 18 de noviembre de 2026  
**Alcance:** lectura de configuración, estado y logs de los dos proyectos Railway llamados PuntIA. No se modificaron servicios, variables, volúmenes ni despliegues.

## Resumen

Se localizaron dos proyectos llamados PuntIA dentro del mismo workspace. Ninguno tiene un despliegue activo confirmado en el estado consultado. No se debe anunciar ninguna de sus URLs como beta funcional hasta completar un despliegue y una prueba HTTP real.

## Proyecto A — PuntIA (ID interno terminado en `...3a7c`)

Servicios:
- `puntia-validation`: tiene dominio `puntia-validation-production.up.railway.app`, volumen persistente montado en `/app/data` y nombres de variables de entorno para OpenAI, origen permitido y secreto de sesión. No aparece un último despliegue en el estado consultado.
- `puntia-9-14-runtime`: tiene dominio y volumen `/data`, pero el último despliegue consultado está en estado FAILED.

Diagnóstico del despliegue fallido de `puntia-9-14-runtime`:
- Rama usada: `main`.
- El build descarga y extrae un archivo histórico `PuntIA-9.42.17-FINAL-FULL-AUDIT-VERIFIED.tgz` desde el repositorio y modifica migraciones antes de instalar.
- La imagen se construyó, pero el healthcheck `GET /api/health` falló repetidamente con “service unavailable”.
- No se encontró diagnóstico automático adicional.

**Conclusión:** no reutilizar este build histórico como despliegue de la beta actual. Debe retirarse esa cadena de build personalizada en una configuración de staging separada, no sobrescribirse sin respaldo.

## Proyecto B — PuntIA (ID interno terminado en `...acdf`)

Servicio:
- `puntia-web`: dominio `puntia-web-production.up.railway.app`, sin volumen asociado.
- Último despliegue consultado: FAILED.

Diagnóstico del despliegue:
- Rama usada: `main`.
- Falla en etapa BUILD_IMAGE.
- Error: el directorio `/renace` configurado como raíz de build no existe en la instantánea del repositorio.

**Conclusión:** corregir root directory a la raíz real del proyecto solo en un entorno de prueba y volver a ejecutar build antes de cualquier promoción.

## Ruta recomendada

1. Mantener los dos proyectos actuales intactos hasta decidir cuál se conserva.
2. Preferir `puntia-validation` como candidato de staging porque ya tiene un dominio, volumen persistente y nombres de variables relevantes; primero confirmar su configuración completa, el secreto estable, los orígenes y el estado de la clave de IA sin revelar sus valores.
3. Conectar el servicio de staging a la rama `release/mvp-beta-2026-11` y retirar comandos de build que descarguen archivos históricos; usar `npm install`/Railpack desde la raíz.
4. Confirmar `PORT=8080`, start command `npm start` o `node server.js`, healthcheck `/api/health`, volumen montado en `/app/data` y una sola réplica.
5. Ejecutar un despliegue de staging, inspeccionar logs y probar HTTP health, generación real con cuota autorizada, aislamiento de sesiones y persistencia tras reinicio.
6. No cambiar ni borrar el runtime antiguo, el segundo proyecto, bases de datos, Redis o volúmenes sin una decisión explícita y un respaldo.

## Seguridad

Los nombres y valores de variables no deben copiarse a issues, commits, capturas o documentación pública. Las claves se revisan únicamente desde el gestor de secretos. Una sesión anónima por cookie no debe describirse como una cuenta de usuario con correo/contraseña.


## Actualización del 18 de noviembre de 2026 — bloqueo de cuenta

- La rama `release/mvp-beta-2026-11` quedó configurada como fuente del servicio `puntia-validation`.
- Se aplicaron el comando de inicio `node server.js`, el healthcheck `/api/health` y timeout de 120 segundos.
- Se conservaron el volumen existente y las variables; no se editaron secretos ni se borraron recursos.
- Al solicitar el primer despliegue, Railway respondió: **“Your trial has expired. Please select a plan to continue using Railway.”**
- Por tanto, no se creó una nueva instancia ni se pudo ejecutar una prueba HTTP de la aplicación.
- El servicio sigue sin despliegue activo confirmado. La URL pública no debe compartirse como beta funcional.
- Siguiente paso del propietario: seleccionar/activar un plan de Railway para permitir el despliegue. Después, volver a lanzar el build desde esta rama y continuar con healthcheck, llamada real a OpenAI, persistencia y prueba Android.
