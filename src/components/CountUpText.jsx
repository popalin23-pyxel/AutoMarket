import { useCountUp } from '../lib/useCountUp.js';

// Componente "senza markup": ritorna solo il testo animato, da usare dentro qualunque <span>.
export default function CountUpText({ value, format }) {
  const animated = useCountUp(value);
  return format ? format(animated) : Math.round(animated);
}
