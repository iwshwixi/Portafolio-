# Jorgeditor Portfolio

Portafolio estatico para GitHub Pages inspirado en una experiencia tipo YT Jobs: limpio, directo, con videos, metricas, paquetes, horario y formulario de cotizacion por Gmail.

## Editar contenido

- El correo de contacto esta en `data/site.json`, campo `contactEmail`.
- Cambia precios, horario y tiempos de entrega en `data/site.json`.
- Agrega tus videos en `data/videos.json`.
- Para cada video real, pega solo el ID de YouTube en `videoId`.

## Formulario de cotizacion

El formulario envia solicitudes usando FormSubmit AJAX, asi el visitante no necesita escribir ni ver el correo en la interfaz.

La primera vez que alguien envie el formulario, FormSubmit mandara un correo de activacion a `contactEmail`. Debes confirmar ese correo para que los siguientes mensajes lleguen normal.

El correo no se muestra visualmente en la pagina, pero cualquier sitio 100% estatico puede exponer configuracion si alguien inspecciona el codigo fuente. Para ocultarlo completamente se necesita un backend o una funcion serverless.

Ejemplo:

```json
{
  "videoId": "abc123DEF",
  "title": "Mi mejor video editado",
  "client": "Canal del cliente",
  "category": "Long form"
}
```

## Vistas reales de YouTube

La web usa `data/youtube-stats.json` para mostrar vistas, likes y comentarios reales. Para actualizarlo automaticamente en GitHub:

1. Crea una API key en Google Cloud con YouTube Data API v3 activada.
2. En tu repo de GitHub, entra a `Settings > Secrets and variables > Actions`.
3. Agrega un secreto llamado `YOUTUBE_API_KEY`.
4. Ejecuta el workflow `Update YouTube stats` o espera la actualizacion cada 12 horas.

No pongas la API key dentro del frontend.

## Publicar en GitHub Pages

1. Sube esta carpeta como repo.
2. En GitHub, entra a `Settings > Pages`.
3. Selecciona `Deploy from a branch`.
4. Usa la rama `main` y la carpeta `/root`.

El sitio no requiere build ni dependencias.
