// Salvataggio dei file generati dall'app (backup, PDF, Excel).
//
// Su iPhone/iPad si usa il foglio di condivisione (Salva su File, Mail, WhatsApp, AirDrop…):
// nell'app installata sulla schermata Home il download classico non ha una barra dei download
// e spesso non succede nulla, oppure il file si apre a tutto schermo senza modo di tornare
// indietro. Altrove (Android, computer) il file viene scaricato.
// Ritorna true se il file è stato salvato o condiviso, false se l'utente ha annullato.

const isIOS = () => typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export async function saveFile(blob, filename) {
  if (isIOS() && typeof File === 'function' && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (e) {
        if (e?.name === 'AbortError') return false; // condivisione chiusa dall'utente
        // altri errori (es. permesso negato): si prova con il download
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari completa il download in modo asincrono: revocare subito l'URL lo fa fallire
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
