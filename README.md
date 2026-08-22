# Turnify Web

Generatore automatico di turni per il personale — versione **webapp** del desktop Turnify 3.3.

Ricrea in React tutte le funzioni dell'app PyQt6 originale, senza installazione:
gira nel browser, i dati restano in locale (`localStorage`), nessun server.

## Funzioni

- **Personale** — anagrafica con ruolo (OSS, Infermiere, Coordinatore, …)
- **Turni** — codici turno configurabili (ore, lavorativo, notturno)
- **Regole** — vincoli di generazione + mappatura ruolo → turni ammessi
  - max notti/mese, max giorni consecutivi, alternanza Mattina/Pomeriggio
- **Indisponibilità** — ferie, malattie, permessi (riposo forzato nei giorni indicati)
- **Genera & Export** — planning mensile a griglia colorata + statistiche
  - Export Excel a 3 fogli (planning, Legenda, Riepilogo) tramite SheetJS

## Logica di generazione

Porting fedele di `generate_schedule()` dal desktop, con le regole **realmente applicate**
(nell'originale erano fisse nel codice):

- dopo una **Notte** → **Smonto** + **Riposo**
- rispetto del numero massimo di notti al mese e di giorni consecutivi
- alternanza Mattina/Pomeriggio configurabile
- turni consentiti in base al ruolo

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173/AutoMarket/
npm run build    # build di produzione in dist/
npm run preview  # anteprima della build
```

## Pubblicazione (GitHub Pages)

Il deploy è automatico tramite GitHub Actions (`.github/workflows/deploy.yml`):
a ogni push il sito viene ricostruito e pubblicato.

**Attivazione (una volta sola):**
1. Su GitHub apri il repository → **Settings** → **Pages**
2. In **Build and deployment → Source** scegli **GitHub Actions**
3. Attendi che l'azione "Deploy su GitHub Pages" finisca (scheda **Actions**)
4. Il sito sarà su: `https://popalin23-pyxel.github.io/AutoMarket/`

> Nota: GitHub Pages su repository **privati** richiede un piano a pagamento.
> Se il repo è privato e resta gratuito, usa in alternativa Vercel/Netlify.

## Installazione sul telefono (PWA)

Aperta la pagina dal browser del telefono:
- **Android (Chrome):** menu ⋮ → *Aggiungi a schermata Home*
- **iPhone (Safari):** tasto Condividi → *Aggiungi a Home*

Si aprirà a schermo intero come un'app e funziona anche **offline**.

## Stack

- React 18 + Vite 5
- SheetJS (`xlsx`) per l'export
- Nessun backend — persistenza su `localStorage`

I dati sono salvati **solo nel browser corrente**. Svuotando i dati del sito si azzera tutto.
