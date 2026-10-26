import React, { useState } from 'react';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import Icon from './icons/Icon.jsx';

const KEY = 'turnio_onboarding_seen';

const STEPS = [
  { icon: 'home', title: 'Ti diamo il benvenuto su Turnio', text: 'Registra i tuoi turni per sede e calcola automaticamente fatturato, rivalsa e tasse da accantonare.' },
  { icon: 'menu', title: 'Prima cosa: i tuoi dati', text: 'In "Altro" inserisci i tuoi dati, le sedi dove lavori con la paga oraria (Sedi e paghe) e come calcolare le tasse (Tasse e cassa).' },
  { icon: 'plus', title: 'Poi: i turni', text: 'Con il tasto + in basso aggiungi un turno, una prestazione occasionale o le ferie. In "Turni" li vedi settimana per settimana e li modifichi quando vuoi.' },
  { icon: 'euro', title: 'Tutto calcolato per te', text: 'In "Soldi" vedi quanto ti resta tolte le tasse, quanto mettere da parte, le spese e i grafici.' },
];

export function needsOnboarding() {
  try { return !localStorage.getItem(KEY); } catch { return false; }
}

export default function OnboardingTour({ onDone }) {
  const [step, setStep] = useState(0);
  useLockBodyScroll();
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = () => {
    try { localStorage.setItem(KEY, '1'); } catch {}
    onDone();
  };
  useBackClose(finish); // Indietro = "Salta"

  return (
    <Portal>
    <div className="editor-overlay">
      <div className="editor-card onboarding-card">
        <div className="onboarding-icon"><Icon name={s.icon} size={26} /></div>
        <h2 className="onboarding-title">{s.title}</h2>
        <p className="onboarding-text">{s.text}</p>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} />)}
        </div>
        <div className="editor-actions">
          {!last && <button className="btn" onClick={finish}>Salta</button>}
          <button className="btn btn-primary btn-block" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Inizia' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
