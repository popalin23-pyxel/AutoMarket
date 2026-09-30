import { useEffect } from 'react';

// Blocca lo scroll della pagina sotto mentre una finestra (overlay) è aperta.
// Senza questo, su alcuni browser mobile lo sfondo può scorrere dietro un
// elemento "fixed", dando la sensazione che la finestra non sia centrata o
// che serva scorrere per raggiungerla.
export function useLockBodyScroll() {
  useEffect(() => {
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = overflow; };
  }, []);
}
