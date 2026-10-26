// PDF, Excel e foglio ore si caricano a parte (file "a pezzi"). Dopo un aggiornamento dell'app
// il service worker cancella i pezzi vecchi, ma la pagina già aperta continua a chiedere quelli:
// il caricamento fallisce. In quel caso si ricarica la pagina una volta, per prendere la versione nuova.
const KEY = 'turnio_chunk_reload';

export function reloadOnce() {
  try {
    if (sessionStorage.getItem(KEY)) return false; // già ricaricato: non entrare in un ciclo
    sessionStorage.setItem(KEY, '1');
  } catch { return false; }
  window.location.reload();
  return true;
}

export function loadChunk(importer) {
  return importer().catch((err) => {
    if (reloadOnce()) return new Promise(() => {}); // la pagina si sta ricaricando
    throw err;
  });
}

// a caricamento riuscito il permesso di ricaricare torna disponibile per il prossimo aggiornamento
export function chunkLoadOk() {
  try { sessionStorage.removeItem(KEY); } catch {}
}
