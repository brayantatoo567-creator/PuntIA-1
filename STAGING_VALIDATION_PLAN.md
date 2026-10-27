# PuntIA — plan de validación end-to-end en staging

**Fecha:** 2026-10-27  
**Rama:** `audit/general-audit-2026-10`  
**Objetivo:** verificar las funciones reales de PuntIA sin modificar producción ni su volumen de memoria.

## Estado comprobado

- CI #158: **éxito**, commit `dea7ae0b1c4193cfa05e21bd7391a1dd06d2535a`.  
  Evidencia: https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40601841832
- Pasaron las comprobaciones de archivos, dependencias, sintaxis, aritmética de crochet, pruebas de interfaz en escritorio/móvil y pruebas de endpoints/validaciones de seguridad incluidas en el workflow.
- Railway reporta los cuatro servicios actuales en línea, sin fallos recientes ni alertas activas en el estado consultado.
- El proyecto Railway consultado sólo tiene el entorno `production`; no existe todavía un entorno de staging separado.
- El servicio `puntia-validation` está en producción y monta el volumen persistente `puntia-assistant-memory` en `/app/data`. **No modificar ni compartir ese volumen con staging.**
- El despliegue activo corresponde a un commit anterior a la rama de auditoría. El éxito de CI no prueba que el código auditado esté funcionando en Railway.
- La lista de variables del servicio de producción no incluye `PUNTIA_SESSION_SECRET`. No añadirla ni desplegar código que la requiera en producción como parte de estas pruebas.
- La comprobación HTTP directa del endpoint público no pudo confirmarse desde la herramienta web disponible; no se marca el health endpoint como probado en vivo.

## Bloqueo actual para staging

Se necesita crear un entorno Railway separado de producción. En las acciones disponibles para esta sesión no hay una operación de creación de entorno que pueda ejecutar de forma segura. No voy a sustituirla por cambios en producción ni a crear un servicio improvisado dentro del único entorno actual.

Una vez que exista staging, preparar:
- [ ] servicio conectado a la rama `audit/general-audit-2026-10` y SHA exacto registrado;
- [ ] almacenamiento exclusivo de staging; nunca montar el volumen de producción;
- [ ] `PUNTIA_SESSION_SECRET` aleatorio y persistente de al menos 32 bytes, diferente del secreto de producción;
- [ ] credencial de IA de prueba válida y protegida;
- [ ] variables administrativas configuradas sólo si se van a usar;
- [ ] límites de gasto/uso para pruebas.

## Matriz de pruebas de extremo a extremo

Registrar SHA, hora, resultado, código HTTP y evidencia sin secretos ni datos personales.

| ID | Prueba | Criterio de aceptación | Estado |
|---|---|---|---|
| ST-01 | Arranque | Servicio saludable y sin excepción de inicio | Bloqueada: falta staging |
| ST-02 | Health endpoint | Respuesta saludable desde el servicio de staging | Pendiente |
| ST-03 | Chat con IA real | Respuesta útil; errores de proveedor controlados | Pendiente |
| ST-04 | Generación de patrón | Patrón generado y validación reportada sin fingir certeza | Pendiente |
| ST-05 | Diagnóstico de imagen | Imagen válida procesada; archivos falsos/malformados rechazados | Pendiente |
| ST-06 | Aislamiento de sesión | Dos sesiones no pueden leer ni borrar la memoria ajena | CI pasa; staging pendiente |
| ST-07 | Persistencia | Memoria persiste tras reiniciar staging con almacenamiento aislado | Pendiente |
| ST-08 | CSRF/origen | Origen externo rechazado; solicitudes legítimas funcionan | CI pasa; staging pendiente |
| ST-09 | Saturación de IA | Respuesta 429 y Retry-After al exceder concurrencia | Pendiente |
| ST-10 | UI móvil | Chat, patrón, biblioteca, mascota y navegación usables en Android | CI pasa en navegador; dispositivo real pendiente |
| ST-11 | Regresión visual | Diseño conservado; controles accesibles y sin desbordamientos | CI pasa en navegador; revisión final pendiente |
| ST-12 | Reinicio y logs | Servicio se recupera; no expone secretos ni cookies | Pendiente |

## Riesgos conocidos que requieren seguimiento

- La concurrencia de IA se limita por proceso; no es cuota por usuario/IP ni global entre réplicas.
- La firma binaria de imagen no sustituye decodificación completa ni límites de dimensiones/píxeles.
- La memoria JSON y su cola son locales al proceso; no coordinan varias réplicas.
- El validador de patrones cubre sólo parte de la notación de crochet.
- CI no confirma la integración real con el proveedor de IA ni la instalación de la APK en un dispositivo físico.

## Criterio de aprobación

- Ejecutar las pruebas críticas en staging real.
- Corregir cualquier fallo, repetir las pruebas afectadas y volver a ejecutar CI.
- No marcar una prueba como aprobada por inferencia o por el solo hecho de que CI pase.
- Validar la APK en Android y registrar versión, firma, instalación y resultados antes de considerar un lanzamiento.

## Decisión

**No desplegar la rama de auditoría a producción todavía.** El siguiente paso de infraestructura es crear staging aislado; hasta entonces, continuar con revisiones y pruebas no destructivas del código. La instancia de producción y sus volúmenes deben permanecer intactos.
