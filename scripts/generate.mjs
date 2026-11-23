// 1) Pide a Claude el tema/guion  2) Descarga fotos de Pexels  3) Escribe data/props.json
import fs from 'node:fs';

const {ANTHROPIC_API_KEY, PEXELS_API_KEY} = process.env;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
if (!ANTHROPIC_API_KEY || !PEXELS_API_KEY) throw new Error('Faltan ANTHROPIC_API_KEY o PEXELS_API_KEY');

const history = JSON.parse(fs.readFileSync('data/history.json', 'utf8'));
const recent = history.slice(-40).map((h) => h.topic);

const prompt = `Eres creador de contenido de Instagram sobre setups gamer y cuartos gamer.
Crea UN Reel nuevo en español (tips, ideas, tours de setup, organización de cables, iluminación, escritorios, sillas, monitores, ambientación, presupuesto, etc.).
Temas ya usados (NO repetir): ${JSON.stringify(recent)}

Responde SOLO con JSON válido, sin texto extra ni markdown:
{
  "topic": "tema corto",
  "slides": [
    {"text": "frase corta, máx 8 palabras", "query": "english pexels search query"}
  ],
  "caption": "descripción atractiva de 2-3 líneas con una pregunta al final",
  "hashtags": ["#gamer", "..."]
}
Reglas: 6 slides. El primero es un gancho fuerte. El último es un llamado a seguir la cuenta.
Cada "query" debe ser en inglés y devolver fotos de setups o cuartos gamer (ej: "gaming desk setup rgb", "gaming room led lights").`;

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

const usedIds = new Set();
const slides = [];
for (const [i, s] of plan.slides.entries()) {
  const r = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(s.query)}&orientation=portrait&per_page=15`,
    {headers: {Authorization: PEXELS_API_KEY}},
  );
  if (!r.ok) throw new Error(`Pexels ${r.status}: ${await r.text()}`);
  const {photos} = await r.json();
  const options = photos.filter((p) => !usedIds.has(p.id));
  if (!options.length) throw new Error(`Sin fotos para "${s.query}"`);
  const photo = options[Math.floor(Math.random() * options.length)];
  usedIds.add(photo.id);
  const img = await fetch(photo.src.large2x);
  const file = `img/slide${i}.jpg`;
  fs.writeFileSync(`public/${file}`, Buffer.from(await img.arrayBuffer()));
  slides.push({text: s.text, image: file});
}

const music = fs.existsSync('public/music.mp3') ? 'music.mp3' : null;
fs.writeFileSync('data/props.json', JSON.stringify({slides, music, topic: plan.topic}, null, 2));
fs.writeFileSync('data/caption.txt', `${plan.caption}\n\n${plan.hashtags.join(' ')}`);
console.log('Generado:', plan.topic);
