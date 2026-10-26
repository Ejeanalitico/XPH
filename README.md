# XPH Fotografía & Video

Sitio comercial de XPH construido con React, TypeScript, Vite y funciones de Vercel. La configuración dinámica se almacena en Google Sheets/Drive mediante Google Apps Script.

El panel privado incluye CRM de prospectos y clientes, control de gastos y gestión de contratos. Los contratos se guardan en Drive sin acceso público y pueden enviarse mediante una liga temporal para lectura, aceptación y firma desde un teléfono.

## Desarrollo

```bash
npm ci
npm run check
npm run dev
```

`npm run check` ejecuta el chequeo de TypeScript y la compilación de producción.

## Arquitectura segura

- El navegador consulta únicamente `/api/proxy` y nunca llama directamente a Apps Script.
- El proxy elimina credenciales, solicitudes privadas y tokens antes de devolver configuración pública.
- Las operaciones administrativas usan una cookie `HttpOnly`, `Secure` y `SameSite=Strict`.
- Apps Script rechaza cualquier solicitud que no incluya el secreto compartido del servidor.
- Las ligas de firma se almacenan como hash, caducan a las 72 horas y se consumen después de firmar.
- Si una liga de firma se abre desde una computadora, se invalida y debe generarse una nueva.
- La firma privada de Javier se aplica únicamente después de una autorización explícita desde el panel.
- Se conservan el PDF original, el PDF firmado por el cliente, el documento final y la evidencia técnica de aceptación.

## Variables de Vercel

Configura estas variables en Production, Preview y Development:

- `XPH_APPS_SCRIPT_URL`: URL `/exec` del despliegue de Apps Script.
- `XPH_APPS_SCRIPT_SHARED_SECRET`: secreto compartido con Apps Script.
- `XPH_SESSION_SECRET`: secreto independiente para firmar sesiones administrativas.
- `XPH_ADMIN_EMAIL`: correo autorizado para iniciar sesión en el panel administrativo.
- `XPH_ADMIN_PASSWORD`: contraseña administrativa fuerte, almacenada únicamente en Vercel.
- `XPH_VERCEL_ANALYTICS_TOKEN`: token de lectura limitado al proyecto para consultar Web Analytics desde el panel.
- `XPH_VERCEL_PROJECT_ID`: identificador del proyecto que genera las métricas.
- `XPH_VERCEL_TEAM_ID`: identificador del equipo propietario del proyecto.

Genera dos secretos distintos de al menos 32 bytes. No uses variables con prefijo `VITE_` para secretos.
La contraseña administrativa anterior almacenada en la configuración dinámica deja de utilizarse.

## Propiedades de Google Apps Script

En **Configuración del proyecto → Propiedades del script**, registra:

- `XPH_API_SECRET`: el mismo valor de `XPH_APPS_SCRIPT_SHARED_SECRET`.
- `XPH_SPREADSHEET_ID`: ID de la base de datos de Sheets.
- `XPH_FOLDER_ID`: ID de la carpeta de Drive.

Después crea una nueva implementación de la aplicación web. El despliegue debe ejecutarse como el propietario y aceptar únicamente el acceso necesario para el proxy.

## Orden de publicación

1. Configura las tres variables en Vercel.
2. Configura las tres propiedades en Apps Script.
3. Actualiza y despliega `google-apps-script.js`.
4. Ejecuta una vez `initDatabase()` para crear las pestañas `CRM_Clientes`, `Gastos`, `Contratos` y `Firma_Administrador` sin registros ficticios.
5. Publica la aplicación en Vercel.
6. Comprueba la página pública, el inicio de sesión administrativo, la carga privada de un PDF y una liga móvil de firma.

No publiques credenciales, claves de Drive, IDs privados ni archivos `.vercel/project.json` en el repositorio.
# Google Fotos en galerías privadas

En el administrador: **Galerías privadas → seleccionar galería → Agregar desde Google Fotos**.
Conecta la cuenta, elige fotografías en el selector de Google, pulsa **Listo** y vuelve a **Importar selección**.
Se importan fotografías, no videos. Se guardan copias administradas mediante la carga existente de Drive; no se almacenan las URLs temporales ni los tokens de Google Fotos. Cada foto se guarda antes de continuar con la siguiente. Un reintento en la misma sesión reutiliza las copias ya cargadas.

Configuración de Google Cloud para el cliente OAuth indicado en `XPH_GOOGLE_CLIENT_ID`:

- Habilitar **Google Photos Picker API**.
- Registrar `https://www.xaviph.com` como origen JavaScript autorizado (y cada origen adicional donde se use el administrador).
- Configurar el consentimiento para `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`; si la aplicación está en pruebas, incluir las cuentas que importarán fotos como usuarios de prueba.
- La autorización es interactiva y temporal. No requiere modificar el secreto del cliente ni los permisos actuales de Drive.

Verificación: `npm run test:google-photos` y `npm run typecheck`. La prueba de importación real requiere una cuenta de Google y consentimiento en el navegador.
