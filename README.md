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
npm run dev      # http://localhost:5173
npm run build    # build di produzione in dist/
npm run preview  # anteprima della build
```

## Pubblicazione (Vercel)

Il repository include `vercel.json` già configurato per Vite (zero configurazione).

**Passi (una volta sola):**
1. Vai su [vercel.com](https://vercel.com) e accedi con GitHub
2. **Add New… → Project** e importa il repository `AutoMarket`
3. Vercel rileva Vite in automatico → **Deploy**
4. Ottieni un link tipo `https://automarket-xxxx.vercel.app`

> Se il codice non è sul branch `main`: nelle impostazioni del progetto Vercel
> (**Settings → Git → Production Branch**) imposta il branch corretto, oppure
> unisci il branch in `main`. Ogni push crea comunque un deploy di anteprima.

> Repository **privati**: Vercel funziona anche gratis con repo privati.

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
