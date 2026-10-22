import React, { useState } from 'react';
import { isStandalone, devicePlatform, installCardDismissed, dismissInstallCard, promptInstall } from '../lib/install.js';
import InstallGuide, { useCanPromptInstall } from './InstallGuide.jsx';

// In Home, solo sul telefono e solo se Turnio è aperta dal browser e non installata.
export default function InstallCard() {
  const [hidden, setHidden] = useState(() => isStandalone() || devicePlatform() === 'desktop' || installCardDismissed());
  const [guide, setGuide] = useState(false);
  const canPrompt = useCanPromptInstall();
  if (hidden) return null;

  const dismiss = () => { dismissInstallCard(); setHidden(true); };
  return (
    <div className="panel install-card">
      <div className="install-card-title">📲 Installa Turnio sul telefono</div>
      <p className="install-card-text">Si apre come un'app, a schermo intero, e funziona anche senza rete. Ci vuole un minuto.</p>
      <div className="install-card-actions">
        {canPrompt
          ? <button className="btn btn-primary btn-sm" onClick={async () => { if (await promptInstall()) setHidden(true); }}>Installa</button>
          : <button className="btn btn-primary btn-sm" onClick={() => setGuide(true)}>Come si fa</button>}
        <button className="btn btn-sm" onClick={dismiss}>Non ora</button>
      </div>
      {guide && <InstallGuide onClose={() => setGuide(false)} />}
    </div>
  );
}
