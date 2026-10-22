import { useEffect, useState } from 'react';

// Ora corrente, aggiornata ogni minuto e quando l'app torna in primo piano: le app restano
// aperte in memoria anche per giorni, e ciò che dipende dall'ora (turni finiti, mese
// corrente) deve aggiornarsi da solo.
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [intervalMs]);
  return now;
}
