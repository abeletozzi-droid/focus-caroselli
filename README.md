# Focus Adv — Autoposter caroselli (Route C)

Pubblica automaticamente **1 carosello al giorno per 100 giorni** su Instagram (@focusmediadv) e Facebook Page, via Graph API + GitHub Actions.

## Come funziona
- `manifest.json` — 100 caroselli in ordine, ognuno con data, caption e gli URL delle 8 slide.
- `img/<slug>/slide-N.jpg` — le immagini (hostate pubblicamente qui).
- `publish.mjs` — ogni giorno prende il carosello con la data odierna (fuso Europe/Rome) e lo pubblica.
- `.github/workflows/daily.yml` — cron giornaliero alle 09:00 UTC (~11:00 IT).

## Setup (una volta sola) — Secrets del repo
Vai in **Settings → Secrets and variables → Actions → New repository secret** e aggiungi:

| Secret | Valore |
|---|---|
| `GRAPH_TOKEN` | Token Page long-lived con permessi `instagram_content_publish`, `instagram_basic`, `pages_manage_posts`, `pages_read_engagement` |
| `IG_USER_ID` | `27879522138364660` (account IG business @focusmediadv) |
| `FB_PAGE_ID` | `107016051875243` (Focus Adv Page) |

### Come ottenere GRAPH_TOKEN (long-lived, ~60 giorni)
1. Vai su https://developers.facebook.com/tools/explorer/
2. Seleziona la tua app, genera un **User Token** con i permessi sopra.
3. Scambia per il **Page Token**: chiama `GET /me/accounts` e copia il `access_token` della Page Focus Adv.
4. Rendilo long-lived: `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=PAGE_TOKEN`.
5. Incolla il risultato in `GRAPH_TOKEN`.

> Il token long-lived dura ~60 giorni. A metà corsa va rigenerato (o si usa un System User token che non scade).

## Test senza pubblicare
Actions → *Focus Adv — daily carousel* → **Run workflow** → `dry_run = 1`. Stampa il giorno che pubblicherebbe.

## Pubblicare un giorno preciso
Stesso menu, campo `day = N` (1–100).
