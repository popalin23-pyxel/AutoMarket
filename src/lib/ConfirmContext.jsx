import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useLockBodyScroll } from './useLockBodyScroll.js';

const ConfirmContext = createContext(null);

function ConfirmDialog({ dialog, onClose }) {
  useLockBodyScroll();
  return (
    <div className="editor-overlay" onClick={() => onClose(false)}>
      <div className="editor-card confirm-card" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head"><span>{dialog.title}</span></div>
        <p className="confirm-msg">{dialog.message}</p>
        <div className="editor-actions">
          <button className="btn btn-block" onClick={() => onClose(false)}>{dialog.cancelLabel}</button>
          <button className={`btn btn-block ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onClose(true)}>
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const confirmAction = useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setDialog({
        message,
        title: opts.title || 'Conferma',
        danger: !!opts.danger,
        confirmLabel: opts.confirmLabel || 'Conferma',
        cancelLabel: opts.cancelLabel || 'Annulla',
      });
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {dialog && <ConfirmDialog dialog={dialog} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve essere usato dentro <ConfirmProvider>');
  return ctx;
}
