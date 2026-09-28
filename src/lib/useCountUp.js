import { useEffect, useRef, useState } from 'react';

// Anima un numero dal valore precedente a quello nuovo (usato per i valori in €/ore).
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const raf = useRef(null);

  useEffect(() => {
    const from = prevTarget.current;
    const to = Number.isFinite(target) ? target : 0;
    prevTarget.current = to;
    if (from === to) { setValue(to); return; }

    const start = performance.now();
    cancelAnimationFrame(raf.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic
      setValue(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setValue(to);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return value;
}
