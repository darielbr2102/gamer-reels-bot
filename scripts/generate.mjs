import fs from 'node:fs';

const {GEMINI_API_KEY} = process.env;
if (!GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY');
const MODELS = [process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'].filter(Boolean);
const IMAGE_MODELS = [process.env.GEMINI_IMAGE_MODEL, 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'].filter(Boolean);

const history = JSON.parse(fs.readFileSync('data/history.json', 'utf8'));
const recent = history.slice(-40).map((h) => h.topic);

const prompt = `Eres creador de contenido de Instagram sobre setups gamer y cuartos gamer.
Crea UN Reel nuevo en español (tips, ideas, tours de setup, organización de cables, iluminación, escritorios, sillas, monitores, ambientación, presupuesto, etc.).
Temas ya usados (NO repetir): ${JSON.stringify(recent)}

Responde SOLO con JSON válido, sin texto extra ni markdown:
{
  "topic": "tema corto",
  "slides": [
    {"text": "frase corta, máx 8 palabras", "image_prompt": "english visual description"}
  ],
  "caption": "descripción atractiva de 2-3 líneas con una pregunta al final",
  "hashtags": ["#gamer", "..."]
}
Reglas: 6 slides. El primero es un gancho fuerte. El último es un llamado a seguir la cuenta.
Cada "image_prompt" debe ser en inglés, describir una escena concreta y relacionada con el texto de ese slide (ej: "modern gaming desk with ultrawide monitor and purple RGB lights, dark room, photorealistic").
Sin personas ni texto en las imágenes.`;

async function askGemini() {
  let lastError = '';
  for (let round = 1; round <= 3; round++) {
    for (const model of MODELS) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY},
        body: JSON.stringify({
          contents: [{parts: [{text: prompt}]}],
          generationConfig: {responseMimeType: 'application/json', temperature: 1},
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
        if (text) {
          console.log('Modelo usado:', model);
          return text;
        }
      }
      lastError = `${model}: HTTP ${res.status} ${await res.text()}`;
      console.log('Falló', lastError.slice(0, 300));
    }
    console.log(`Ronda ${round} sin éxito, esperando antes de reintentar...`);
    await new Promise((r) => setTimeout(r, 20000 * round));
  }
  throw new Error('Gemini no respondió. Último error: ' + lastError);
}

const raw = await askGemini();
const plan = JSON.parse(raw.replace(/```json|```/g, '').trim());

fs.rmSync('public/img', {recursive: true, force: true});
fs.mkdirSync('public/img', {recursive: true});

let geminiImagesOk = true;
let pollinationsOk = true;

// Fuente 1: imágenes con Gemini (misma clave)
async function geminiImage(description) {
  const text = `Generate a vertical 9:16 photo: ${description}. Cinematic lighting, high quality, no text, no watermark, no people.`;
  for (const model of IMAGE_MODELS) {
    for (const withConfig of [true, false]) {
      const generationConfig = {responseModalities: ['TEXT', 'IMAGE']};
      if (withConfig) generationConfig.imageConfig = {aspectRatio: '9:16'};
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY},
        body: JSON.stringify({contents: [{parts: [{text}]}], generationConfig}),
      });
      if (res.ok) {
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const part = parts.find((p) => p.inlineData || p.inline_data);
        const inline = part?.inlineData || part?.inline_data;
        if (inline?.data) {
          return {buf: Buffer.from(inline.data, 'base64'), mime: inline.mimeType || inline.mime_type || 'image/png'};
        }
        console.log(`Imagen Gemini (${model}): respuesta sin imagen`);
        break;
      }
      const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
      console.log(`Imagen Gemini (${model}${withConfig ? '' : ', sin config'}): HTTP ${res.status} ${body}`);
      if (res.status === 400 && withConfig) continue;
      break;
    }
  }
  return null;
}

// Fuente 2: Pollinations
async function pollinationsImage(description) {
  const text = `${description}, vertical composition, cinematic lighting, high quality, no text, no watermark`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const seed = Math.floor(Math.random() * 1e6);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=768&height=1344&model=flux&nologo=true&seed=${seed}`;
      const r = await fetch(url);
      const type = r.headers.get('content-type') || '';
      if (r.ok && type.startsWith('image/')) return {buf: Buffer.from(await r.arrayBuffer()), mime: type};
      console.log(`Pollinations: intento ${attempt} falló (HTTP ${r.status})`);
      if ([401, 402, 403].includes(r.status)) return 'disabled';
    } catch (e) {
      console.log(`Pollinations: intento ${attempt} error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

async function makeImage(description, index) {
  let result = null;
  if (geminiImagesOk) {
    result = await geminiImage(description);
    if (!result) {
      geminiImagesOk = false;
      console.log('Imágenes de Gemini no disponibles, se dejan de intentar.');
    }
  }
  if (!result && pollinationsOk) {
    const p = await pollinationsImage(description);
    if (p === 'disabled') {
      pollinationsOk = false;
      console.log('Pollinations ya no es gratuito, se deja de intentar.');
    } else {
      result = p;
    }
  }
  if (!result) {
    console.log(`Slide ${index}: sin imagen, se usará fondo de color.`);
    return '';
  }
  const ext = result.mime.includes('png') ? 'png' : 'jpg';
  const file = `img/slide${index}.${ext}`;
  fs.writeFileSync(`public/${file}`, result.buf);
  return file;
}

const slides = [];
for (const [i, s] of plan.slides.entries()) {
  const image = await makeImage(s.image_prompt, i);
  slides.push({text: s.text, image});
}

const music = fs.existsSync('public/music.mp3') ? 'music.mp3' : null;
fs.writeFileSync('data/props.json', JSON.stringify({slides, music, topic: plan.topic}, null, 2));
fs.writeFileSync('data/caption.txt', `${plan.caption}\n\n${plan.hashtags.join(' ')}`);
console.log('Generado:', plan.topic);
