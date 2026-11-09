# Importación de galerías de Google Drive sin límite de 1,000

## Componentes y orden de despliegue

La web usa dos componentes independientes: **Google Apps Script** para recorrer
Google Drive y almacenar la configuración en Sheets, y **Vercel** para el panel.
Cambiar solo Vercel no actualiza el Apps Script publicado.

1. En Google Apps Script, abre el proyecto existente del CRM XPH, crea una versión
   de respaldo y sustituye el contenido del archivo principal por
   [google-apps-script.js](../google-apps-script.js) de este mismo commit.
   **No reemplaces las propiedades/credenciales del proyecto.**
2. Abre **Implementar → Gestionar implementaciones**, edita la implementación
   web que ya usa XPH, selecciona **Nueva versión** y confirma. Mantén la misma
   URL `/exec`; crear una implementación nueva puede romper la conexión de Vercel.
3. En GitHub, fusiona la rama validada a `master` para actualizar el panel.
   Comprueba en Vercel que el despliegue de producción esté en estado **READY**.
4. Abre `www.xaviph.com`, entra al panel administrador, selecciona la galería
   privada existente y usa **Agregar desde Google Drive** con la liga de la carpeta.
   Mantén la pestaña abierta hasta ver la confirmación final.

## Verificaciones

- La carpeta de prueba Speed Fest contenía **1,417 imágenes** el 9/nov/2026.
  El resultado esperado, mientras ese contenido no cambie, es **1,417 archivos
  en total**, con cero registros duplicados para el mismo ID en la galería.
- El contador muestra archivos leídos y **nuevas** fotografías guardadas.
  Si ya había 1,000 imágenes, se esperan alrededor de 417 nuevas.
- Repetir la importación debe agregar **0 fotografías nuevas** si el contenido
  de Drive no cambió.
- Si una solicitud falla, el panel reintenta hasta tres veces. Si la importación
  queda incompleta, volver a ejecutar sobre la misma galería preserva los bloques
  guardados; no borres la galería.
- En `Config_Activa` de Sheets verás filas `config_chunk_b64:...` y una
  `config_complete_b64:...`. La configuración solo se considera válida
  cuando existe su marcador de finalización.
- Los archivos originales de Google Drive no se copian ni borran en este proceso.
  La importación **sí intenta activar acceso de lectura por enlace** en cada
  archivo compatible, igual que el importador anterior.

## Diagnóstico de errores comunes

- **“Apps Script todavía tiene el límite de 1,000”**: faltó publicar la nueva
  versión de la implementación web existente de Apps Script.
- **“La sesión de lectura de Drive expiró”**: vuelve a importar; los registros
  existentes se omiten por ID.
- **“No se pudo verificar la configuración completa”**: revisa permisos y
  espacio en Google Sheets. El escritor conserva la versión previamente válida
  si la nueva escritura falla.
- **Archivos que no cargan**: comprueba permisos de lectura de esas fotos en Drive
  y las advertencias de permisos durante la importación.

## Pruebas del código

```bash
npm ci
node scripts/test-drive-folder-import.mjs
npm run typecheck
npm run build
```

La prueba crea 1,417 fotos simuladas, verifica que se devuelvan todas mediante
continuaciones y que la configuración se recupere de Sheets con más de 50,000
caracteres; no modifica datos de producción.
