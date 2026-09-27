import React, { useState, useEffect } from 'react';

// Input numerico (con decimali) che si può svuotare mentre si digita.
// value={0} con un <input type=number> normale non lascia cancellare lo 0.
export default function NumberInput({ value, onChange, min = 0, max, allowEmpty = false, style, ...rest }) {
  const [text, setText] = useState(value == null ? '' : String(value));

  useEffect(() => {
    const parsed = text === '' ? (allowEmpty ? null : 0) : Number(text);
    if (parsed !== value) setText(value == null ? '' : String(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (e) => {
    const raw = e.target.value;
    if (raw === '') { setText(''); onChange(allowEmpty ? null : 0); return; }
    if (!/^\d*\.?\d*$/.test(raw)) return; // cifre e un solo punto decimale
    if (raw === '.') { setText('0.'); return; }
    let n = Number(raw);
    if (Number.isNaN(n)) return;
    if (max != null && n > max) n = max;
    if (n < min) n = min;
    setText(raw.endsWith('.') ? raw : String(n));
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
