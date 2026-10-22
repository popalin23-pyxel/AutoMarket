import React, { useState, useEffect } from 'react';

// "23,5" / "23.5" → 23.5. Accetta la virgola: sulla tastiera numerica dell'iPhone in
// italiano (e su varie tastiere Android) c'è solo quella, il punto non esiste.
const parse = (text) => Number(text.replace(',', '.'));
const show = (value) => (value == null ? '' : String(value).replace('.', ','));

// Input numerico (con decimali) che si può svuotare mentre si digita.
// value={0} con un <input type=number> normale non lascia cancellare lo 0.
export default function NumberInput({ value, onChange, min = 0, max, allowEmpty = false, style, ...rest }) {
  const [text, setText] = useState(show(value));

  useEffect(() => {
    const parsed = text === '' ? (allowEmpty ? null : 0) : parse(text);
    if (parsed !== value) setText(show(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (e) => {
    const raw = e.target.value.replace(/\s/g, '');
    if (raw === '') { setText(''); onChange(allowEmpty ? null : 0); return; }
    if (!/^\d*[.,]?\d*$/.test(raw)) return; // cifre e un solo separatore decimale
    if (raw === '.' || raw === ',') { setText('0,'); return; }
    let n = parse(raw);
    if (Number.isNaN(n)) return;
    let clamped = false;
    if (max != null && n > max) { n = max; clamped = true; }
    if (n < min) { n = min; clamped = true; }
    // si lascia il testo come digitato ("23,0" mentre si scrive 23,05), salvo correzioni
    setText(clamped ? show(n) : raw);
    onChange(n);
  };

  return (
    <input
      type="text" inputMode="decimal"
      value={text}
      onChange={handle}
      onFocus={(e) => e.target.select()}
      style={style}
      {...rest}
    />
  );
}
