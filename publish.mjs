// Autoposter Focus Adv — pubblica il carosello del giorno su Instagram + Facebook.
// Eseguito da GitHub Actions (daily.yml). Zero dipendenze (fetch nativo).
// Secret richiesto (env): GRAPH_TOKEN. IG_USER_ID/FB_PAGE_ID non sono segreti:
// hanno un default fisso (l'account Focus Adv) sovrascrivibile via env.
// Input opzionali: DAY (forza un giorno), DRY_RUN=1 (non pubblica, stampa e basta).
import { readFileSync } from 'node:fs';

const GRAPH = 'https://graph.facebook.com/v21.0';
const TOKEN = process.env.GRAPH_TOKEN;
const IG = process.env.IG_USER_ID || '27879522138364660';   // @focusmediadv (IG business)
const PAGE = process.env.FB_PAGE_ID || '107016051875243';   // Focus Adv (FB Page)
const DRY = process.env.DRY_RUN === '1';

function todayRome() {
  // Data odierna nel fuso Europe/Rome, come YYYY-MM-DD.
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date());
}

async function g(path, params) {
  const url = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', TOKEN);
  const r = await fetch(url, { method: 'POST' });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(path + ' -> ' + JSON.stringify(j.error || j));
  return j;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function publishInstagram(entry) {
  // 1 container figlio per slide, poi container carosello, poi publish.
  const children = [];
  for (const img of entry.images) {
    const c = await g('/' + IG + '/media', { image_url: img, is_carousel_item: 'true' });
    children.push(c.id);
    await sleep(1500);
  }
  const parent = await g('/' + IG + '/media', {
    media_type: 'CAROUSEL', children: children.join(','), caption: entry.caption,
  });
  // attesa elaborazione container prima del publish
  await sleep(4000);
  const pub = await g('/' + IG + '/media_publish', { creation_id: parent.id });
  return pub.id;
}

async function publishFacebook(entry) {
  // Foto non pubblicate, poi post con attached_media.
  const fbids = [];
  for (const img of entry.images) {
    const p = await g('/' + PAGE + '/photos', { url: img, published: 'false' });
    fbids.push(p.id);
    await sleep(800);
  }
  const attached = fbids.map((id) => ({ media_fbid: id }));
  const post = await g('/' + PAGE + '/feed', {
    message: entry.caption, attached_media: JSON.stringify(attached),
  });
  return post.id;
}

async function main() {
  if (!TOKEN) throw new Error('Manca il secret GRAPH_TOKEN');
  const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)));
  const forced = process.env.DAY ? Number(process.env.DAY) : null;
  const entry = forced
    ? manifest.find((e) => e.day === forced)
    : manifest.find((e) => e.date === todayRome());
  if (!entry) { console.log('Nessun carosello per oggi (' + todayRome() + '). Esco.'); return; }
  console.log('Giorno ' + entry.day + ' · ' + entry.date + ' · #' + entry.id + ' — ' + entry.title);
  if (DRY) { console.log('DRY_RUN: non pubblico. Slide:', entry.images.length); return; }
  const igId = await publishInstagram(entry);
  console.log('Instagram OK · media ' + igId);
  const fbId = await publishFacebook(entry);
  console.log('Facebook OK · post ' + fbId);
}

main().catch((e) => { console.error('ERRORE:', e.message); process.exit(1); });
