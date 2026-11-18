# PuntIA — entorno de validación

Este servicio Railway está reservado para validar la beta, no para producción comercial.

- Repositorio: `brayantatoo567-creator/PuntIA-1`
- Rama: `release/mvp-beta-2026-11`
- Servicio Railway: `puntia-validation`
- Comando de inicio: `node server.js`
- Puerto: `8080` (Railway lo proporciona mediante `PORT`)
- Healthcheck: `/api/health`
- Persistencia: `/app/data` (volumen ya existente; no recrear ni borrar)
- Una réplica mientras la memoria sea un archivo JSON local.

No guardar claves en este archivo ni en Git. La beta requiere probar por separado la disponibilidad de OpenAI, guardado/recuperación de memoria, aislamiento de sesiones y comportamiento móvil.
