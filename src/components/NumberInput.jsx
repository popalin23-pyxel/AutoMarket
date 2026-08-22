import React, { useState, useEffect } from 'react';

// Input numerico che consente di svuotare il campo mentre si digita
// (il classico input controllato con value={0} non lascia cancellare lo 0).
export default function NumberInput({ value, onChange, min = 0, max, style, ...rest }) {
  const [text, setText] = useState(value == null ? '' : String(value));

  // Sincronizza col valore esterno solo se è davvero diverso da quanto digitato
  useEffect(() => {
    const parsed = text === '' ? 0 : Number(text);
    if (parsed !== value) setText(value == null ? '' : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (e) => {
    const raw = e.target.value;
    // consenti campo vuoto durante la digitazione
    if (raw === '') { setText(''); onChange(0); return; }
    if (!/^\d*$/.test(raw)) return; // solo cifre
    let n = Number(raw);
    if (max != null && n > max) n = max;
    if (n < min) n = min;
    setText(String(n));
    onChange(n);
  };

  return (
    <input
      type="text" inputMode="numeric" pattern="[0-9]*"
      value={text}
      onChange={handle}
      onFocus={(e) => e.target.select()}
      style={style}
      {...rest}
    />
  );
}
