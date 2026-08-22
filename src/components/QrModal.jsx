import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

// Mostra un QR con il testo passato (es. i turni compatti di una persona).
export default function QrModal({ text, title, onClose }) {
  const [url, setUrl] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [text]);

  return (
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
        <div className="editor-head" style={{ justifyContent: 'space-between' }}>
          <b>{title}</b>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {err ? (
          <p style={{ color: 'var(--red)' }}>Testo troppo lungo per il QR.</p>
        ) : url ? (
          <img src={url} alt="QR" style={{ width: 260, height: 260, borderRadius: 8, background: '#fff', padding: 8 }} />
        ) : (
          <p style={{ color: 'var(--text-dim)' }}>…</p>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-mut)', marginTop: 10, wordBreak: 'break-word' }}>{text}</p>
      </div>
    </div>
  );
}
