# PuntIA — plan de validación end-to-end en staging

**Fecha:** 2026-10-27  
**Rama de trabajo:** `audit/general-audit-2026-10`  
**Objetivo:** verificar el flujo real de la app sin modificar producción ni su volumen de memoria.

## Estado previo comprobado

- CI GitHub Actions #156: **éxito** en commit `c6e5a8dff6b64c22ffd0042a3dfdb56367cbbefc`.
- Evidencia: https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40595442256
- La suite reporta validaciones de sintaxis, pruebas de interfaz de escritorio/móvil, endpoints y defensas de sesión/solicitudes.
- Esto no equivale a una prueba en Railway ni demuestra que las llamadas reales a OpenAI funcionen con las variables del entorno.
- Producción debe permanecer intacta hasta completar este plan.

## Bloqueos antes de iniciar staging

- [ ] Crear/seleccionar un entorno Railway **separado** de producción.
- [ ] Confirmar que staging no monta ni comparte el volumen `puntia-assistant-memory` de producción.
- [ ] Configurar en staging un `PUNTIA_SESSION_SECRET` aleatorio, persistente y de al menos 32 bytes; no reutilizar el secreto de producción.
- [ ] Configurar una credencial de IA válida y de prueba; no registrar ni publicar su valor.
- [ ] Confirmar que las variables administrativas opcionales se configuran conscientemente y no se inventan.
- [ ] Verificar que el servicio despliega la rama de auditoría y registrar el SHA exacto.

## Pruebas manuales de extremo a extremo

Registrar resultado, hora, SHA, endpoint, estado HTTP y evidencia sin incluir secretos ni datos personales.

| ID | Prueba | Criterio de aceptación | Estado inicial |
|---|---|---|---|
| ST-01 | Arranque del servicio | Despliegue saludable; logs sin excepciones de inicio | Pendiente |
| ST-02 | Health endpoint | Respuesta saludable del servicio desplegado desde staging | Pendiente |
| ST-03 | Chat con IA real | Respuesta útil; errores de proveedor controlados; sin exponer secretos | Pendiente |
| ST-04 | Generar patrón | Patrón generado; recuentos del validador visibles y estados no verificados conservados | Pendiente |
| ST-05 | Diagnóstico de imagen | Imagen válida aceptada; formato no compatible, archivo falso y archivo malformado rechazados de forma segura | Pendiente |
| ST-06 | Aislamiento de sesión | Dos sesiones independientes no pueden leer ni borrar la memoria de la otra | Pendiente |
| ST-07 | Persistencia | Guardar memoria, reiniciar staging y comprobar que persiste en su almacenamiento aislado | Pendiente |
| ST-08 | CSRF/origen | Mutaciones con origen externo rechazadas; llamadas legítimas same-origin funcionan | Pendiente |
| ST-09 | Saturación de IA | Superar concurrencia configurada devuelve 429 y Retry-After sin tumbar el proceso | Pendiente |
| ST-10 | UI móvil | Navegación, chat, generación, biblioteca, mascota y controles principales funcionan en Android/móvil | Pendiente |
| ST-11 | Regresión visual | La interfaz y la mascota conservan el diseño acordado; no hay desbordamientos ni botones inaccesibles | Pendiente |
| ST-12 | Reinicio y logs | Servicio se recupera; no se filtran claves, cookies completas ni contenido sensible en logs | Pendiente |

## Condiciones de aprobación

- Todas las pruebas críticas ST-01 a ST-09 pasan en staging real.
- Cualquier fallo se corrige en la rama, se repite la prueba afectada y se vuelve a ejecutar CI.
- Adjuntar evidencias sin secretos y actualizar esta tabla con resultados reales.
- No marcar pruebas como aprobadas por inferencia ni sólo porque CI pase.

## Riesgos aún conocidos

- La limitación de concurrencia es por proceso, no una cuota por IP/sesión ni una cuota global distribuida.
- La validación de firma de imagen no sustituye decodificación completa ni límites de dimensiones/píxeles.
- La memoria JSON y su cola son locales al proceso; no ofrecen coordinación multi-réplica.
- El validador de patrones sólo cubre parte de la notación de crochet.

## Decisión de despliegue

**No desplegar esta rama a producción todavía.** Primero se necesita un entorno de staging aislado, secreto de sesión persistente configurado y evidencia de pruebas reales. El despliegue de producción y su volumen no deben modificarse como parte de esta validación.
