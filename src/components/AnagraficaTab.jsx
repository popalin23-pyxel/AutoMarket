import React from 'react';
import { updateSettings } from '../lib/store.js';
import { PROFESSIONAL_ROLES } from '../lib/defaults.js';

export default function AnagraficaTab({ state, setState }) {
  const { settings } = state;
  const patch = (p) => setState((s) => updateSettings(s, p));

  return (
    <div className="panel">
      <h2 className="panel-title">Anagrafica</h2>
      <p className="panel-desc">
        I tuoi dati professionali: compaiono nel saluto di Oggi e nell'intestazione dei report PDF ed Excel.
      </p>

      <div className="field" style={{ marginBottom: 14 }}>
        <label className="field-label">Nome e cognome</label>
        <input type="text" value={settings.displayName} placeholder="es. Maria Rossi" autoComplete="name"
          onChange={(e) => patch({ displayName: e.target.value })} style={{ width: '100%', minWidth: 0 }} />
      </div>

      <div className="field" style={{ marginBottom: settings.professionalRole === 'altro' ? 10 : 14 }}>
        <label className="field-label" htmlFor="anag-role">Ruolo professionale</label>
        <select id="anag-role" value={settings.professionalRole}
          onChange={(e) => patch({ professionalRole: e.target.value })} style={{ width: '100%', minWidth: 0 }}>
          <option value="">— Seleziona —</option>
          {PROFESSIONAL_ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      {settings.professionalRole === 'altro' && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="field-label">Specifica</label>
          <input type="text" value={settings.professionalRoleOther} placeholder="es. Ostetrica, Logopedista"
            onChange={(e) => patch({ professionalRoleOther: e.target.value })} style={{ width: '100%', minWidth: 0 }} />
        </div>
      )}

      <div className="field">
        <label className="field-label">Partita IVA o n. iscrizione all'albo (facoltativo)</label>
        <input type="text" value={settings.vatNumber} placeholder="es. 01234567890"
          onChange={(e) => patch({ vatNumber: e.target.value })} style={{ width: '100%', minWidth: 0 }} />
      </div>
    </div>
  );
}
