import React from 'react';

export default function WarningBanner() {
  return (
    <div className="warning-banner">
      <span className="warning-icon">⚠️</span>
      <span className="warning-text">
        Statistiche storiche e indicatori.{' '}
        <strong>NON prevede il futuro. NON è consulenza finanziaria.</strong>{' '}
        I futures con leva sono ad altissimo rischio.
      </span>
    </div>
  );
}
