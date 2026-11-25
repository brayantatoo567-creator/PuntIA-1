# TEJILUME 1.1

**Tu idea, puntada a puntada.**

TEJILUME convierte ideas escritas o fotografías en proyectos de crochet y amigurumi. Esta versión añade un panel administrativo privado en la misma aplicación para gestionar la clave de OpenAI, el interruptor de IA y el límite diario sin editar código ni abrir la consola de Render.

## Panel de administración

- Abre https://TU-DOMINIO.onrender.com/admin desde el celular.
- Usuario fijo: `admin`.
- La contraseña se define en `ADMIN_PASSWORD`.
- Sesión firmada con `SESSION_SECRET`, cookie `HttpOnly`, `Secure` en producción, `SameSite=Strict` y duración máxima de 12 horas.
- Cinco intentos fallidos por IP provocan bloqueo durante 15 minutos; los intentos se registran en PostgreSQL.
- Guarda una clave de OpenAI desde el teléfono. El servidor la cifra con AES-256-GCM y `MASTER_KEY` antes de guardarla. El panel solo recibe el indicador de los últimos cuatro caracteres.
- La clave guardada tiene prioridad. Si no existe, se usa `OPENAI_API_KEY` del entorno como respaldo.
- El botón «Probar conexión» realiza una llamada mínima a OpenAI sin devolver la clave ni mostrarla en el panel.
- El administrador puede activar/desactivar IA y configurar un tope diario de 1 a 10,000 operaciones. El contador se guarda por fecha UTC en PostgreSQL.
- La clave no se guarda en `localStorage`, `sessionStorage`, HTML, respuestas JSON ni logs. Se transmite una sola vez desde el formulario al servidor por HTTPS y el campo se limpia tras guardar.

## Base de datos gratuita: Neon PostgreSQL

TEJILUME ya utiliza PostgreSQL para memoria. El panel reutiliza esa misma conexión y crea sus tablas automáticamente al iniciar. No se necesita una segunda base de datos ni guardar secretos en el disco efímero de Render.

1. Crea una cuenta en [Neon](https://neon.com/).
2. Selecciona **Create project** y elige una región cercana a tu servicio de Render.
3. Crea el proyecto con el plan **Free**.
4. En el panel del proyecto, abre **Connect** y selecciona Node.js. Copia la cadena de conexión PostgreSQL; si está disponible, usa el host con `-pooler` para la conexión agrupada.
5. En Render, abre el servicio de TEJILUME → **Environment** y pega esa cadena como `DATABASE_URL`.
6. Guarda las variables y despliega la rama `release/mvp-beta-2026-11` (o el commit publicado).

### Límites del plan gratuito de Neon

Según la documentación de Neon consultada en noviembre de 2026, Free incluye 100 proyectos, hasta 10 ramas por proyecto, 100 CU-hours por proyecto al mes, 1 GB de PostgreSQL por proyecto (hasta 20 GB en la cuenta) y 5 GB de transferencia de red saliente por proyecto al mes. El cómputo escala a cero tras cinco minutos sin actividad. Si se agotan las horas de cómputo o la transferencia, Neon suspende el cómputo hasta el siguiente periodo mensual o hasta cambiar de plan; los datos almacenados no se borran. Si se llena el almacenamiento, las escrituras que lo aumenten fallan. Revisa periódicamente el consumo y conserva una copia de seguridad. Las cuotas y condiciones pueden cambiar. Referencias: [límites oficiales del plan Free](https://neon.com/docs/introduction/free-plan-limits-and-quotas) y [planes de Neon](https://neon.com/docs/introduction/plans).

## Variables de Render

Configura estas cinco variables. No pegues ninguna clave dentro del repositorio ni en archivos HTML.

| Variable | Valor |
|---|---|
| `ADMIN_PASSWORD` | Contraseña fuerte para el usuario fijo `admin` (mínimo 12 caracteres). |
| `SESSION_SECRET` | Secreto aleatorio de al menos 32 bytes para firmar la sesión. |
| `MASTER_KEY` | Clave maestra aleatoria de exactamente 32 bytes, expresada como 64 caracteres hexadecimales. No la cambies después de guardar la clave API, salvo que vuelvas a cifrarla. |
| `DATABASE_URL` | Cadena de conexión PostgreSQL de Neon. |
| `OPENAI_API_KEY` | **Opcional**. Respaldo si aún no has guardado una clave desde `/admin`. Puedes dejarla vacía después de guardar la clave en el panel. |

Genera los secretos localmente con un generador criptográfico fiable. Por ejemplo, en una terminal con Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ejecuta el comando dos veces: una salida para `SESSION_SECRET` y otra distinta para `MASTER_KEY`. No reutilices la misma salida. Guarda `MASTER_KEY` en un gestor de contraseñas y conserva una copia segura: si se pierde o cambia, la clave cifrada existente ya no podrá descifrarse. La contraseña de administrador no se incluye en el código ni se proporciona aquí.

No necesitas definir `PUNTIA_SESSION_SECRET`; `SESSION_SECRET` se utiliza también para firmar la cookie de sesión de la aplicación.

## Rutas principales

- `GET /admin`: panel privado y adaptable a celular.
- `POST /api/admin/login`, `POST /api/admin/logout`: inicio y cierre de sesión.
- `GET /api/admin/status`: estado seguro, últimos cuatro caracteres, contador y límite.
- `POST /api/admin/key`: recibe y cifra la clave.
- `POST /api/admin/test`: llamada mínima de prueba a OpenAI.
- `POST /api/admin/settings`: interruptor de IA y límite diario.
- `POST /api/imaginaria/create`: crea un patrón desde texto o fotografía.
- `POST /api/imaginaria/step-image`: genera una imagen didáctica.
- `GET /api/health`: comprueba el servidor y PostgreSQL.

Las solicitudes de IA consultan la configuración del servidor y nunca aceptan una clave enviada en una cabecera del navegador. El contador diario registra las generaciones de patrones y las imágenes por etapas. Las conversaciones y diagnósticos también respetan el interruptor de IA y necesitan una clave válida, pero no consumen el tope de generaciones. Las llamadas internas de corrección de un mismo patrón forman parte de la misma solicitud contabilizada.

## Desarrollo local y pruebas

Requisitos: Node.js 22 y PostgreSQL para probar el panel completo.

```bash
npm install
cp .env.example .env
npm test
npm run check
npm start
```

En desarrollo sin PostgreSQL, el servidor puede arrancar para pruebas básicas, pero el panel de administración no estará disponible. Para validar login, guardado cifrado, contador y límite, conecta una base PostgreSQL real.

## Calidad y límites

El validador comprueba aritmética de rondas, puntos consumidos entre vueltas consecutivas, numeración por pieza, correspondencia entre inventario y piezas desarrolladas, y referencias de ensamblaje. Las rondas no interpretables se marcan como no verificadas y el generador no entrega un patrón que no supere estas comprobaciones. Un resultado sin errores matemáticos detectados no equivale a una prueba física: antes de comercializar un patrón hay que tejer una muestra, comprobar medidas, tensión, ensamblaje y correspondencia visual.

La suite de calidad incluye 16 proyectos complejos de referencia y pruebas negativas. Son patrones deterministas para comprobar el motor de conteos y estructura; no equivalen a 16 respuestas de un proveedor LLM ni a pruebas físicas tejidas. El módulo de pagos sigue siendo una simulación local: no cobra ni bloquea funciones. Las llamadas de IA e imágenes requieren internet y consumen la cuota de OpenAI.

El APK de depuración no debe distribuirse como versión comercial sin firma, revisión de privacidad y pruebas en dispositivos reales.
