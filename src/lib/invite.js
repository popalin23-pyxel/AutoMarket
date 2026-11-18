// "Invita un amico": il messaggio con il link dell'app e i modi per mandarlo.

// Il link è l'indirizzo da cui è aperta l'app: se un giorno cambia dominio, segue da solo.
export function appUrl(loc = typeof window !== 'undefined' ? window.location : null) {
  return loc?.origin ? `${loc.origin}/` : '';
}

export function inviteMessage(url) {
  return 'Ciao! Ti consiglio Horarya, l’app che uso per i turni in libera professione: segni dove e quando lavori '
    + 'e ti calcola da sola quanto hai fatturato, quanto mettere da parte per tasse e cassa e quanto ti resta. '
    + `Si usa dal telefono come un’app.\n\nProvala da qui: ${url}`;
}

// Link per mandare il messaggio direttamente con un'app.
export function shareLinks(message, url) {
  const m = encodeURIComponent(message);
  // Telegram mette il link per conto suo: nel testo va il messaggio senza il link
  const withoutUrl = message.replace(url, '').replace(/\s*Provala da qui:\s*$/, '').trim();
  return {
    whatsapp: `https://wa.me/?text=${m}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(withoutUrl)}`,
    email: `mailto:?subject=${encodeURIComponent('Ti consiglio Horarya')}&body=${m}`,
    // "sms:?&body=" funziona sia su iPhone sia su Android
    sms: `sms:?&body=${m}`,
  };
}

// Copia negli appunti, anche dove navigator.clipboard non c'è (vecchi browser, pagine non sicure).
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* si prova sotto */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
