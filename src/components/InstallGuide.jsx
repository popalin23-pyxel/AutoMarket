import React, { useEffect, useState } from 'react';
import { canPromptInstall, onInstallPromptChange, promptInstall, devicePlatform, isStandalone } from '../lib/install.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';

export function useCanPromptInstall() {
  const [can, setCan] = useState(canPromptInstall);
  useEffect(() => onInstallPromptChange(() => setCan(canPromptInstall())), []);
  return can;
}

const STEPS = {
  ios: [
    'Apri Turnio con Safari (o Chrome) sull\'iPhone.',
    'Tocca il pulsante Condividi: il quadrato con la freccia verso l\'alto (in basso al centro, o in alto a destra).',
    'Scorri e tocca "Aggiungi alla schermata Home" (se non lo vedi, tocca "Modifica azioni" in fondo).',
    'Tocca "Aggiungi": l\'icona di Turnio compare tra le tue app. Da quel momento aprila sempre da lì.',
  ],
  android: [
    'Apri Turnio con Chrome sul telefono.',
    'Tocca il menu ⋮ in alto a destra.',
    'Tocca "Installa app" (oppure "Aggiungi a schermata Home") e conferma.',
    'L\'icona di Turnio compare tra le tue app: da quel momento aprila sempre da lì.',
  ],
  desktop: [
    'Con Chrome o Edge: nella barra dell\'indirizzo tocca l\'icona di installazione (un monitor con la freccia) e conferma.',
    'Sul telefono è ancora più comodo: apri Turnio dal browser del telefono e segui la guida per iPhone o Android.',
  ],
};

// Guida passo passo per aggiungere Turnio alla schermata Home.
export default function InstallGuide({ onClose }) {
  const [platform, setPlatform] = useState(() => { const p = devicePlatform(); return p === 'desktop' ? 'ios' : p; });
  const canPrompt = useCanPromptInstall();
  const installed = isStandalone();
  useLockBodyScroll();
  useBackClose(onClose);

  return (
    <Portal>
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <span>Installa Turnio sul telefono</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {installed ? (
          <p className="hint hint-info">Turnio è già installata su questo dispositivo. 👍</p>
        ) : (
          <>
            <p className="panel-desc">
              Installata, Turnio si apre come un'app vera: a schermo intero, più veloce e utilizzabile anche senza rete.
              Non serve nessuno store e non occupa quasi spazio.
            </p>
            {canPrompt && (
              <button className="btn btn-primary btn-block" style={{ marginBottom: 12 }}
                onClick={async () => { if (await promptInstall()) onClose(); }}>
                📲 Installa ora
              </button>
            )}
            <div className="theme-switch" style={{ marginBottom: 10 }}>
              <button className={`theme-opt ${platform === 'ios' ? 'active' : ''}`} onClick={() => setPlatform('ios')}>iPhone</button>
              <button className={`theme-opt ${platform === 'android' ? 'active' : ''}`} onClick={() => setPlatform('android')}>Android</button>
              <button className={`theme-opt ${platform === 'desktop' ? 'active' : ''}`} onClick={() => setPlatform('desktop')}>Computer</button>
            </div>
            <ol className="install-steps">
              {STEPS[platform].map((t) => <li key={t}>{t}</li>)}
            </ol>
            <p className="panel-desc" style={{ marginBottom: 0 }}>
              I tuoi dati restano gli stessi: accedi con la stessa email e trovi tutto.
            </p>
          </>
        )}
      </div>
    </div>
    </Portal>
  );
}
