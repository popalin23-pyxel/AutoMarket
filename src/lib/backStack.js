// Tasto / gesto "Indietro" (Android, browser): chiude la finestra aperta o torna alla Home
// invece di uscire dall'app. Ogni finestra o schermata che si chiude con Indietro aggiunge
// una voce alla cronologia del browser; Indietro chiude la più recente.
import { useEffect, useRef } from 'react';

const stack = [];       // voci aperte, l'ultima è quella in cima
let skipPops = 0;       // "indietro" fatti da noi (finestra chiusa con ✕ o Salva): da ignorare
const waiting = [];     // voci da aggiungere appena quei "indietro" sono stati completati

let pendingBack = 0;    // voci da togliere insieme (es. due finestre chiuse nello stesso momento)

const runWaiting = () => { while (skipPops === 0 && waiting.length) waiting.shift()(); };

// Toglie dalla cronologia le voci chiuse dalla UI, tutte con un solo passo indietro.
function scheduleBack() {
  if (pendingBack === 0) {
    skipPops += 1;
    queueMicrotask(() => { const n = pendingBack; pendingBack = 0; window.history.go(-n); });
  }
  pendingBack += 1;
}

// voci rimaste "orfane" in cima (finestra già chiusa): tolte insieme alle altre
function dropStaleTop() {
  while (stack.length && stack[stack.length - 1].stale) { stack.pop(); scheduleBack(); }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skipPops > 0) { skipPops -= 1; runWaiting(); return; }
    const top = stack.pop();
    if (top && !top.stale) { top.popped = true; top.onBack(); }
    dropStaleTop();
  });
}

// Aggiunge una voce: `onBack` viene chiamata se l'utente preme Indietro.
// Ritorna la funzione da chiamare quando la finestra si chiude in altro modo.
export function pushBackEntry(onBack) {
  const entry = { onBack, pushed: false, popped: false, stale: false };
  stack.push(entry);
  const push = () => {
    if (entry.popped || !stack.includes(entry)) return;
    window.history.pushState({ turnio: true }, '');
    entry.pushed = true;
  };
  if (skipPops > 0) waiting.push(push); else push();
  return () => {
    const i = stack.indexOf(entry);
    if (i === -1) return; // già chiusa con Indietro
    if (!entry.pushed) { stack.splice(i, 1); return; }
    if (i === stack.length - 1) {
      stack.pop();
      scheduleBack(); // toglie la sua voce dalla cronologia
      dropStaleTop();
    } else {
      entry.stale = true; // non in cima (caso raro): la sua voce si toglie quando arriva in cima
    }
  };
}

// Finché `active` è vero, Indietro chiama `onClose` invece di uscire dall'app.
export function useBackClose(onClose, active = true) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!active) return undefined;
    return pushBackEntry(() => ref.current?.());
  }, [active]);
}
