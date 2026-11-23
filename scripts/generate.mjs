import fs from 'node:fs';

const {ANTHROPIC_API_KEY} = process.env;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
if (!ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');

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

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01'},
  body: JSON.stringify({model: MODEL, max_tokens: 1500, messages: [{role: 'user', content: prompt}]}),
});
if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
const data = await res.json();
const raw = data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
const plan = JSON.parse(raw.replace(/```json|```/g, '').trim());

fs.rmSync('public/img', {recursive: true, force: true});
fs.mkdirSync('public/img', {recursive: true});

async function makeImage(description, index) {
  const text = `${description}, vertical composition, cinematic lighting, high quality, no text, no watermark`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const seed = Math.floor(Math.random() * 1e6);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(text)}?width=768&height=1344&model=flux&nologo=true&seed=${seed}`;
      const r = await fetch(url);
      const type = r.headers.get('content-type') || '';
      if (r.ok && type.startsWith('image/')) return Buffer.from(await r.arrayBuffer());
      console.log(`Slide ${index}: intento ${attempt} falló (HTTP ${r.status})`);
    } catch (e) {
      console.log(`Slide ${index}: intento ${attempt} error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  throw new Error(`No se pudo generar la imagen del slide ${index}`);
}

const slides = [];
for (const [i, s] of plan.slides.entries()) {
  const buf = await makeImage(s.image_prompt, i);
  const file = `img/slide${i}.jpg`;
  fs.writeFileSync(`public/${file}`, buf);
  slides.push({text: s.text, image: file});
}

const music = fs.existsSync('public/music.mp3') ? 'music.mp3' : null;
fs.writeFileSync('data/props.json', JSON.stringify({slides, music, topic: plan.topic}, null, 2));
fs.writeFileSync('data/caption.txt', `${plan.caption}\n\n${plan.hashtags.join(' ')}`);
console.log('Generado:', plan.topic);
