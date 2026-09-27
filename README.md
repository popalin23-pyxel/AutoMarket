# Turnio

Registro turni e calcolo compensi per liberi professionisti (nato per un'infermiera/o
in Partita IVA, ma adatto a chiunque lavori su più sedi con paga oraria diversa).

Accesso con email e password (Supabase Auth). Ogni utente ha i suoi dati, privati e
sincronizzati sul cloud. I nuovi account restano **in attesa di approvazione** finché
il Super Admin non li attiva dal pannello di amministrazione.

## Funzioni

- **Accesso** — registrazione/login con email e password, recupero password via email
- **Home** — statistiche della settimana (ore/netto) con confronto vs settimana scorsa,
  andamento a grafico delle ultime 8 settimane e ultimi 6 mesi, confronto mese/anno
- **Sedi** — aggiungi i posti dove lavori, ognuno con colore, paga oraria e
  (opzionale) una percentuale di rivalsa diversa da quella di default
- **Turni** — vista a lista o a calendario tradizionale (a scelta): per ogni giorno
  registri uno o più turni (sede + orario inizio/fine), colorati per sede. Weekend e
  festività italiane evidenziate automaticamente. Modificabili in qualsiasi momento —
  cambi un orario e tutto si ricalcola subito (es. previste 8h, fatte 7h → correggi e via)
- **Riepilogo** — per il mese selezionato: ore e fatturato per sede, rivalsa,
  totale fatturato, grafico a anello tasse/netto, tasse da accantonare (percentuale
  che imposti tu) e netto stimato
- **Storico** — naviga tra i mesi passati, grafico dell'andamento annuale e il
  totale dell'anno (ore, fatturato, tasse accantonate, netto)
- **Impostazioni** — cambio password, percentuale tasse, percentuale rivalsa di
  default, backup/ripristino JSON
- **⚡ Admin** (solo Super Admin) — elenco utenti registrati, approvazione e ruoli
- **Export Excel** del riepilogo mensile
- **PWA** — installabile sul telefono, funziona offline (i dati restano disponibili
  anche senza connessione, si sincronizzano quando torna la rete)

## Come si calcola

Per ogni turno: `ore = fine − inizio` (gestisce i turni notturni a cavallo di mezzanotte).

Per ogni sede nel mese: `fatturato = ore × paga oraria`, `rivalsa = fatturato × rivalsa%`,
`totale sede = fatturato + rivalsa`.

Sul totale del mese: `tasse = totale × tasse%`, `netto = totale − tasse`.

## Configurazione account (Supabase) — da fare una volta sola

L'app usa [Supabase](https://supabase.com) (gratuito) per gestire login, password e
dati di ogni utente in modo sicuro: le password non passano mai dal codice di
quest'app, sono gestite e cifrate direttamente da Supabase.

**1. Crea il progetto**
Vai su [supabase.com](https://supabase.com) → *New project* (piano gratuito).

**2. Esegui lo script SQL**
Nel progetto, apri **SQL Editor** → incolla ed esegui il contenuto di
`src/lib/cloudState.js` → costante `SETUP_SQL` (crea le tabelle `turnio_states` e
`profiles`, con tutte le regole di sicurezza).

**3. Recupera le chiavi**
In **Project Settings → API** copia **Project URL** e **anon public key**.

**4. Impostale nel deploy**
Su Vercel: **Settings → Environment Variables**, aggiungi:
```
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_ANON_KEY=<anon public key>
```
poi fai un nuovo deploy (Vercel → Deployments → Redeploy). In locale, copia
`.env.example` in `.env.local` e inserisci gli stessi valori.

**5. Conferma email (opzionale)**
Per default gli account sono attivi subito dopo la registrazione. Per richiedere la
conferma via email: **Authentication → Providers → Email → Confirm email → ON**.

**6. Diventa Super Admin**
Registrati normalmente nell'app con la tua email. Poi, in **SQL Editor**, esegui
(sostituendo con la tua email):
```sql
update profiles set role = 'admin', approved = true where email = 'tua@email.com';
```
Da qui in poi vedrai la scheda **⚡ Admin**, da cui approvare gli altri utenti (es. i
tuoi amici) man mano che si registrano.

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
Vite da solo e pubblica. **Ricordati di impostare le variabili d'ambiente Supabase**
(vedi sopra) altrimenti l'app mostra una schermata "non configurata".

## Installazione sul telefono (PWA)

- **Android (Chrome):** menu ⋮ → *Aggiungi a schermata Home*
- **iPhone (Safari):** tasto Condividi → *Aggiungi a Home*

Si apre a schermo intero come un'app e funziona anche **offline**.

## Stack

- React 18 + Vite 5 (PWA con service worker)
- Supabase (Auth + Postgres) per account e dati cloud, con Row Level Security:
  ognuno legge/scrive solo i propri dati
- SheetJS (`xlsx`) per l'export Excel
- Cache locale su `localStorage` per l'uso offline

I dati di ogni utente sono privati e legati al suo account. "Esporta backup" resta
utile come copia di sicurezza personale.
