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

## Stack

- React 18 + Vite 5
- SheetJS (`xlsx`) per l'export
- Nessun backend — persistenza su `localStorage`

I dati sono salvati **solo nel browser corrente**. Svuotando i dati del sito si azzera tutto.
