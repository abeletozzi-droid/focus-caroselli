// Autoposter Focus Adv — pubblica il carosello del giorno su Instagram + Facebook.
// Eseguito da GitHub Actions (daily.yml). Zero dipendenze (fetch nativo).
// Pubblica tramite il PROXY HTTP di Composio: il CLI Composio e' solo-macOS,
// quindi in CI usiamo l'API HTTP che inietta i token Meta (nessun token Meta
// da conservare: serve solo il secret COMPOSIO_API_KEY).
//   - Instagram: connected account instagram (graph.instagram.com) -> caroselli
//   - Facebook : connected account facebook (graph.facebook.com) -> Page token a runtime
// Input opzionali: DAY (forza un giorno), DRY_RUN=1 (non pubblica, stampa e basta).
import { readFileSync } from 'node:fs';

const PROXY = 'https://backend.composio.dev/api/v3/tools/execute/proxy';
const CK = process.env.COMPOSIO_API_KEY;
const IG_CA = process.env.IG_CA || 'ca_4FpAO2GDvZKh';   // instagram @focusmediadv (BUSINESS)
const FB_CA = process.env.FB_CA || 'ca_d_hVRBBm9qEL';   // facebook (admin Pagina Focus Adv)
const PAGE = process.env.FB_PAGE_ID || '107016051875243'; // Focus Adv (FB Page)
const DRY = process.env.DRY_RUN === '1';

function todayRome() {
  // Data odierna nel fuso Europe/Rome, come YYYY-MM-DD.
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(new Date());
}

const enc = encodeURIComponent;

async function proxy(connectedAccountId, endpoint, method = 'POST') {
  // Inoltra una chiamata Graph tramite il proxy Composio, che inietta il token
  // del connected account indicato. Ritorna il body Graph (campo .data).
  const r = await fetch(PROXY, {
    method: 'POST',
    headers: { 'x-api-key': CK, 'content-type': 'application/json' },
    body: JSON.stringify({ connected_account_id: connectedAccountId, endpoint, method }),
  });
  const j = await r.json();
  const status = j.status || r.status;
  const data = j.data ?? j;
  if (!r.ok || status >= 400 || (data && data.error)) {
    throw new Error(endpoint.split('?')[0] + ' -> ' + JSON.stringify(data && data.error ? data.error : data));
  }
  return data;
}

async function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function publishInstagram(entry) {
  // 1 container figlio per slide, poi container carosello, poi publish.
  const children = [];
  for (const img of entry.images) {
    const c = await proxy(IG_CA, '/me/media?image_url=' + enc(img) + '&is_carousel_item=true');
    children.push(c.id);
    await sleep(1500);
  }
  const parent = await proxy(
    IG_CA,
    '/me/media?media_type=CAROUSEL&children=' + enc(children.join(',')) + '&caption=' + enc(entry.caption),
  );
  await sleep(4000); // attesa elaborazione container prima del publish
  const pub = await proxy(IG_CA, '/me/media_publish?creation_id=' + enc(parent.id));
  return pub.id;
}

async function publishFacebook(entry) {
  // Serve il Page token (le foto non pubblicate vanno postate "come Pagina").
  const pageToken = (await proxy(FB_CA, '/' + PAGE + '?fields=access_token', 'GET')).access_token;
  const fbids = [];
  for (const img of entry.images) {
    const p = await proxy(
      FB_CA,
      '/' + PAGE + '/photos?url=' + enc(img) + '&published=false&access_token=' + enc(pageToken),
    );
    fbids.push(p.id);
    await sleep(800);
  }
  const attached = fbids.map((id) => ({ media_fbid: id }));
  const post = await proxy(
    FB_CA,
    '/' + PAGE + '/feed?message=' + enc(entry.caption) +
      '&attached_media=' + enc(JSON.stringify(attached)) +
      '&access_token=' + enc(pageToken),
  );
  return post.id;
}

async function main() {
  if (!CK) throw new Error('Manca il secret COMPOSIO_API_KEY');
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
