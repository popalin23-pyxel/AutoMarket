import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles.css';

// Senza questo, quando pubblichiamo un aggiornamento il service worker lo
// scarica in background ma la pagina già aperta continua a usare il
// JavaScript vecchio finché non la chiudi e riapri del tutto — a chi tiene
// Turnio sempre aperto come app, un "ho corretto il bug" poteva sembrare
// non funzionare. Ora, appena il nuovo service worker prende il controllo,
// la pagina si ricarica da sola una volta sola.
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
