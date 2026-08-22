import React, { useRef, useState } from 'react';
import { exportBackup, importBackup, resetState } from '../lib/store.js';
import {
  getCloudConfig, saveCloudConfig, isCloudConfigured, pullState, pushState, SETUP_SQL,
} from '../lib/cloud.js';
import { useT } from '../lib/i18n.js';

export default function DataTab({ state, setState }) {
  const t = useT();
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);
  const [cloud, setCloud] = useState(getCloudConfig);
  const [cloudMsg, setCloudMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const setCloudField = (k, v) => {
    const next = { ...cloud, [k]: v };
    setCloud(next); saveCloudConfig(next);
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importBackup(file);
      setState(imported);
      setMsg({ type: 'info', text: `${imported.staff.length} · ${imported.unavailability.length} ✓` });
    } catch (err) {
      setMsg({ type: 'warn', text: err.message });
    } finally { e.target.value = ''; }
  };

  const doReset = () => {
    if (!confirm(t('data.resetConfirm'))) return;
    setState(resetState());
    setMsg({ type: 'info', text: t('data.resetDone') });
  };

  const cloudPush = async () => {
    setBusy(true); setCloudMsg(null);
    try { await pushState(state, cloud); setCloudMsg({ type: 'info', text: t('data.cloudPush') + ' ✓' }); }
    catch (e) { setCloudMsg({ type: 'warn', text: e.message }); }
    finally { setBusy(false); }
  };

  const cloudPull = async () => {
    setBusy(true); setCloudMsg(null);
    try {
      const r = await pullState(cloud);
      if (!r) { setCloudMsg({ type: 'warn', text: '—' }); return; }
      setState(r.state);
      setCloudMsg({ type: 'info', text: `${t('data.cloudPull')} ✓ (${new Date(r.updatedAt).toLocaleString()})` });
    } catch (e) { setCloudMsg({ type: 'warn', text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">{t('data.title')}</h2>
      <p className="panel-desc">{t('data.desc')}</p>

      {msg && <div className={`hint hint-${msg.type}`}>{msg.text}</div>}

      <div className="stats-row">
        <div className="stat"><div className="stat-label">{t('data.staff')}</div><div className="stat-value">{state.staff.length}</div></div>
        <div className="stat"><div className="stat-label">{t('data.shifts')}</div><div className="stat-value">{Object.keys(state.shifts).length}</div></div>
        <div className="stat"><div className="stat-label">{t('data.roles')}</div><div className="stat-value">{Object.keys(state.roles).length}</div></div>
        <div className="stat"><div className="stat-label">{t('data.unav')}</div><div className="stat-value">{state.unavailability.length}</div></div>
      </div>

      <div className="form-row">
        <button className="btn btn-primary" onClick={() => exportBackup(state)}>{t('data.export')}</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>{t('data.import')}</button>
        <button className="btn btn-danger" onClick={doReset}>{t('data.reset')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={doImport} style={{ display: 'none' }} />
      </div>

      <div className="hint hint-info" style={{ marginBottom: 0 }}>
        <b>{t('data.moveHint')}</b> {t('data.moveHintBody')}
      </div>

      <h2 className="panel-title" style={{ marginTop: 28 }}>{t('data.cloudTitle')}</h2>
      <p className="panel-desc">
        {t('data.cloudDesc')} {isCloudConfigured(cloud)
          ? <span className="green">{t('data.cloudConfigured')}</span>
          : <span style={{ color: 'var(--text-mut)' }}>{t('data.cloudNot')}</span>}
      </p>

      {cloudMsg && <div className={`hint hint-${cloudMsg.type}`}>{cloudMsg.text}</div>}

      <div className="form-row">
        <div className="field" style={{ flex: 2, minWidth: 220 }}>
          <label className="field-label">Supabase URL</label>
          <input type="text" value={cloud.url} placeholder="https://xxxx.supabase.co"
            onChange={(e) => setCloudField('url', e.target.value.trim())} />
        </div>
        <div className="field" style={{ flex: 2, minWidth: 220 }}>
          <label className="field-label">Anon key</label>
          <input type="password" value={cloud.key} placeholder="anon public key"
            onChange={(e) => setCloudField('key', e.target.value.trim())} />
        </div>
        <div className="field">
          <label className="field-label">{t('data.cloudTeam')}</label>
          <input type="text" value={cloud.team} placeholder="reparto-A-2026"
            onChange={(e) => setCloudField('team', e.target.value.trim())} />
        </div>
      </div>

      <div className="form-row" style={{ alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={cloudPush} disabled={busy || !isCloudConfigured(cloud)}>{t('data.cloudPush')}</button>
        <button className="btn" onClick={cloudPull} disabled={busy || !isCloudConfigured(cloud)}>{t('data.cloudPull')}</button>
        <label className="inline-check" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={!!cloud.autoLoad} onChange={(e) => setCloudField('autoLoad', e.target.checked)} />
          {t('data.cloudAuto')}
        </label>
      </div>

      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 13 }}>{t('data.cloudSetup')}</summary>
        <pre style={{
          background: 'rgba(7,10,18,0.6)', border: '1px solid var(--border)', borderRadius: 8,
          padding: 12, marginTop: 10, overflowX: 'auto', fontFamily: 'var(--mono)', fontSize: 12, whiteSpace: 'pre',
        }}>{SETUP_SQL}</pre>
      </details>
    </div>
  );
}
