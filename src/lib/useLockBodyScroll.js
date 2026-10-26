import { useEffect } from 'react';

// Blocca lo scroll della pagina sotto mentre una finestra (overlay) è aperta.
// Senza questo, su alcuni browser mobile lo sfondo può scorrere dietro un
// elemento "fixed", dando la sensazione che la finestra non sia centrata o
// che serva scorrere per raggiungerla.
// Le finestre possono essere annidate (es. "+ Aggiungi" → Prestazione): si conta quante sono
// aperte e lo scroll torna solo quando si chiude l'ultima, in qualunque ordine si chiudano.
let locks = 0;
let saved = '';

export function useLockBodyScroll() {
  useEffect(() => {
    const root = document.documentElement;
    if (locks === 0) { saved = root.style.overflow; root.style.overflow = 'hidden'; }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) root.style.overflow = saved;
    };
  }, []);
}
