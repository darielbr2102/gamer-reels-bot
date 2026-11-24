// Sube out/video.mp4 a Cloudinary y lo publica como Reel con la Instagram Graph API
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = process.env;
const clean = (v) => (v || '').replace(/^Bearer\s+/i, '').replace(/["'\s]/g, '');
const TOKEN = clean(env.IG_ACCESS_TOKEN);
const IG_ID = clean(env.IG_USER_ID);
const VERSION = env.GRAPH_VERSION || 'v25.0';
const caption = fs.readFileSync('data/caption.txt', 'utf8');
const props = JSON.parse(fs.readFileSync('data/props.json', 'utf8'));

if (env.DRY_RUN === '1') {
  console.log('DRY_RUN: no se publica. Caption:\n' + caption);
  process.exit(0);
}

console.log('Largo del token:', TOKEN.length, '| Largo del ID:', IG_ID.length, '| ID solo números:', /^\d+$/.test(IG_ID));
if (TOKEN.length < 60) console.log('AVISO: el token es muy corto, parece mal copiado o es otro dato.');
if (!/^\d+$/.test(IG_ID)) console.log('AVISO: IG_USER_ID debe ser solo un número.');

// Detecta con qué API funciona tu token
async function pickHost() {
  const errors = [];
  for (const host of ['graph.instagram.com', 'graph.facebook.com']) {
    const r = await fetch(`https://${host}/${VERSION}/${IG_ID}?fields=id&access_token=${TOKEN}`);
    if (r.ok) {
      console.log('Usando', host);
      return host;
    }
    errors.push(`${host}: HTTP ${r.status} ${await r.text()}`);
  }
  throw new Error('El token o el IG_USER_ID no funcionan en ninguna API:\n' + errors.join('\n'));
}
const GRAPH = `https://${await pickHost()}/${VERSION}`;

// 1) Cloudinary (subida firmada)
const timestamp = Math.floor(Date.now() / 1000);
const publicId = `reel_${timestamp}`;
const signature = crypto
  .createHash('sha1')
  .update(`public_id=${publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)
  .digest('hex');
const form = new FormData();
form.append('file', new Blob([fs.readFileSync('out/video.mp4')]), 'video.mp4');
form.append('api_key', env.CLOUDINARY_API_KEY);
form.append('timestamp', String(timestamp));
form.append('public_id', publicId);
form.append('signature', signature);
const up = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/video/upload`, {method: 'POST', body: form});
if (!up.ok) throw new Error(`Cloudinary ${up.status}: ${await up.text()}`);
const videoUrl = (await up.json()).secure_url;

// 2) Contenedor de Reel
const create = await fetch(`${GRAPH}/${IG_ID}/media`, {
  method: 'POST',
  body: new URLSearchParams({media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: TOKEN}),
});
const created = await create.json();
if (!created.id) throw new Error('Error creando contenedor: ' + JSON.stringify(created));

// 3) Esperar a que Instagram procese el video
for (let i = 0; i < 30; i++) {
  const st = await (await fetch(`${GRAPH}/${created.id}?fields=status_code&access_token=${TOKEN}`)).json();
  if (st.status_code === 'FINISHED') break;
  if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error('Instagram falló: ' + JSON.stringify(st));
  if (i === 29) throw new Error('Timeout esperando a Instagram');
  await new Promise((r) => setTimeout(r, 10000));
}

// 4) Publicar
const pub = await (await fetch(`${GRAPH}/${IG_ID}/media_publish`, {
  method: 'POST',
  body: new URLSearchParams({creation_id: created.id, access_token: TOKEN}),
})).json();
if (!pub.id) throw new Error('Error publicando: ' + JSON.stringify(pub));
console.log('Publicado, media id:', pub.id);

// 5) Guardar historial para no repetir temas
const history = JSON.parse(fs.readFileSync('data/history.json', 'utf8'));
history.push({date: new Date().toISOString().slice(0, 10), topic: props.topic});
fs.writeFileSync('data/history.json', JSON.stringify(history, null, 2));
