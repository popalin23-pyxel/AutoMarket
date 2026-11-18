import React, { useEffect, useState } from 'react';
import {
  canPromptInstall, onInstallPromptChange, promptInstall, isStandalone, browserInfo,
  autoInstallSheetDue, markAutoInstallSheetShown, installSheetLater,
} from '../lib/install.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import Icon from './icons/Icon.jsx';

export function useCanPromptInstall() {
  const [can, setCan] = useState(canPromptInstall);
  useEffect(() => onInstallPromptChange(() => setCan(canPromptInstall())), []);
  return can;
}

const Step = ({ n, icon, children }) => (
  <li className="inst-step">
    <span className="inst-n">{n}</span>
    <span className="inst-tx">{children}</span>
    {icon && <span className="inst-ic"><Icon name={icon} size={20} strokeWidth={2} /></span>}
  </li>
);

// I passi per ogni telefono. Su iPhone Apple non permette di installare con un tasto:
// si fa da Condividi → "Aggiungi alla schermata Home".
function Steps({ platform, info }) {
  if (info.inApp) {
    return (
      <>
        <p className="inst-warn">Hai aperto il link dentro un’app (WhatsApp, Instagram…): da qui non si può installare. Aprilo prima nel browser.</p>
        <ol className="inst-steps">
          {platform === 'ios' ? (
            <>
              <Step n="1" icon="compass">Tocca <b>•••</b> o l’icona della <b>bussola</b> e scegli <b>“Apri in Safari”</b>.</Step>
              <Step n="2" icon="iosShare">In Safari segui i passi per installare: Condividi → <b>“Aggiungi alla schermata Home”</b>.</Step>
            </>
          ) : (
            <>
              <Step n="1" icon="dotsV">Tocca <b>⋮</b> in alto a destra e scegli <b>“Apri in Chrome”</b> (o “Apri nel browser”).</Step>
              <Step n="2" icon="plusSquare">In Chrome tocca di nuovo <b>⋮</b> → <b>“Installa app”</b>.</Step>
            </>
          )}
        </ol>
      </>
    );
  }
  if (platform === 'ios') {
    return (
      <ol className="inst-steps">
        <Step n="1" icon="iosShare">Tocca <b>Condividi</b>, il quadrato con la freccia in su{info.browser === 'chrome' ? ' (in Chrome è in alto, nella barra dell’indirizzo)' : ' in basso. Con iOS 26 tocca prima ••• e poi Condividi'}.</Step>
        <Step n="2" icon="plusSquare">Scorri e tocca <b>“Aggiungi alla schermata Home”</b>. Se non lo vedi, tocca “Altro”.</Step>
        <Step n="3" icon="check">Tocca <b>“Aggiungi”</b>: l’icona di Horarya compare tra le tue app.</Step>
      </ol>
    );
  }
  return (
    <ol className="inst-steps">
      <Step n="1" icon="dotsV">Tocca il menu <b>⋮</b> in alto a destra{info.browser === 'samsung' ? ' (in Samsung Internet: ☰ in basso)' : ''}.</Step>
      <Step n="2" icon="plusSquare">Tocca <b>“Installa app”</b> oppure <b>“Aggiungi a schermata Home”</b>.</Step>
      <Step n="3" icon="check">Conferma: l’icona di Horarya compare tra le tue app.</Step>
    </ol>
  );
}

// Finestra "Installa Horarya sul telefono": su Android con il tasto che installa con un tocco
// (quando il browser lo permette), altrimenti i passi illustrati per il telefono in uso.
export default function InstallSheet({ onClose, onLater }) {
  const info = browserInfo();
  const [platform, setPlatform] = useState(info.platform === 'desktop' ? 'android' : info.platform);
  const canPrompt = useCanPromptInstall();
  const installed = isStandalone();
  useLockBodyScroll();
  useBackClose(onClose);

  const install = async () => { if (await promptInstall()) onClose(); };
  const shownInfo = platform === info.platform ? info : { platform, browser: platform === 'ios' ? 'safari' : 'chrome', inApp: false };

  return (
    <Portal>
      <div className="sheet-overlay" onClick={onClose}>
        <div className="sheet inst-sheet" role="dialog" aria-label="Installa Horarya sul telefono" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <button type="button" className="round-btn inst-x" onClick={onClose} aria-label="Chiudi"><Icon name="x" size={20} /></button>
          <img className="inst-icon" src="pwa-192.png" alt="" width="84" height="84" />
          <h2 className="inst-title">Installa Horarya sul telefono</h2>
          {installed ? (
            <p className="inst-sub">Horarya è già installata su questo telefono. 👍</p>
          ) : (
            <>
              <p className="inst-sub">Si apre come un’app vera: dall’icona, a schermo intero, anche senza rete. Gratis, senza store, in pochi secondi.</p>

              {canPrompt && platform === info.platform && !info.inApp ? (
                <button type="button" className="btn btn-primary btn-block inst-go" onClick={install}>
                  <Icon name="download" size={19} /> Installa Horarya
                </button>
              ) : (
                <Steps platform={platform} info={shownInfo} />
              )}

              {platform === 'ios' && !info.inApp && (
                <p className="inst-note">Dopo l’installazione apri Horarya dall’icona e accedi lì: su iPhone l’app installata chiede di nuovo email e password.</p>
              )}

              <div className="inst-other">
                {info.platform === 'desktop' ? 'Apri questo link dal telefono. Guida per' : 'Hai un altro telefono?'}
                {' '}<button type="button" className={`link-btn ${platform === 'ios' ? 'on' : ''}`} onClick={() => setPlatform('ios')}>iPhone</button>
                {' · '}<button type="button" className={`link-btn ${platform === 'android' ? 'on' : ''}`} onClick={() => setPlatform('android')}>Android</button>
              </div>
            </>
          )}
          {onLater && !installed && (
            <button type="button" className="btn btn-block inst-later" onClick={onLater}>Più tardi</button>
          )}
        </div>
      </div>
    </Portal>
  );
}

// Sale da sola poco dopo l'apertura dal telefono (non installata), una volta per visita;
// con "Più tardi" non torna per 3 giorni.
export function InstallSheetAuto({ delay = 1200 }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!autoInstallSheetDue()) return undefined;
    const t = setTimeout(() => { if (autoInstallSheetDue()) { markAutoInstallSheetShown(); setOpen(true); } }, delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!open) return null;
  return <InstallSheet onClose={() => setOpen(false)} onLater={() => { installSheetLater(); setOpen(false); }} />;
}

// Promemoria fisso nella pagina di accesso (solo telefono, non installata).
export function InstallBanner() {
  const info = browserInfo();
  const canPrompt = useCanPromptInstall();
  const [open, setOpen] = useState(false);
  if (isStandalone() || info.platform === 'desktop') return null;
  return (
    <>
      <button type="button" className="inst-banner" onClick={() => { if (canPrompt && !info.inApp) promptInstall(); else setOpen(true); }}>
        <img src="pwa-192.png" alt="" width="40" height="40" />
        <span className="inst-banner-tx"><b>Installa Horarya sul telefono</b><small>Come un’app, dall’icona</small></span>
        <span className="inst-banner-btn">Installa</span>
      </button>
      {open && <InstallSheet onClose={() => setOpen(false)} />}
    </>
  );
}
