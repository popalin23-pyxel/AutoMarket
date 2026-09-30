import React, { useState } from 'react';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import Portal from '../lib/Portal.jsx';
import Icon from './icons/Icon.jsx';

const KEY = 'turnio_onboarding_seen';

const STEPS = [
  { icon: 'home', title: 'Benvenuta su Turnio', text: 'Registra i tuoi turni per sede e calcola automaticamente fatturato, rivalsa e tasse da accantonare.' },
  { icon: 'mapPin', title: 'Prima cosa: le sedi', text: 'Nella scheda "Sedi" aggiungi ogni posto dove lavori, con la sua paga oraria.' },
  { icon: 'calendar', title: 'Poi: i turni', text: 'In "Turni" registra data, sede e orario di ogni turno. Puoi modificarlo in ogni momento se cambia.' },
  { icon: 'euro', title: 'Tutto calcolato per te', text: 'In "Riepilogo" trovi ore, fatturato e quanto mettere da parte per le tasse, mese per mese.' },
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
