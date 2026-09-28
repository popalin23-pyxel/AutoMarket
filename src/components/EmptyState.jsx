import React from 'react';
import Icon from './icons/Icon.jsx';

function EmptyIllustration({ icon }) {
  return (
    <div className="empty-illustration">
      <svg width="84" height="84" viewBox="0 0 84 84" className="ei-bg">
        <circle cx="42" cy="44" r="30" className="ei-blob-1" />
        <circle cx="66" cy="20" r="8" className="ei-blob-2" />
        <circle cx="15" cy="63" r="5.5" className="ei-blob-3" />
      </svg>
      <span className="ei-icon"><Icon name={icon} size={28} strokeWidth={1.6} /></span>
    </div>
  );
}

export default function EmptyState({ icon = 'clipboard', title, hint }) {
  return (
    <div className="empty-state">
      <EmptyIllustration icon={icon} />
      {title && <div className="empty-state-title">{title}</div>}
      {hint && <div className="empty-state-hint">{hint}</div>}
    </div>
  );
}
