# Gamer Reels Bot

Cada día: Claude inventa un tema de setups/cuartos gamer → baja fotos de Pexels → Remotion renderiza un Reel vertical → se sube a Cloudinary → se publica en Instagram. Todo corre en GitHub Actions.

## Configuración (una sola vez)

1. **Instagram**: cuenta Business o Creator vinculada a una página de Facebook.
2. **Meta for Developers**: crea una app, añade la Instagram Graph API y obtén un token con permiso `instagram_content_publish`. Guarda el `IG_USER_ID` y el token de larga duración (dura ~60 días; renuévalo).
3. **Pexels**: clave gratis en pexels.com/api.
4. **Cloudinary**: cuenta gratis; copia cloud name, API key y API secret.
5. **Anthropic**: API key en console.anthropic.com.
6. Sube este proyecto a un repo de GitHub y agrega estos *Secrets* (Settings → Secrets → Actions):
   `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `IG_USER_ID`, `IG_ACCESS_TOKEN`.
7. En la pestaña Actions ejecuta "Reel diario" a mano para probar. Luego corre solo cada día (cambia la hora en `.github/workflows/daily.yml`).

## Probar en local sin publicar

```
npm install
cp .env.example .env   # rellena y exporta las variables
npm run generate && npm run render
DRY_RUN=1 npm run publish
```
El video queda en `out/video.mp4`. Con `npm run studio` ajustas el diseño visualmente.

## Música (opcional)
Pon un `public/music.mp3` libre de derechos (ej. YouTube Audio Library) y se añade sola. La API de Instagram no permite usar música de su biblioteca.

## Notas
- Fotos de Pexels: licencia libre de uso comercial, sin atribución obligatoria.
- Si Meta cambia la versión de la API, ajusta `GRAPH_VERSION`.
- Los temas usados se guardan en `data/history.json` para no repetirse.
