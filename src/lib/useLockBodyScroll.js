import { useEffect } from 'react';

// Blocca lo scroll della pagina sotto mentre una finestra (overlay) è aperta.
// Senza questo, su alcuni browser mobile lo sfondo può scorrere dietro un
// elemento "fixed", dando la sensazione che la finestra non sia centrata o
// che serva scorrere per raggiungerla.
// Le finestre possono essere annidate (es. "+ Aggiungi" → Prestazione): si conta quante sono
// aperte e lo scroll torna solo quando si chiude l'ultima, in qualunque ordine si chiudano.
let locks = 0;
let saved = '';
let fixedAt = null; // iPhone con iOS 15: posizione della pagina "fermata" (vedi sotto)

// Safari prima della 16 ignora overflow:hidden sulla pagina per lo scorrimento col dito:
// lì si ferma la pagina con position:fixed e si rimette al suo posto alla chiusura.
const oldIOS = () => {
  try { return /iP(hone|ad|od)/.test(navigator.userAgent) && !CSS.supports('overflow-x', 'clip'); } catch { return false; }
};

export function useLockBodyScroll() {
  useEffect(() => {
    const root = document.documentElement;
    if (locks === 0) {
      saved = root.style.overflow;
      root.style.overflow = 'hidden';
      if (oldIOS()) {
        fixedAt = window.scrollY;
        Object.assign(document.body.style, { position: 'fixed', top: `-${fixedAt}px`, left: '0', right: '0' });
      }
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks > 0) return;
      root.style.overflow = saved;
      if (fixedAt != null) {
        Object.assign(document.body.style, { position: '', top: '', left: '', right: '' });
        window.scrollTo(0, fixedAt);
        fixedAt = null;
      }
    };
  }, []);
}
