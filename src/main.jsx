import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './lib/install.js'; // cattura subito l'invito a installare l'app (Android/Chrome)
import { reloadOnce, chunkLoadOk } from './lib/loadChunk.js';
import { installErrorLog } from './lib/errorLog.js';
import './styles.css';

// Quando pubblichiamo un aggiornamento il service worker lo scarica in background, ma la
// pagina già aperta continua a usare il JavaScript vecchio: per applicarlo serve ricaricare.
// - Solo se è davvero un aggiornamento: al primo avvio (nessun service worker ancora attivo)
//   il nuovo service worker prende il controllo e basta, senza ricaricare la pagina
//   (prima svuotava il modulo di accesso mentre lo si compilava).
// - Non mentre si usa l'app: si ricarica la prossima volta che va in background, dopo un
//   attimo per lasciar finire il salvataggio sul cloud, così non si perde ciò che si scrive.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let scheduled = false;
  // ricarica solo se l'app è ancora in background (se si è già tornati, alla prossima volta)
  const reloadIfHidden = () => setTimeout(() => {
    if (document.visibilityState === 'hidden') window.location.reload();
  }, 1000);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || scheduled) return;
    scheduled = true;
    if (document.visibilityState === 'hidden') reloadIfHidden();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reloadIfHidden();
    });
  });
}

installErrorLog(); // ultimi errori, da allegare a "Segnala un problema"

// un pezzo dell'app non più disponibile dopo un aggiornamento (vedi lib/loadChunk.js)
window.addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault(); });
window.addEventListener('load', () => setTimeout(chunkLoadOk, 10000));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
