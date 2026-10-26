import React, { useState } from 'react';
import { roleLabel, PENSION_FUNDS } from '../lib/defaults.js';
import { isStandalone } from '../lib/install.js';
import Icon from './icons/Icon.jsx';
import InstallGuide from './InstallGuide.jsx';

const fmt0 = (n) => (Number(n) || 0).toLocaleString('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 });

function Tile({ color, icon, title, sub, onClick }) {
  return (
    <button type="button" className={`tile2 tc-${color}`} onClick={onClick}>
      <span className="tile2-ic"><Icon name={icon} size={21} strokeWidth={2} /></span>
      <span className="tile2-tx">
        <span className="tile2-t" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="tile2-s" style={{ display: 'block' }}>{sub}</span>}
      </span>
    </button>
  );
}

export function ListRow({ color, icon, title, sub, end, onClick }) {
  return (
    <button type="button" className="lrow" onClick={onClick}>
      <span className={`lrow-ic ic-${color}`}><Icon name={icon} size={20} strokeWidth={2} /></span>
      <span className="lrow-tx">
        <span className="lrow-t" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="lrow-s" style={{ display: 'block' }}>{sub}</span>}
      </span>
      <span className="lrow-end">{end}<Icon name="chevronRight" size={19} /></span>
    </button>
  );
}

// Altro: tutto ciò che non è Oggi, Turni o Soldi, diviso in poche categorie.
export default function AltroTab({ state, user, isAdmin, onOpen, onTool, onOpenPrivacy, onOpenAdmin, onLogout }) {
  const [installGuide, setInstallGuide] = useState(false);
  const st = state.settings;
  const name = (st.displayName || '').trim() || (user?.email || '').split('@')[0] || 'Il mio profilo';
  const role = roleLabel(st);
  const sub = [role, (st.vatNumber || '').trim() ? 'Partita IVA' : ''].filter(Boolean).join(' · ') || 'Nome, ruolo e Partita IVA';
  const initial = name.trim()[0]?.toUpperCase() || '?';
  const activeSites = state.sites.filter((s) => !s.archived);
  const sitesSub = activeSites.length ? activeSites.map((s) => s.name).join(' · ') : 'Aggiungi la prima';
  const fund = PENSION_FUNDS.find((f) => f.id === st.pensionFund);
  const regime = { forfettario: 'Forfettario', ordinario: 'Ordinario', altro: 'Altro regime' }[st.fiscalRegime] ?? 'Da impostare';
  const taxSub = [regime, fund && fund.id !== 'altro' ? fund.label : ''].filter(Boolean).join(' · ');
  const goal = Number(st.monthlyGoal) || 0;

  return (
    <>
      <div className="page-head"><h1 className="page-title">Altro</h1></div>

      <div className="ncard prof-card">
        <span className="prof-av">{initial}</span>
        <div className="prof-tx">
          <div className="prof-name">{name}</div>
          <div className="prof-sub">{sub}</div>
        </div>
        <button type="button" className="pill-btn" onClick={() => onOpen('anagrafica')}>I miei dati</button>
      </div>

      <div className="grp-title">Il mio lavoro</div>
      <div className="tiles2">
        <Tile color="teal" icon="building" title="Sedi e paghe" sub={sitesSub} onClick={() => onOpen('sites')} />
        <Tile color="rose" icon="taxes" title="Tasse e cassa" sub={taxSub} onClick={() => onOpen('fiscal')} />
        <Tile color="gold" icon="target" title="Obiettivo" sub={goal > 0 ? `€${fmt0(goal)} al mese` : 'Non impostato'} onClick={() => onOpen('goal')} />
        <Tile color="vio" icon="doc" title="Documenti" sub="PDF · foglio ore" onClick={() => onOpen('documents')} />
      </div>

      <div className="grp-title">Strumenti</div>
      <div className="lcard">
        <ListRow color="vio" icon="stamp" title="Segna più giorni" sub="Riempi il mese: tocca i giorni" onClick={() => onTool('stamp')} />
        <ListRow color="grn" icon="send" title="Invia giorni liberi" sub="Messaggio con la tua disponibilità" onClick={() => onTool('availability')} />
        <ListRow color="blue" icon="copy" title="Copia la settimana" sub="Ripeti gli stessi turni" onClick={() => onTool('duplicate')} />
      </div>

      <div className="grp-title">Account e app</div>
      <div className="acc-grid">
        <button type="button" className="acc-btn" onClick={() => onOpen('account')}>
          <span className="lrow-ic ic-sla"><Icon name="lock" size={18} strokeWidth={2} /></span>Account
        </button>
        <button type="button" className="acc-btn" onClick={() => onOpen('appearance')}>
          <span className="lrow-ic ic-vio"><Icon name="palette" size={18} strokeWidth={2} /></span>Aspetto
        </button>
        <button type="button" className="acc-btn" onClick={() => onOpen('backup')}>
          <span className="lrow-ic ic-blue"><Icon name="cloud" size={18} strokeWidth={2} /></span>Copia di sicurezza
        </button>
        <button type="button" className="acc-btn" onClick={onOpenPrivacy}>
          <span className="lrow-ic ic-sla"><Icon name="shield" size={18} strokeWidth={2} /></span>Privacy
        </button>
        {!isStandalone() && (
          <button type="button" className="acc-btn" onClick={() => setInstallGuide(true)}>
            <span className="lrow-ic ic-grn"><Icon name="phone" size={18} strokeWidth={2} /></span>Installa l’app
          </button>
        )}
        {isAdmin && (
          <button type="button" className="acc-btn" onClick={onOpenAdmin}>
            <span className="lrow-ic ic-gold"><Icon name="zap" size={18} strokeWidth={2} /></span>Amministrazione
          </button>
        )}
        <button type="button" className="acc-btn out" onClick={onLogout}>
          <span className="lrow-ic ic-rose"><Icon name="logout" size={18} strokeWidth={2} /></span>Esci
        </button>
      </div>

      {installGuide && <InstallGuide onClose={() => setInstallGuide(false)} />}
    </>
  );
}
