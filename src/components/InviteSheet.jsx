import React, { useState } from 'react';
import { appUrl, inviteMessage, shareLinks, copyText, canShare } from '../lib/invite.js';
import { useLockBodyScroll } from '../lib/useLockBodyScroll.js';
import { useBackClose } from '../lib/backStack.js';
import Portal from '../lib/Portal.jsx';
import Icon from './icons/Icon.jsx';

// Invita un amico: un messaggio già scritto (modificabile) con il link dell'app, da mandare
// con il menu di condivisione del telefono, direttamente su WhatsApp, Telegram, email, SMS,
// oppure da copiare.
export default function InviteSheet({ isAdmin, onClose }) {
  const url = appUrl();
  const [message, setMessage] = useState(() => inviteMessage(url));
  const [copied, setCopied] = useState(''); // 'link' | 'msg' | ''
  const [shareError, setShareError] = useState('');
  useLockBodyScroll();
  useBackClose(onClose);

  const links = shareLinks(message, url);
  const shareNative = async () => {
    setShareError('');
    try {
      // il link è già nel testo: passarlo anche a parte su alcune app lo farebbe comparire due volte
      await navigator.share({ title: 'Horarya', text: message });
    } catch (e) {
      if (e?.name !== 'AbortError') setShareError('Il telefono non ha aperto la condivisione: usa uno dei tasti qui sotto.');
    }
  };
  const copy = async (what) => {
    const ok = await copyText(what === 'link' ? url : message);
    setCopied(ok ? what : '');
    if (ok) setTimeout(() => setCopied((c) => (c === what ? '' : c)), 2500);
  };

  const channels = [
    { id: 'whatsapp', label: 'WhatsApp', icon: 'chat', href: links.whatsapp },
    { id: 'telegram', label: 'Telegram', icon: 'send', href: links.telegram },
    { id: 'email', label: 'Email', icon: 'mail', href: links.email },
    { id: 'sms', label: 'SMS', icon: 'chat', href: links.sms },
  ];

  return (
    <Portal>
      <div className="sheet-overlay" onClick={onClose}>
        <div className="sheet invite-sheet" role="dialog" aria-label="Invita un amico" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-head">
            <h2>Invita un amico</h2>
            <button type="button" className="round-btn" onClick={onClose} aria-label="Chiudi"><Icon name="x" size={20} /></button>
          </div>
          <p className="invite-intro">Manda Horarya a una collega o a un amico: il messaggio spiega a cosa serve e contiene il link per aprirla.</p>

          <label className="field-label" htmlFor="invite-msg">Il messaggio (puoi cambiarlo)</label>
          <textarea id="invite-msg" className="invite-msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />

          {canShare() && (
            <button type="button" className="btn btn-primary btn-block invite-share" onClick={shareNative}>
              Condividi…
              <small>WhatsApp, Messaggi, Telegram, email e tutte le altre app</small>
            </button>
          )}
          {shareError && <p className="hint hint-warn" style={{ marginTop: 8, marginBottom: 0 }}>{shareError}</p>}

          <div className="invite-sub">{canShare() ? 'Oppure manda direttamente' : 'Manda con'}</div>
          <div className="invite-grid">
            {channels.map((c) => (
              <a key={c.id} className={`invite-ch ch-${c.id}`} href={c.href} target="_blank" rel="noopener noreferrer">
                <span className="invite-ch-ic"><Icon name={c.icon} size={22} strokeWidth={2} /></span>
                {c.label}
              </a>
            ))}
          </div>

          <div className="invite-sub">Oppure copia</div>
          <div className="invite-copy">
            <button type="button" className={`btn invite-copy-btn ${copied === 'link' ? 'ok' : ''}`} onClick={() => copy('link')}>
              <Icon name={copied === 'link' ? 'check' : 'link'} size={18} /> {copied === 'link' ? 'Link copiato' : 'Copia il link'}
            </button>
            <button type="button" className={`btn invite-copy-btn ${copied === 'msg' ? 'ok' : ''}`} onClick={() => copy('msg')}>
              <Icon name={copied === 'msg' ? 'check' : 'copy'} size={18} /> {copied === 'msg' ? 'Messaggio copiato' : 'Copia il messaggio'}
            </button>
          </div>
          <p className="invite-url mono">{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>

          <p className="invite-note">
            <Icon name="hourglass" size={15} />
            <span>
              {isAdmin
                ? 'Dopo l’iscrizione l’account va attivato: lo trovi in Altro → Amministrazione.'
                : 'Dopo l’iscrizione l’account viene attivato da chi gestisce Horarya.'}
            </span>
          </p>
        </div>
      </div>
    </Portal>
  );
}
