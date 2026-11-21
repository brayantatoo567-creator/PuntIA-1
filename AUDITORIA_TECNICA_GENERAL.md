# PuntIA — auditoría técnica general

**Fecha:** 2026-10-27  
**Repositorio auditado:** `brayantatoo567-creator/PuntIA-1`  
**Rama de auditoría:** `audit/general-audit-2026-10`  
**Base:** `837c18e731f28df1d5e2b7085775ffcd04e7b430`

## Resumen ejecutivo

La aplicación combina un backend Express, una interfaz web grande, un módulo de mascota/voz, integración con OpenAI y memoria JSON en un volumen persistente. Hay pruebas de CI para sintaxis, interfaz, endpoints y algunos casos de seguridad. Eso es una buena base, pero no equivale a una certificación integral.

La auditoría estática identificó riesgos que requieren corrección y validación adicional. No se alteró la instancia de producción ni se modificó el volumen de memoria.

## Hallazgos priorizados

### P0 — Identidad y aislamiento de la memoria

Las rutas de memoria ahora derivan la identidad de una cookie de sesión `HttpOnly`, `SameSite=Lax`, firmada con HMAC-SHA256; los identificadores enviados en el cuerpo o la URL ya no seleccionan la memoria. La firma se compara en tiempo constante y la cookie se marca `Secure` en producción/Railway. Se añadieron pruebas CI para dos sesiones independientes, escrituras concurrentes y borrado aislado.

**Correcciones adicionales en la rama:** el servidor ahora falla al arrancar en producción/Railway si `PUNTIA_SESSION_SECRET` falta o tiene menos de 32 bytes; no debe desplegarse hasta configurar el secreto persistente. Las mutaciones de memoria (`POST` y `DELETE`) rechazan cabeceras `Origin` que no coinciden con el origen esperado. La cookie identifica una sesión anónima; no equivale a una cuenta autenticada. Se añadieron pruebas CI para ambas defensas; deben pasar en el commit final.

### P1 — Protección contra abuso de endpoints de IA

Chat, generación de patrones y diagnóstico consumen recursos externos. En el backend revisado no aparece un limitador por usuario/IP. Un endpoint público sin límites de frecuencia puede generar costes, agotar cuota o degradar el servicio.

**Corrección parcial aplicada en esta rama:** se limita a 4 por defecto el número de solicitudes simultáneas en los endpoints de chat, generación de patrones, diagnóstico de imagen y diagnóstico administrativo. Puede configurarse con `MAX_ACTIVE_AI_REQUESTS` (rango 1–20); al alcanzar el límite se devuelve HTTP 429 y `Retry-After: 2`.

**Pendiente:** este límite es por proceso, no un límite de frecuencia por IP/sesión ni una cuota global entre réplicas. Hace falta un limitador distribuido y cuotas para cerrar el hallazgo.

### P1 — Validación real de archivos de imagen

La carga está limitada a 8 MB y se filtra por el encabezado MIME declarado por el cliente. Ese encabezado no demuestra por sí solo que el contenido sea una imagen válida.

**Corrección aplicada en esta rama:** se limita la carga a un archivo y un número acotado de campos multipart, y se compara la firma binaria JPEG/PNG/WEBP/GIF con el MIME declarado antes de llamar al modelo. Se añadió una prueba CI para un archivo falso con MIME `image/png`.

**Pendiente:** la comprobación de firma no equivale a decodificar completamente la imagen ni verifica dimensiones/píxeles. Para cerrar este hallazgo por completo se requiere un decodificador de imágenes y pruebas con archivos truncados y malformados.

### P1 — Escritura concurrente de memoria JSON

La memoria se guarda en un archivo JSON compartido. Las escrituras síncronas bloquean el event loop; la cola global serializa las mutaciones dentro de un único proceso. La lectura ahora valida la estructura JSON y, si detecta datos corruptos o una estructura inesperada, falla de forma cerrada en vez de devolver una base vacía que una escritura posterior pudiera sobrescribir.

**Correcciones aplicadas en esta rama:** cada escritura usa un archivo temporal exclusivo creado con `wx`, permisos restrictivos y un nombre aleatorio, seguido de `rename`. Además, el backend serializa globalmente las mutaciones de la base JSON compartida; el chat vuelve a leer la memoria más reciente al guardar sus mensajes, y los endpoints de guardar/borrar usan la misma cola. Esto reduce las pérdidas por solicitudes concurrentes dentro de un solo proceso.

**Pendiente importante:** la cola vive en memoria del proceso y no coordina múltiples réplicas ni procesos. Para escalado multiinstancia, la solución sólida es almacenamiento transaccional (por ejemplo, PostgreSQL). No se modificó el volumen de producción.

### P1 — Configuración de diagnóstico administrativo

`POST /api/diagnostics` devuelve 503 si no existe `DIAGNOSTICS_TOKEN` y exige bearer token cuando está configurado. Ese comportamiento de cierre seguro es correcto. La variable no estaba presente en la inspección anterior, por lo que el endpoint administrativo no estaba habilitado. No se debe añadir una clave inventada ni exponer secretos.

### P2 — Validación matemática parcial de patrones

El validador reconoce una parte de la notación (`pb`, `aum`, `dis` y grupos repetidos). No verifica todas las convenciones del crochet ni que el total de una vuelta sea compatible con los puntos de entrada de la anterior. Algunas instrucciones quedan como no verificadas, y las líneas con prefijos adicionales pueden no entrar al análisis.

**Corrección necesaria:** ampliar los casos de prueba con notaciones comunes y mantener el estado “no verificado” cuando la notación no pueda interpretarse. No presentar un conteo parcial como prueba de que un patrón completo es correcto.

### P2 — Mantenibilidad y flujo de trabajo

- `package.json` sólo define `start`; no expone un comando estándar `npm test`.
- Hay un `ci.yml` en la raíz además del flujo activo en `.github/workflows/ci.yml`. El archivo en la raíz no se ejecuta automáticamente como workflow de GitHub Actions.
- La raíz contiene archivos de distribución comprimidos y una copia de `index.html`; el flujo de CI verifica que la copia pública y la raíz sean idénticas. Esta duplicación debe documentarse o eliminarse en un cambio dedicado después de confirmar dependencias externas.
- El archivo de interfaz supera 85 KB y contiene muchas responsabilidades. La separación modular debe hacerse gradualmente con pruebas de regresión, no con una reescritura masiva que cambie la apariencia o rompa los selectores.

## Cambios seguros incluidos en esta rama

- Se agregan comandos `npm test` y `npm run check` para comprobaciones reproducibles.
- La carga de imagen se limita y se comprueba su firma binaria contra el MIME declarado.
- Se agregan pruebas CI para rechazar contenido que finge ser imagen.
- Las escrituras de memoria usan temporales únicos, permisos restrictivos y sustitución atómica.
- Se serializan las mutaciones de memoria JSON y se evita que el chat guarde sobre una copia antigua después de esperar a la IA.
- La lectura de memoria valida la estructura del JSON y detiene las operaciones ante corrupción, para reducir el riesgo de sobrescribir silenciosamente datos dañados.
- Se limita la concurrencia de los endpoints de IA por proceso.
- Las memorias se vinculan a cookies de sesión firmadas, no a identificadores arbitrarios enviados por el cliente.
- Se amplían las pruebas de CI para comprobar aislamiento entre sesiones, escrituras concurrentes, rechazo de mutaciones con origen cruzado y cierre seguro al faltar el secreto de producción.
- Se añade este informe como registro trazable de hallazgos, límites y prioridades.

Estos cambios están en la rama de auditoría; no se han desplegado a producción ni han cambiado el volumen persistente.

## Pruebas y evidencia

CI exitoso en ejecuciones recientes: #156 (https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40595442256), #157 (https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40600228256), #158 (https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40601841832), #159 (https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40602217729), #161 (https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40602829427), #162 (https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40610007831) y #163 (https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40610024424). Las ejecuciones #162 y #163 completaron con éxito todos los pasos del job de CI; #162 incluye el cambio de lectura segura de memoria.

Las defensas de sesión firmada y aislamiento cuentan con cobertura en ejecuciones recientes de CI exitosas. Esto valida los casos automatizados incluidos, no una auditoría de seguridad independiente.

Consulta de Railway del 2026-11-18: los cuatro servicios del entorno `production` (`Redis`, `Postgres`, `puntia-9-14-runtime` y `puntia-validation`) aparecen offline y sin despliegues activos. `puntia-9-14-runtime` conserva un último deployment fallido del 2026-10-07; `puntia-validation` no tiene deployment reciente. El entorno contiene cuatro volúmenes, incluido `puntia-assistant-memory` montado en `/app/data`, y no hay cambios pendientes. No se modificaron servicios ni volúmenes. La CI y el APK se compilan en GitHub, pero el backend de Railway no está operativo, por lo que no se pueden confirmar funciones de IA en vivo. El intento previo de crear staging fue bloqueado por límites del plan gratuito y el despliegue actual también quedó bloqueado por la expiración de la prueba.

La inspección de código no permite afirmar que se hayan ejecutado pruebas de penetración, pruebas de carga, validación real de imágenes en producción ni pruebas de supervivencia de la memoria tras reinicio.

## Plan recomendado

1. Configurar `PUNTIA_SESSION_SECRET` como secreto aleatorio persistente en Railway; no desplegar el cambio antes de configurarlo.
2. Añadir defensa CSRF y límites de frecuencia/cuotas por IP/sesión, más controles globales de plataforma.
3. Completar validación de imágenes con decodificación real y límites de dimensiones/píxeles.
4. Migrar la memoria a almacenamiento transaccional si se requiere más de un proceso o réplica.
5. Expandir pruebas del validador y añadir casos de continuidad entre rondas.
6. Ejecutar CI completa después de los cambios recientes, pruebas de regresión visual y pruebas en staging.
7. Desplegar a producción sólo tras habilitar de forma segura la conexión de despliegue y verificar endpoints reales.

## Referencias técnicas

- Express — prácticas de seguridad en producción: https://expressjs.com/en/advanced/best-practice-security/
- Express — manejo de errores: https://expressjs.com/en/5x/guide/error-handling/
- Multer — límites y seguridad de carga: https://expressjs.com/en/resources/middleware/multer/

**Conclusión:** la aplicación tiene una base funcional y CI útil, pero no está certificada como libre de errores. Los hallazgos P0/P1 requieren trabajo antes de considerar la aplicación lista para uso público a escala.


---

## Actualización de auditoría — 2026-11-21

**Rama comprobada:** `release/mvp-beta-2026-11`  
**Servicio:** Render `puntia-beta`  
**Base de datos:** Neon/PostgreSQL independiente de otros proyectos.

### Estado operativo observado

- Render confirmó que el servicio arrancó y quedó `live` con el commit de corrección de rutas API desconocidas (`1b27117`).
- Se confirmó que la configuración de salud reportada por el usuario era `ok=true`, `database=true`, `ai=false`. Esto significa que el servidor y la conexión PostgreSQL respondían, pero no había una clave de IA configurada en el entorno del servidor.
- No se realizó una llamada real al modelo durante esta auditoría: no hay una clave de servidor disponible y no se debe inventar ni exponer una clave.
- La CI incluye comprobaciones de sintaxis, pruebas de cálculo, interfaz, CORS, sesiones, concurrencia de memoria, carga de imágenes y endpoints. No se pudo confirmar desde el conector el resultado de la ejecución CI correspondiente a los commits nuevos; los checks Vercel visibles pertenecen a proyectos separados y fallan, por lo que no se cuentan como CI de PuntIA.

### Defectos corregidos en esta actualización

1. **Rutas API inexistentes:** antes, el fallback SPA podía devolver HTML para una ruta API no registrada. Se agregó un manejador `/api` antes del fallback web que responde HTTP 404 JSON. Se añadió una prueba de regresión en `.github/workflows/ci.yml`. El deploy del commit `1b27117` fue confirmado como `live` por Render.
2. **Prueba de clave OpenAI sin límite de concurrencia:** se incorporó `/api/puntia/test-key` al middleware de límite concurrente de IA. Se añadió una prueba de comportamiento sin clave (HTTP 503) en CI. El commit que contiene esta segunda corrección está en despliegue; confirmar su estado final antes de considerar la actualización completa.

### Hallazgos que siguen abiertos

| Severidad | Hallazgo | Evidencia / efecto | Cierre requerido |
|---|---|---|---|
| Bloqueante funcional | `OPENAI_API_KEY` no está configurada en Render | Health observado: `ai=false`; chat y patrón no pueden usar IA del servidor | El propietario debe crear/proveer una clave válida y configurarla en Render; después ejecutar prueba real de chat y patrón |
| Alta | No existe rate limit distribuido por IP/sesión ni cuotas de uso | El límite actual de concurrencia es por proceso; no detiene ráfagas secuenciales ni coordina réplicas | Añadir rate limiting compartido, cuotas y presupuesto/alertas |
| Alta | Biblioteca de proyectos en `localStorage` | No hay sincronización entre dispositivos ni respaldo cloud automático | Implementar autenticación real, propiedad de proyectos en PostgreSQL y migración idempotente desde el navegador |
| Alta | Validación de imagen basada en firma y MIME | No valida completamente decodificación, dimensiones ni píxeles | Decodificador seguro, límites de dimensiones y pruebas de imágenes truncadas/malformadas |
| Alta | Sin cuentas de usuario | La cookie identifica una sesión anónima, no identidad autenticada | Registro, verificación, recuperación, cierre de sesión y eliminación de cuenta antes de ofrecer cuentas |
| Media | Validador de patrones parcial | Revisa algunas operaciones y no garantiza continuidad entre vueltas ni factibilidad física | Ampliar gramática y pruebas; mantener “no verificado” donde no se pueda calcular |
| Media | Sin lockfile | `package.json` define rangos semver, pero no se encontró `package-lock.json`; instalaciones pueden resolver versiones distintas | Generar y versionar lockfile, cambiar CI a `npm ci` y probar Node 22 |
| Media | Copia de interfaz duplicada | `index.html` y `public/index.html` se mantienen iguales mediante una aserción CI | Consolidar fuente única en un cambio separado cuando no rompa Capacitor/hosting |
| Media | APK sólo debug | Workflow genera `puntia-debug-apk`, no un artefacto release firmado | Configurar firma segura y publicar AAB tras pruebas físicas, privacidad y checklist |

### Riesgos y decisiones de despliegue

- No se fusionó `main`: continúa divergente (3 commits exclusivos de `main` en la comparación observada). No hacer reset/force-push ni fusionar a ciegas.
- No se alteró la base de datos ni se eliminaron datos.
- No se configuró una clave OpenAI ficticia ni se pidió al usuario que la pegue en el chat.
- No se declara PuntIA libre de errores ni lista para comercialización. El servicio puede estar activo y, aun así, las funciones de IA permanecer bloqueadas por falta de clave.

### Siguiente secuencia obligatoria

1. Confirmar que el deploy que incluye el límite para `test-key` queda `live`.
2. Configurar `OPENAI_API_KEY` directamente en Render desde el flujo seguro del propietario.
3. Ejecutar prueba real de chat y generación de patrón; no basta con que `/api/health` responda.
4. Ejecutar CI completa y revisar resultados de UI/API.
5. Implementar rate limit/cuotas y controles de costo.
6. Migrar la biblioteca a PostgreSQL con autenticación real y pruebas de aislamiento.
7. Completar validación de imagen y mejorar el validador de patrones.
8. Preparar APK firmado sólo después de las pruebas de aceptación.
