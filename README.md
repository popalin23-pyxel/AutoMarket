# Turnio

Registro turni e calcolo compensi per liberi professionisti (nato per un'infermiera/o
in Partita IVA, ma adatto a chiunque lavori su più sedi con paga oraria diversa).

Gira nel browser/telefono, i dati restano in locale (`localStorage`), nessun server.

## Funzioni

- **Sedi** — aggiungi i posti dove lavori, ognuno con colore, paga oraria e
  (opzionale) una percentuale di rivalsa diversa da quella di default
- **Turni** — calendario mensile: per ogni giorno registri uno o più turni
  (sede + orario inizio/fine). Modificabili in qualsiasi momento — cambi un
  orario e tutto si ricalcola subito (es. previste 8h, fatte 7h → correggi e via)
- **Riepilogo** — per il mese selezionato: ore e fatturato per sede, rivalsa,
  totale fatturato, tasse da accantonare (percentuale che imposti tu) e netto stimato
- **Storico** — naviga tra i mesi passati e vedi il totale dell'anno (ore,
  fatturato, tasse accantonate, netto)
- **Impostazioni** — percentuale tasse, percentuale rivalsa di default, backup/ripristino JSON
- **Export Excel** del riepilogo mensile
- **PWA** — installabile sul telefono, funziona offline

## Come si calcola

Per ogni turno: `ore = fine − inizio` (gestisce i turni notturni a cavallo di mezzanotte).

Per ogni sede nel mese: `fatturato = ore × paga oraria`, `rivalsa = fatturato × rivalsa%`,
`totale sede = fatturato + rivalsa`.

Sul totale del mese: `tasse = totale × tasse%`, `netto = totale − tasse`.

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build di produzione in dist/
npm run preview  # anteprima della build
```

## Pubblicazione (Vercel)

Il repository include `vercel.json` già configurato per Vite (zero configurazione).
Basta importare il repository su [vercel.com](https://vercel.com) — Vercel rileva
Vite da solo e pubblica.

## Installazione sul telefono (PWA)

- **Android (Chrome):** menu ⋮ → *Aggiungi a schermata Home*
- **iPhone (Safari):** tasto Condividi → *Aggiungi a Home*

Si apre a schermo intero come un'app e funziona anche **offline**.

## Stack

- React 18 + Vite 5 (PWA con service worker)
- SheetJS (`xlsx`) per l'export Excel
- Persistenza locale su `localStorage` — nessun backend

I dati sono salvati **solo nel browser corrente**. Usa "Esporta backup" per
spostarli su un altro dispositivo o per tenerne una copia di sicurezza.
