import React from 'react';
import Icon from '../icons/Icon.jsx';

// Sotto-pagina con il grande "‹ Indietro" in cima (Altro → Sedi, Soldi → Spese, …).
export default function SubPage({ title, onBack, children }) {
  return (
    <>
      <div className="subpage-head">
        <button type="button" className="back-btn" onClick={onBack}>
          <Icon name="chevronLeft" size={20} strokeWidth={2.2} /> Indietro
        </button>
        {title && <h1 className="page-title">{title}</h1>}
      </div>
      {children}
    </>
  );
}
