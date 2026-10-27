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

Las rutas `GET /api/puntia/memory/:userId`, `POST /api/puntia/memory` y `DELETE /api/puntia/memory/:userId` usan un identificador enviado por el cliente como control de acceso. Validar el formato del identificador no demuestra que el solicitante sea su propietario. Si los identificadores son conocidos o predecibles, una persona podría leer, insertar o borrar memorias ajenas.

**Corrección necesaria:** autenticar las sesiones y derivar el propietario de la identidad validada en el servidor. Hasta que exista autenticación real, no tratar el identificador de sesión como una barrera de seguridad. No se cambió este contrato automáticamente porque introducir autenticación sin revisar el cliente puede romper memoria, chat y mascota.

### P1 — Protección contra abuso de endpoints de IA

Chat, generación de patrones y diagnóstico consumen recursos externos. En el backend revisado no aparece un limitador por usuario/IP. Un endpoint público sin límites de frecuencia puede generar costes, agotar cuota o degradar el servicio.

**Corrección necesaria:** límites de frecuencia y concurrencia en servidor, cuotas por usuario autenticado y límites apropiados en el proxy. No basta con un límite del lado del navegador.

### P1 — Validación real de archivos de imagen

La carga está limitada a 8 MB y se filtra por el encabezado MIME declarado por el cliente. Ese encabezado no demuestra por sí solo que el contenido sea una imagen válida.

**Corrección aplicada en esta rama:** se limita la carga a un archivo y un número acotado de campos multipart, y se compara la firma binaria JPEG/PNG/WEBP/GIF con el MIME declarado antes de llamar al modelo. Se añadió una prueba CI para un archivo falso con MIME `image/png`.

**Pendiente:** la comprobación de firma no equivale a decodificar completamente la imagen ni verifica dimensiones/píxeles. Para cerrar este hallazgo por completo se requiere un decodificador de imágenes y pruebas con archivos truncados y malformados.

### P1 — Escritura concurrente de memoria JSON

La memoria se guarda en un archivo JSON compartido. Las escrituras síncronas bloquean el event loop, y dos solicitudes de chat simultáneas pueden leer la misma versión y luego sobrescribir cambios de la otra solicitud.

**Corrección aplicada en esta rama:** cada escritura usa un archivo temporal exclusivo creado con `wx`, permisos restrictivos y un nombre aleatorio, seguido de `rename`; así se evita que dos operaciones choquen sobre el mismo archivo temporal.

**Pendiente:** la escritura atómica del archivo no elimina la pérdida lógica de actualizaciones cuando dos solicitudes hacen leer-modificar-escribir en paralelo. La solución sólida es serializar el ciclo completo de modificación o migrar la memoria a una base de datos transaccional. No se modificó el volumen de producción.

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

- Se agrega un comando `npm test` para ejecutar las pruebas aritméticas de rondas existentes.
- Se añade este informe como registro trazable de hallazgos, límites y prioridades.

Estos cambios no modifican endpoints ni datos persistentes.

## Pruebas y evidencia

En la base auditada se registró un CI exitoso para el commit `837c18e`:  
https://github.com/brayantatoo567-creator/PuntIA-1/actions/runs/40542291966

También se revisó el estado de Railway: servicio `puntia-validation` en línea, una réplica activa, sin fallos recientes y sin cambios pendientes. El despliegue activo corresponde a un commit anterior (`91ca2c3`), así que las pruebas de CI de la rama principal no prueban por sí solas el código nuevo en producción.

La inspección de código no permite afirmar que se hayan ejecutado pruebas de penetración, pruebas de carga, validación real de imágenes en producción ni pruebas de supervivencia de la memoria tras reinicio.

## Plan recomendado

1. Resolver autenticación y autorización de la memoria sin romper sesiones existentes.
2. Añadir límites de frecuencia y concurrencia en endpoints de IA.
3. Completar validación de imágenes con decodificación real y límites de dimensiones/píxeles.
4. Serializar el ciclo completo de actualización de memoria o migrarlo a almacenamiento transaccional.
5. Expandir pruebas del validador y añadir casos de continuidad entre rondas.
6. Ejecutar `npm test`, CI completa, pruebas de regresión visual y pruebas en un entorno de staging.
7. Desplegar a producción sólo tras habilitar de forma segura la conexión de despliegue y verificar endpoints reales.

## Referencias técnicas

- Express — prácticas de seguridad en producción: https://expressjs.com/en/advanced/best-practice-security/
- Express — manejo de errores: https://expressjs.com/en/5x/guide/error-handling/
- Multer — límites y seguridad de carga: https://expressjs.com/en/resources/middleware/multer/

**Conclusión:** la aplicación tiene una base funcional y CI útil, pero no está certificada como libre de errores. Los hallazgos P0/P1 requieren trabajo antes de considerar la aplicación lista para uso público a escala.
