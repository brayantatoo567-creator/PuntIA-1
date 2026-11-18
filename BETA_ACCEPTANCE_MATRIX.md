# PuntIA — matriz de aceptación para beta

Esta matriz es el registro mínimo de pruebas. Estado inicial: **pendiente de ejecutar en esta rama**. Las pruebas simuladas no cuentan como prueba real del proveedor.

| ID | Caso | Resultado esperado | Evidencia requerida | Bloquea beta |
|---|---|---|---|---|
| P-01 | Abrir inicio desde Android Chrome | Carga sin desbordamiento ni controles cortados | Captura y dispositivo/navegador | Sí |
| P-02 | API health | HTTP 200; informa estado de IA sin exponer secretos | Respuesta sanitizada | Sí |
| P-03 | IA no configurada | Mensaje claro; no filtra stack ni clave | Prueba HTTP | Sí |
| P-04 | Generar amigurumi sencillo | Materiales, abreviaturas, piezas, rondas y ensamblaje | JSON/respuesta guardada | Sí |
| P-05 | Generar figura compleja | Desglosa piezas y uniones; advierte supuestos | Respuesta revisada | Sí |
| P-06 | Ronda aritmética correcta | Validador marca válida | Test unitario | Sí |
| P-07 | Ronda aritmética incorrecta | Validador marca inválida | Test unitario | Sí |
| P-08 | Notación no reconocida | Marca no verificable, nunca válida por defecto | Test unitario | Sí |
| P-09 | Patrón completo con rondas no interpretables | Muestra advertencia visible | Captura UI | Sí |
| P-10 | Guardar y reabrir proyecto | Contenido idéntico después de recargar | Prueba E2E | Sí |
| P-11 | Dos sesiones separadas | Una sesión no lee ni borra datos de la otra | Prueba de aislamiento | Sí |
| P-12 | Exportar/ imprimir | Texto legible, sin controles de interfaz ni cortes importantes | PDF/captura en móvil | Sí |
| P-13 | Enviar imagen válida | Análisis real o error controlado | Prueba con cuota autorizada | No para primera beta sin visión |
| P-14 | Enviar archivo falso con MIME imagen | Rechazo HTTP 415 | Prueba HTTP | Sí |
| P-15 | Superar tamaño máximo | Rechazo HTTP 413 | Prueba HTTP | Sí |
| P-16 | Origen web no permitido | Rechazo CORS/403 | Prueba HTTP | Sí |
| P-17 | Sin conexión | Explica que IA requiere internet y conserva la pantalla estable | Prueba manual | Sí |
| P-18 | Límite de concurrencia | HTTP 429 y Retry-After; proceso se recupera | Prueba de carga pequeña | Sí |
| P-19 | Reiniciar backend | Sesión y proyectos sobreviven según almacenamiento configurado | Prueba de persistencia | Sí |
| P-20 | Costo de generación | Costo registrado/estimado por solicitud sin exponer datos sensibles | Registro de uso | Sí antes de beta pública |

## Protocolo de aprobación

- Registrar commit, fecha, entorno y versión probada.
- Marcar cada caso como PASS, FAIL o BLOCKED; no dejar fallos como “casi aprobado”.
- Adjuntar evidencia mínima reproducible.
- Repetir pruebas afectadas después de cada corrección.
- La beta privada exige PASS en todos los casos marcados “Sí”.
- Las pruebas de tejido físico se registran por separado: patrón, materiales, tensión, tiempo, fotos del resultado y defectos observados.
