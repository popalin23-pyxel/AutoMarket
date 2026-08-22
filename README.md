# Turnify Web

Generatore automatico di turni per il personale — versione **webapp** del desktop Turnify 3.3.

Ricrea in React tutte le funzioni dell'app PyQt6 originale, senza installazione:
gira nel browser, i dati restano in locale (`localStorage`), nessun server.

## Funzioni

- **Personale** — anagrafica con ruolo, **ore contrattuali** (part-time/full-time) e **turno preferito**
- **Turni** — codici turno configurabili (ore, lavorativo, notturno)
- **Regole** — vincoli di generazione, **copertura richiesta** per turno (feriale/weekend) e ruolo → turni ammessi
- **Indisponibilità** — ferie, malattie, permessi (riposo forzato nei giorni indicati)
- **Genera & Export**
  - planning mensile a griglia colorata + statistiche, **festività italiane** evidenziate
  - **avvisi di sotto-copertura** in tempo reale
  - **modifica manuale** di ogni cella (tap/clic per cambiare turno)
  - **storico planning** (salva, riapri, riesporta)
  - export **Excel** (3 fogli), **Stampa/PDF**, **calendario .ics** per persona, condivisione **WhatsApp/Email**
- **Dati** — backup/ripristino JSON e **sincronizzazione cloud opzionale** (Supabase)
- **Lingua** — interfaccia IT / EN
- **PWA** — installabile su telefono, funziona offline

## Logica di generazione

Scheduler *coverage-aware*: assegna i turni giorno per giorno per coprire il fabbisogno
richiesto, bilanciando **ore, notti e weekend** tra il personale.

- copertura per turno distinta tra feriali e weekend/festivi (festività italiane incluse)
- dopo una **Notte** → **Smonto** + **Riposo**
- rispetto di max notti/mese e max giorni consecutivi
- ore contrattuali e turno preferito come pesi nell'assegnazione
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

## Sincronizzazione tra dispositivi

- **Backup/Ripristino** (tab Dati): esporta un file `.json` e reimportalo su un altro dispositivo.
- **Cloud (opzionale)**: con un progetto **Supabase** gratuito i dati si sincronizzano tra
  telefono e PC tramite un *codice team*. Istruzioni e script SQL nel tab **Dati**.

## Stack

- React 18 + Vite 5 (PWA con service worker)
- SheetJS (`xlsx`) per l'export Excel
- Persistenza locale su `localStorage`; sync cloud opzionale via Supabase (REST)

Senza configurazione cloud i dati restano **solo nel browser corrente**.
