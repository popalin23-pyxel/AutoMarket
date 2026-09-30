import React from 'react';

// Rete di sicurezza: se un componente qualsiasi genera un errore non gestito,
// mostra un messaggio comprensibile invece di una pagina bianca. I dati non
// si perdono: sono già salvati in locale a ogni modifica (vedi store.js).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Turnio: errore non gestito', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-brand"><span className="brand-logo">Turn<span className="accent">io</span></span></div>
          <p style={{ marginTop: 10, marginBottom: 14 }}>
            Si è verificato un problema imprevisto. I tuoi dati sono al sicuro:
            vengono salvati automaticamente a ogni modifica.
          </p>
          <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>
            Ricarica l'app
          </button>
        </div>
      </div>
    );
  }
}
