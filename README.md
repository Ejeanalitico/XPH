# XPH Fotografía & Video

Sitio comercial de XPH construido con React, TypeScript, Vite y funciones de Vercel. La configuración dinámica se almacena en Google Sheets/Drive mediante Google Apps Script.

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

## Variables de Vercel

Configura estas variables en Production, Preview y Development:

- `XPH_APPS_SCRIPT_URL`: URL `/exec` del despliegue de Apps Script.
- `XPH_APPS_SCRIPT_SHARED_SECRET`: secreto compartido con Apps Script.
- `XPH_SESSION_SECRET`: secreto independiente para firmar sesiones administrativas.
- `XPH_ADMIN_EMAIL`: correo autorizado para iniciar sesión en el panel administrativo.
- `XPH_ADMIN_PASSWORD`: contraseña administrativa fuerte, almacenada únicamente en Vercel.

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
4. Publica la aplicación en Vercel.
5. Comprueba la página pública, el inicio de sesión administrativo, una solicitud de disponibilidad y una galería privada.

No publiques credenciales, claves de Drive, IDs privados ni archivos `.vercel/project.json` en el repositorio.
