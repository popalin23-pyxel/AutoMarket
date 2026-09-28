import { useRef } from 'react';

// Rileva uno swipe orizzontale su un elemento touch (es. per cambiare mese).
export function useSwipe(onSwipeLeft, onSwipeRight, threshold = 50) {
  const start = useRef(null);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e) => {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onSwipeLeft?.(); else onSwipeRight?.();
    }
  };

  return { onTouchStart, onTouchEnd };
}
