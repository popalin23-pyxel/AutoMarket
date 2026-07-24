import React from 'react';

const STATE_COLORS = {
  noise:   '#ff4466',
  range:   '#ffaa00',
  trend:   '#4488ff',
  impulse: '#00ff88',
};

const STATE_DESCRIPTIONS = {
  noise:   'Mercato caotico — nessuna strategia affidabile. Non operare.',
  range:   'Mercato laterale strutturato — strategia range applicabile.',
  trend:   'Mercato direzionale — strategia trend applicabile.',
  impulse: 'Impulso forte — condizioni ottimali per entrare nel trend.',
};

export default function PrismaPanel({ prismaData }) {
  if (!prismaData) return (
    <div className="card">
      <div className="card-header"><h3 className="panel-title">PRISMA Score</h3></div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Calcolo in corso...</p>
    </div>
  );

  const { score, state, stateLabel, H, apEn, gravity } = prismaData;
  const color = STATE_COLORS[state] || '#888';
  const circumference = 2 * Math.PI * 40;
  const dash = (score / 100) * circumference;

  return (
    <div className="card prisma-card">
      <div className="card-header">
        <h3 className="panel-title">PRISMA Score</h3>
        <span className="prisma-state-badge" style={{ background: color + '22', color, border: `1px solid ${color}55` }}>
          {stateLabel}
        </span>
      </div>

      <div className="prisma-gauge-wrapper">
        <svg width="110" height="110" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e1e2e" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
          <text x="50" y="46" textAnchor="middle" fill={color} fontSize="18" fontWeight="bold" fontFamily="monospace">
            {score}
          </text>
          <text x="50" y="60" textAnchor="middle" fill="#555577" fontSize="9">/100</text>
        </svg>

        <div className="prisma-pillars">
          <div className="prisma-pillar">
            <span className="pp-label">Hurst (H)</span>
            <span className={`pp-value font-mono ${H > 0.55 ? 'green' : H < 0.45 ? 'orange' : 'red'}`}>
              {H.toFixed(3)}
            </span>
            <span className="pp-sub">{H > 0.55 ? 'trend' : H < 0.45 ? 'mean-rev.' : 'random'}</span>
          </div>
          <div className="prisma-pillar">
            <span className="pp-label">Entropia</span>
            <span className={`pp-value font-mono ${apEn < 0.5 ? 'green' : apEn < 1.0 ? 'orange' : 'red'}`}>
              {apEn.toFixed(3)}
            </span>
            <span className="pp-sub">{apEn < 0.5 ? 'bassa' : apEn < 1.0 ? 'media' : 'alta'}</span>
          </div>
          <div className="prisma-pillar">
            <span className="pp-label">Gravità Vol.</span>
            <span className={`pp-value font-mono ${gravity > 0.2 ? 'green' : gravity < -0.2 ? 'red' : ''}`}>
              {gravity >= 0 ? '+' : ''}{gravity.toFixed(2)}
            </span>
            <span className="pp-sub">{gravity > 0.1 ? '↑ rialzista' : gravity < -0.1 ? '↓ ribassista' : 'neutro'}</span>
          </div>
        </div>
      </div>

      <p className="prisma-desc" style={{ color }}>{STATE_DESCRIPTIONS[state]}</p>

      {state === 'noise' && (
        <div className="prisma-block-alert">
          🔴 PRISMA ha rilevato un mercato non prevedibile — il segnale è inaffidabile
        </div>
      )}
    </div>
  );
}
