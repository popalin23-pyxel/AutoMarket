import React from 'react';
import Icon from './icons/Icon.jsx';

export default function EmptyState({ icon = 'clipboard', title, hint }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon name={icon} size={26} strokeWidth={1.5} /></span>
      {title && <div className="empty-state-title">{title}</div>}
      {hint && <div className="empty-state-hint">{hint}</div>}
    </div>
  );
}
