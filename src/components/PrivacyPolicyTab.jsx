import React from 'react';
import { PRIVACY_OWNER, PRIVACY_EMAIL, PRIVACY_DATA_REGION } from '../lib/legal.js';

// segnaposto ben visibile finché il dato non è compilato in lib/legal.js
const Fill = ({ value, label }) => (value ? <>{value}</> : <span className="privacy-placeholder">[{label} — da completare]</span>);

export default function PrivacyPolicyTab({ onBack }) {
  return (
    <div className="panel privacy-page">
      {onBack && <button className="btn btn-sm" style={{ marginBottom: 12 }} onClick={onBack}>‹ Indietro</button>}
      <h2 className="panel-title">Privacy Policy di Turnio</h2>
      <p className="panel-desc">Ultimo aggiornamento: 22 ottobre 2026</p>

      <div className="privacy-body">
        <h3>1. Titolare del trattamento</h3>
        <p>
          <Fill value={PRIVACY_OWNER} label="Nome e cognome / ragione sociale" />, contattabile all'indirizzo
          email <Fill value={PRIVACY_EMAIL} label="email di contatto" />.
        </p>

        <h3>2. Che dati raccoglie Turnio</h3>
        <p>Per far funzionare l'app raccogliamo e conserviamo:</p>
        <ul>
          <li><b>Dati account</b>: email, password (mai salvata in chiaro: viene cifrata dal nostro fornitore di autenticazione), data di creazione dell'account.</li>
          <li><b>Anagrafica</b> (facoltativa): nome e cognome, ruolo professionale, Partita IVA o numero di iscrizione all'albo — solo se scegli di inserirli in Altro → I miei dati.</li>
          <li><b>Sedi di lavoro</b>: nomi delle strutture/datori di lavoro inseriti e la relativa paga oraria.</li>
          <li><b>Turni</b>: data, orario, sede, note personali, eventuale tariffa speciale e se il turno è stato svolto o annullato.</li>
          <li><b>Schede delle strutture</b> (facoltative): ragione sociale e Partita IVA della struttura, nome, telefono ed email del referente, indirizzo, date del contratto e note che decidi di inserire.</li>
          <li><b>Ferie e assenze</b> (facoltative): i giorni che segni come ferie, malattia, corso o non disponibile, con eventuali note. Segnare la malattia è un dato relativo alla salute: è del tutto facoltativo (puoi usare "Non disponibile") e resta visibile solo a te.</li>
          <li><b>Prestazioni occasionali</b>: data, descrizione, importo e note inserite per ciascuna prestazione.</li>
          <li><b>Spese</b>: importi, categorie, date e note inserite nella sezione Spese.</li>
          <li><b>Impostazioni fiscali</b>: regime, cassa previdenziale, modalità di calcolo, aliquote, contributi, rivalsa o contributo integrativo e obiettivo di guadagno mensile impostati.</li>
          <li><b>Dati tecnici minimi</b> raccolti automaticamente dai fornitori di infrastruttura (Supabase, Vercel) per far funzionare il servizio: indirizzo IP e log di accesso ai server.</li>
        </ul>
        <p>
          Alcune preferenze (tema chiaro/scuro, colore, densità, vista preferita) restano <b>solo sul tuo dispositivo</b>
          (memoria locale del browser) e non vengono mai inviate ai nostri server.
        </p>

        <h3>3. Perché li raccogliamo</h3>
        <p>
          Esclusivamente per fornirti il servizio che hai richiesto: farti accedere in modo sicuro, calcolare le
          stime di fatturato/tasse/netto che ci chiedi di calcolare, sincronizzare i tuoi dati tra i tuoi dispositivi,
          e — se il tuo account è soggetto ad approvazione manuale — permettere all'amministratore di attivarlo.
          Non usiamo i tuoi dati per pubblicità e non li vendiamo a terzi.
        </p>

        <h3>4. Con chi condividiamo i dati</h3>
        <p>
          I tuoi dati sono conservati dai fornitori tecnici che rendono possibile Turnio, che agiscono come
          responsabili del trattamento per nostro conto:
        </p>
        <ul>
          <li><b>Supabase</b> (database e autenticazione) — dati conservati in: <Fill value={PRIVACY_DATA_REGION} label="regione del progetto" />.</li>
          <li><b>Vercel</b> (hosting dell'applicazione web).</li>
        </ul>
        <p>Nessun altro fornitore terzo riceve i tuoi dati: l'app non usa servizi di analytics o pubblicità.</p>

        <h3>5. Per quanto tempo conserviamo i dati</h3>
        <p>
          Finché il tuo account resta attivo. Se cancelli il tuo account da Altro → Account, i tuoi dati
          (turni, prestazioni, sedi, spese, ferie e assenze, anagrafica, impostazioni) vengono <b>eliminati definitivamente e immediatamente</b> dai nostri
          server, senza bisogno di richiederlo a nessuno.
        </p>

        <h3>6. I tuoi diritti</h3>
        <ul>
          <li><b>Accesso ed esportazione</b>: puoi scaricare in ogni momento una copia completa dei tuoi dati in formato JSON da Altro → Copia di sicurezza.</li>
          <li><b>Cancellazione</b>: puoi eliminare definitivamente il tuo account e tutti i tuoi dati da Altro → Account, senza contattare nessuno.</li>
          <li><b>Rettifica</b>: puoi modificare o correggere in ogni momento i tuoi dati direttamente nell'app.</li>
          <li><b>Reclamo</b>: hai sempre diritto a presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</li>
        </ul>
        <p>Per qualunque altra richiesta relativa ai tuoi dati, scrivi a <Fill value={PRIVACY_EMAIL} label="email di contatto" />.</p>

        <h3>7. Sicurezza</h3>
        <p>
          I dati viaggiano sempre via connessione cifrata (HTTPS). Ogni utente può vedere e modificare solo i propri
          dati: è tecnicamente impedito, a livello di database, anche a un amministratore di Turnio leggere i turni,
          le sedi o le spese di un altro utente.
        </p>

        <h3>8. Minori</h3>
        <p>Turnio non è pensato per l'uso da parte di minori di 16 anni.</p>

        <h3>9. Modifiche a questa policy</h3>
        <p>
          Se cambia qualcosa in come trattiamo i tuoi dati, aggiorneremo questa pagina e la data in cima.
          In caso di modifiche rilevanti, te lo segnaleremo in modo evidente nell'app.
        </p>
      </div>
    </div>
  );
}
