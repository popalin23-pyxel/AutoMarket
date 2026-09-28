import React, { useState } from 'react';
import { exportBackup } from '../lib/store.js';
import { shouldShowBackupReminder, snoozeBackupReminder } from '../lib/backupReminder.js';
import Icon from './icons/Icon.jsx';

export default function BackupReminder({ state }) {
  const [visible, setVisible] = useState(shouldShowBackupReminder);
  if (!visible) return null;

  const doExport = () => { exportBackup(state); setVisible(false); };
  const dismiss = () => { snoozeBackupReminder(7); setVisible(false); };

  return (
    <div className="panel backup-reminder">
      <Icon name="hourglass" size={18} className="backup-reminder-icon" />
      <div className="backup-reminder-body">
        <div className="backup-reminder-title">Backup consigliato</div>
        <p className="backup-reminder-text">Non esporti una copia di sicurezza da un po'. Ci vuole un secondo.</p>
        <div className="backup-reminder-actions">
          <button className="btn btn-primary btn-sm" onClick={doExport}>⬇ Esporta ora</button>
          <button className="btn btn-sm" onClick={dismiss}>Tra una settimana</button>
        </div>
      </div>
    </div>
  );
}
