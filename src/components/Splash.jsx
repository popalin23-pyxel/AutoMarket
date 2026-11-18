import React from 'react';
import BrandLogo from './BrandLogo.jsx';

export default function Splash() {
  return (
    <div className="auth-wrap">
      <div className="splash">
        <span className="splash-logo"><BrandLogo height={52} /></span>
        <div className="splash-ring" />
      </div>
    </div>
  );
}
