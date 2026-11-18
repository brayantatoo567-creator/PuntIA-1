# PuntIA — plan estratégico de estabilización y beta pública

**Rama de trabajo:** `release/mvp-beta-2026-11`  
**Base técnica:** `audit/general-audit-2026-10`  
**Objetivo:** poner en manos de usuarios una beta web instalable (PWA) de PuntIA, con un flujo real de creación de patrones, visualización, guardado y exportación. Android se empaqueta después desde la misma aplicación.

## 1. Decisión de producto

La primera beta no intentará incluir todo el producto futuro. Debe resolver de extremo a extremo esta tarea:

1. El usuario describe una idea y sus dimensiones.
2. PuntIA genera un patrón en español, separado por piezas, con materiales, abreviaturas, rondas, conteos y ensamblaje.
3. El validador revisa la notación que reconoce y comunica qué quedó validado, inválido o sin verificar.
4. El usuario puede solicitar una imagen de referencia del resultado. La imagen es una representación visual, no prueba de que el patrón se haya tejido.
5. El usuario guarda, vuelve a abrir y exporta su proyecto.
6. PuntIA muestra errores claros cuando no hay conexión, cuota o configuración de IA.

**Fuera del primer lanzamiento:** avatar 3D, voz, comunidad pública, tienda completa, pagos y promesas de funcionamiento offline de IA.

## 2. Base elegida y límites confirmados

Se conserva como punto de partida la rama `audit/general-audit-2026-10`, no se sobrescribe `main`.

Capacidades ya presentes en la rama:
- Interfaz web servida por Express y manifiesto PWA.
- API de chat, generación de patrón y diagnóstico por imagen.
- Clave de IA leída desde el entorno del servidor.
- Sesión anónima mediante cookie firmada HttpOnly.
- Memoria JSON serializada para una sola instancia.
- Validador matemático parcial de rondas.
- Pruebas de cálculo, memoria, endpoints y UI en CI.
- Workflow de compilación de APK debug con Capacitor.

No confundir estas capacidades con funcionalidades ya certificadas en producción:
- La sesión anónima **no es** registro/cuenta con correo, recuperación y perfil.
- El validador matemático parcial **no demuestra** que el patrón completo sea tejerle ni que el amigurumi se ensamble correctamente.
- La generación de imagen no equivale a fotografías reales del proceso de tejido.
- La memoria JSON exige una sola instancia y almacenamiento persistente; no es una base de datos multiusuario escalable.
- La CI simulada no acredita una llamada facturable real al proveedor.
- El APK debug no es una APK/AAB firmada para distribución pública.

## 3. Alcance de la beta

### P0 — imprescindible
- Aplicación web móvil usable y servida por HTTPS.
- Estado de servicio e IA visible y entendible.
- Generación real de patrón mediante IA desde backend.
- Estructura de patrón consistente: descripción, medidas, nivel, materiales, abreviaturas, piezas, rondas, ensamblaje y advertencias.
- Validación matemática visible por ronda: válido / inválido / no verificable.
- Guardado y recuperación de proyectos con aislamiento entre sesiones.
- Exportación imprimible/PDF o impresión del navegador, probada en móvil.
- Límites de uso básicos, límites de tamaño y protección de secretos.
- Política de privacidad, aviso de beta y canal de soporte.
- Pruebas automáticas verdes y prueba manual en teléfono Android.

### P1 — siguiente iteración beta
- Cuentas reales con correo, recuperación de contraseña y eliminación de cuenta.
- Persistencia PostgreSQL/Supabase y almacenamiento de archivos privado.
- Generación de imagen del producto final desde el backend.
- Edición/versionado de patrones y favoritos.
- Cuotas por usuario y panel básico de uso/costo.

### P2 — después de validar demanda
- APK/AAB release firmado.
- Premium y pagos.
- Tutoriales audiovisuales propios/licenciados.
- Comunidad, tienda, voz y avatar.

## 4. Secuencia de ejecución y puertas de salida

### Etapa A — congelar y verificar la base
- Trabajar solo en esta rama.
- Ejecutar `npm ci`, `npm test`, `npm run check` y workflow CI.
- Verificar rutas, variables, almacenamiento, sesión y estado real de la IA.
- Corregir fallos bloqueantes antes de nuevas funciones.

**Salida:** build reproducible, pruebas verdes y lista de defectos con severidad.

### Etapa B — cerrar el flujo principal
- Revisar el formulario y la respuesta de generación.
- Estandarizar la estructura de patrón.
- Mostrar conteos validados, inválidos y no verificables sin ocultar incertidumbre.
- Guardar/recuperar proyecto y generar una salida imprimible.
- Añadir casos de prueba para muñeca, animal, figura articulada y accesorio.

**Salida:** cinco proyectos de prueba completan el flujo sin pérdida de datos; conteos reconocidos pasan y los no reconocidos quedan señalados.

### Etapa C — preparar backend de beta
- Configurar hosting HTTPS y almacenamiento persistente.
- Establecer `OPENAI_API_KEY`, `PUNTIA_SESSION_SECRET` y orígenes permitidos en el gestor de secretos del hosting.
- Confirmar que el endpoint de salud informa IA configurada y realizar una llamada real de patrón y visión con cuota autorizada.
- Mantener una sola instancia mientras se use memoria JSON.
- Definir límites de solicitudes por sesión/IP y límites de gasto antes de compartir el enlace públicamente.

**Salida:** pruebas reales desde una sesión nueva y desde dos sesiones distintas; sin claves en el navegador o repositorio.

### Etapa D — beta privada
- Publicar primero a un grupo pequeño (5–10 personas).
- Darles tareas concretas: registrarse/entrar en la sesión beta, generar patrón, guardar, reabrir, exportar y reportar errores.
- Medir tasa de generación exitosa, tiempo, errores, costo por patrón, guardados y retorno.
- Revisar manualmente una muestra de patrones y tejer al menos tres antes de etiquetarlos como patrones probados.

**Salida:** sin defectos bloqueantes, costos conocidos y feedback accionable.

### Etapa E — distribución
- PWA pública con página de acceso y aviso de beta.
- APK debug solo para pruebas internas.
- APK/AAB release firmado solo tras configurar firma, privacidad, pruebas en dispositivos reales y checklist de publicación.

## 5. Arquitectura objetivo para la primera beta

- **Cliente:** conservar la interfaz web actual y PWA; no reescribir a Flutter.
- **Backend:** Express existente; toda clave de IA permanece en el servidor.
- **Sesión beta:** cookie firmada existente, identificada claramente como sesión temporal; no anunciar registro de cuenta hasta implementar autenticación real.
- **Persistencia inicial:** volumen persistente y una sola réplica para la beta privada.
- **Persistencia de escala:** PostgreSQL/Supabase con políticas de acceso por usuario antes de cuentas y despliegue multiinstancia.
- **Android:** Capacitor empaqueta la misma PWA una vez que el backend HTTPS esté confirmado.

## 6. Mejoras de producto recomendadas

1. **Ficha de patrón estructurada:** separar datos de proyecto y texto narrativo para poder editar, exportar y validar sin depender de analizar párrafos.
2. **Semáforo honesto de calidad:** mostrar “conteos revisados”, “conteos no interpretados” y “no probado físicamente”. No usar “patrón garantizado”.
3. **Reparación controlada:** si el validador encuentra una ronda inválida, pedir una corrección al modelo y volver a validar; limitar intentos y conservar la versión original.
4. **Vista de progreso:** marcar piezas y rondas terminadas sin alterar el patrón original.
5. **Control de costos:** limitar tamaño de solicitud, concurrencia, imágenes por usuario y reintentos.
6. **Feedback de beta:** botón para reportar patrón incorrecto, adjuntar proyecto/versión y consentimiento explícito antes de enviar datos.

## 7. Métricas para decidir si PuntIA funciona

Medir desde el primer grupo:
- Activación: usuarios que generan su primer patrón.
- Éxito: patrones que terminan sin error técnico.
- Calidad: rondas válidas / rondas interpretables; tasa de reparación.
- Utilidad: proyectos guardados y exportados.
- Retención: usuarios que regresan a los 7 días.
- Economía: costo promedio de IA por patrón y por usuario activo.
- Confianza: reportes de patrón incoherente y resultados tejidos satisfactoriamente.

No activar suscripción ni prometer generación ilimitada hasta conocer el costo real y la calidad.

## 8. Bloqueos que requieren configuración del propietario

No se deben inventar ni guardar en Git:
- Clave válida de OpenAI y presupuesto/cuota de pruebas.
- Servicio de hosting y dominio HTTPS.
- Secreto de sesión de producción (mínimo 32 bytes).
- Orígenes web permitidos.
- Para cuentas reales: proyecto de autenticación y base de datos.
- Para Android release: clave de firma protegida fuera del repositorio.

## 9. Criterio de “beta funcional”

PuntIA puede invitar a usuarios a una beta privada cuando:
- La URL HTTPS abre y carga bien en Android.
- La IA real genera al menos un patrón desde el backend.
- El patrón incluye piezas, rondas, materiales, ensamblaje y advertencias.
- El validador distingue correctamente válido/inválido/no verificable.
- El proyecto puede guardarse, recuperarse y exportarse.
- Dos sesiones no comparten proyectos.
- Las pruebas automáticas pasan.
- La página explica que los patrones son asistidos por IA y requieren revisión/tejido de prueba.

PuntIA no se declara lista para venta ni publicación general hasta completar autenticación real, persistencia transaccional, privacidad, límites de costo y pruebas físicas/documentadas.
