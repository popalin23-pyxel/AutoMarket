// Valori di default per Turnio

export const DEFAULT_SETTINGS = {
  // Come si stimano tasse e contributi (Studio → Fiscali):
  // 'semplice' = una % fissa di tutto il fatturato (taxRatePercent + contributionsPercent);
  // 'forfettario' = formula del regime forfettario (vedi computeTaxes in calc.js), con i suoi valori forf*.
  taxMode: 'semplice',
  taxPercent: 25,          // % totale accantonata sul fatturato = taxRatePercent + contributionsPercent (calcolato)
  taxRatePercent: 25,      // modalità semplice: aliquota imposta (% del fatturato)
  contributionsPercent: 0, // modalità semplice: contributi previdenziali (% del fatturato)
  forfTaxRatePercent: 15,        // forfettario: imposta sostitutiva (5% i primi 5 anni con i requisiti, poi 15%)
  forfContributionsPercent: 16,  // forfettario: contributi della cassa, % del reddito (es. ENPAPI 16%)
  coefficientPercent: 78,        // forfettario: coefficiente di redditività (78% per le professioni sanitarie)
  pensionFund: '',               // cassa previdenziale: id da PENSION_FUNDS o ''
  fiscalRegime: 'forfettario', // regime dichiarato; la formula esatta c'è solo per il forfettario
  rivalsaPercent: 4,   // maggiorazione di default in fattura (es. rivalsa INPS/integrativo ENPAPI); modificabile per sede
  // il 4% in fattura: 'rivalsa' (INPS: fa parte del compenso e si tassa) o 'integrativo'
  // (cassa come ENPAPI: si versa alla cassa, non è un guadagno). Conta solo nel calcolo forfettario.
  rivalsaType: 'rivalsa',
  displayName: '',     // nome e cognome (Anagrafica): saluto in Home e intestazione dei report
  professionalRole: '',      // id da PROFESSIONAL_ROLES o '' (Anagrafica)
  professionalRoleOther: '', // testo libero se professionalRole === 'altro' (es. "Fisioterapista")
  vatNumber: '',             // P.IVA o n. iscrizione all'albo, facoltativo (intestazione report)
  monthlyGoal: 0,      // obiettivo di netto mensile (€); 0 = nessun obiettivo impostato
  // prestazioni occasionali (redditi diversi, non regime forfettario): niente rivalsa,
  // tassazione IRPEF a scaglioni invece dell'aliquota forfettaria — qui solo una stima
  // accantonabile, 23% = primo scaglione IRPEF 2024, da adattare col commercialista
  occasionalTaxRatePercent: 23,
};

// La forma (maschile/femminile) la sceglie la persona: compare così com'è nel saluto e nei report.
export const PROFESSIONAL_ROLES = [
  { id: 'infermiere', label: 'Infermiere' },
  { id: 'infermiera', label: 'Infermiera' },
  { id: 'medico', label: 'Medico' },
  { id: 'fisioterapista', label: 'Fisioterapista' },
  { id: 'altro', label: 'Altro (specifica)' },
];

// Etichetta leggibile del ruolo (es. per intestazioni e saluto); '' se non impostato.
export function roleLabel(settings) {
  if (settings?.professionalRole === 'altro') return (settings.professionalRoleOther || '').trim();
  return PROFESSIONAL_ROLES.find((r) => r.id === settings?.professionalRole)?.label ?? '';
}

// Casse previdenziali con i valori di partenza (sempre modificabili). Percentuali e importi
// verificati a ottobre 2026 su fonti ufficiali e professionali: vanno ricontrollati ogni gennaio.
export const PENSION_FUNDS = [
  {
    id: 'enpapi', label: 'ENPAPI', who: 'infermieri',
    forfContributionsPercent: 16, rivalsaPercent: 4, rivalsaType: 'integrativo',
    info: [
      'Contributo soggettivo: 16% del reddito (si può scegliere di più, fino al 23%), con un minimo di €1.600 l\'anno.',
      'In fattura si aggiunge il contributo integrativo del 4% (2% verso la pubblica amministrazione): lo paga la struttura e lo versi alla cassa, non è un tuo guadagno. Minimo €150 l\'anno.',
      'In più un piccolo contributo di maternità annuo (€65,57 nel 2025).',
    ],
  },
  {
    id: 'enpam', label: 'ENPAM', who: 'medici',
    forfContributionsPercent: 19.5, rivalsaPercent: 0, rivalsaType: 'rivalsa',
    info: [
      'Quota A, fissa in base all\'età (2026): €304,73 fino a 30 anni, €591,47 da 30 a 35, €1.109,92 da 35 a 40, €2.049,83 dai 40 anni; più €84,26 di maternità.',
      'Quota B: 19,5% del reddito da libera professione oltre la parte già coperta dalla Quota A (aliquote ridotte del 9,75% o 2% solo in casi particolari).',
      'Di norma in fattura non si aggiunge nessuna maggiorazione.',
    ],
  },
  {
    id: 'inps', label: 'INPS Gestione separata', who: 'fisioterapisti e professioni senza cassa',
    forfContributionsPercent: 26.07, rivalsaPercent: 4, rivalsaType: 'rivalsa',
    info: [
      '26,07% del reddito nel 2026 (24% se sei già pensionato o iscritto a un\'altra cassa).',
      'La rivalsa del 4% in fattura è facoltativa e fa parte del compenso: si tassa.',
    ],
  },
  { id: 'altro', label: 'Altra cassa', who: '', info: ['Imposta tu percentuali e maggiorazione, chiedendo i valori al commercialista.'] },
];

// Cassa suggerita in base al ruolo dell'anagrafica.
export function suggestedFund(settings) {
  const role = settings?.professionalRole;
  if (role === 'infermiere' || role === 'infermiera') return 'enpapi';
  if (role === 'medico') return 'enpam';
  if (role === 'fisioterapista') return 'inps';
  return '';
}

// Come si chiama la maggiorazione del 4% in fattura (vedi Studio → Fiscali).
export function rivalsaLabel(settings) {
  return settings?.rivalsaType === 'integrativo' ? 'Contributo integrativo' : 'Rivalsa';
}

// Righe di intestazione professionale per i report (nome, ruolo, P.IVA), solo quelle compilate.
export function professionalHeaderLines(settings) {
  const vat = (settings?.vatNumber || '').trim();
  return [
    (settings?.displayName || '').trim(),
    roleLabel(settings),
    vat ? `P.IVA / Albo: ${vat}` : '',
  ].filter(Boolean);
}

// Categorie di spesa professionale
export const EXPENSE_CATEGORIES = [
  { id: 'carburante', label: 'Carburante', tile: 'gold' },
  { id: 'autostrada', label: 'Autostrada', tile: 'indigo' },
  { id: 'parcheggio', label: 'Parcheggio', tile: 'indigo' },
  { id: 'assicurazione', label: 'Assicurazione', tile: 'rose' },
  // versamenti alla cassa (ENPAPI/ENPAM/INPS): già compresi nelle tasse stimate, quindi non
  // vengono sottratti una seconda volta dal "Disponibile" (id storico 'enpapi')
  { id: 'enpapi', label: 'Contributi cassa', tile: 'teal', inTaxes: true },
  { id: 'commercialista', label: 'Commercialista', tile: 'violet' },
  { id: 'ecm', label: 'Corsi ECM', tile: 'lime' },
  { id: 'dispositivi', label: 'Dispositivi', tile: 'teal' },
  { id: 'telefono', label: 'Telefono', tile: 'violet' },
  { id: 'altro', label: 'Altro', tile: 'rose' },
];

// Giorni segnati sul calendario: non pagati, servono a vederli e contarli nell'anno
// (e a non proporli come giorni liberi nelle disponibilità)
export const DAY_MARK_KINDS = [
  { id: 'ferie', label: 'Ferie', icon: '🏖️', color: '#22d3ee' },
  { id: 'malattia', label: 'Malattia', icon: '🤒', color: '#fb7185' },
  { id: 'corso', label: 'Corso / ECM', icon: '📚', color: '#a78bfa' },
  { id: 'nondisp', label: 'Non disponibile', icon: '⛔', color: '#94a3b8' },
];
export const dayMarkKind = (id) => DAY_MARK_KINDS.find((k) => k.id === id) ?? { id, label: id, icon: '•', color: '#94a3b8' };

// Palette di colori pronti per le sedi (coordinata col tema dell'app)
export const SITE_COLORS = [
  '#2dd4bf', '#f59e0b', '#818cf8', '#fb7185', '#a3e635', '#22d3ee', '#c084fc', '#fbbf24',
];

export const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export const WEEKDAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export const WEEKDAYS_IT_LONG = [
  'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica',
];

// '#2dd4bf' -> 'rgba(45, 212, 191, 0.14)'
export function hexToRgba(hex, alpha = 1) {
  const clean = (hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(107, 114, 128, ${alpha})`;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
