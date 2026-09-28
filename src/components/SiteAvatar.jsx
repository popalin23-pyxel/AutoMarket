import React from 'react';

export default function SiteAvatar({ site, size = 20 }) {
  const initial = (site?.name || '?').trim()[0]?.toUpperCase() || '?';
  return (
    <span
      className="site-avatar"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.5)), background: site?.color || '#6b7280' }}
    >
      {initial}
    </span>
  );
}
