import { describe, it, expect, vi, beforeEach } from 'vitest';

// Finto Supabase: una riga per utente, updated_at restituito nel formato reale di
// PostgREST ("…+00:00", con microsecondi), diverso da quello scritto dall'app ("…Z").
const db = vi.hoisted(() => ({ row: null, writes: 0, clock: Date.UTC(2026, 9, 20) }));
vi.mock('./supabaseClient.js', () => {
  const pg = (iso) => iso.replace('Z', '123+00:00');
  const query = {
    select() { return this; },
    abortSignal() { return this; },
    eq() { return this; },
    async maybeSingle() { return { data: db.row ? { data: db.row.data, updated_at: pg(db.row.updated_at) } : null, error: null }; },
    upsert(row) {
      db.writes += 1;
      db.clock += 1000; // ogni salvataggio avviene in un istante diverso
      db.row = { data: JSON.parse(JSON.stringify(row.data)), updated_at: new Date(db.clock).toISOString() };
      const done = { single: async () => ({ data: { updated_at: pg(db.row.updated_at) }, error: null }) };
      return { select: () => ({ ...done, abortSignal: () => done }) };
    },
  };
  return { supabase: { from: () => query }, isSupabaseConfigured: true };
});

const { toMillis, saveCloudState, saveCloudStateSafely, fetchCloudState } = await import('./cloudState.js');
const { sanitizeState } = await import('./store.js');

// come nell'app: lo stato locale è sempre già normalizzato
const state = (over = {}) => sanitizeState({ ...over });

describe('toMillis: confronto delle versioni cloud come istanti, non come testo', () => {
  it('"Z" e "+00:00" indicano lo stesso istante (causa dell\'avviso continuo su iPhone)', () => {
    expect(toMillis('2026-10-20T08:15:30.824Z')).toBe(toMillis('2026-10-20T08:15:30.824+00:00'));
  });

  it('i microsecondi del server vengono troncati ai millisecondi', () => {
    expect(toMillis('2026-10-20T08:15:30.824123+00:00')).toBe(Date.UTC(2026, 9, 20, 8, 15, 30, 824));
  });

  it('gestisce fusi orari, formati senza ":" e senza decimali', () => {
    const ref = Date.UTC(2026, 9, 20, 8, 15, 30);
    expect(toMillis('2026-10-20T10:15:30+02:00')).toBe(ref);
    expect(toMillis('2026-10-20T10:15:30+0200')).toBe(ref);
    expect(toMillis('2026-10-20 08:15:30+00')).toBe(ref);
    expect(toMillis('2026-10-20T03:15:30-05:00')).toBe(ref);
  });

  it('valori assenti danno null, i numeri restano tali', () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis('')).toBeNull();
    expect(toMillis(1234)).toBe(1234);
  });
});

describe('salvataggio sul cloud', () => {
  beforeEach(() => { db.row = null; db.writes = 0; });

  it('salvataggi consecutivi dallo stesso dispositivo non vengono scambiati per un altro dispositivo', async () => {
    let version = await saveCloudState('u1', state());
    for (let i = 1; i <= 3; i++) {
      const res = await saveCloudStateSafely('u1', state({ settings: { taxRatePercent: 15 + i }, settingsUpdatedAt: i }), version);
      expect(res.merged).toBe(false);
      version = res.version;
    }
    expect((await fetchCloudState('u1')).version).toBe(version);
  });

  it('se un altro dispositivo ha salvato nel frattempo, i dati vengono uniti senza perderne', async () => {
    const version = await saveCloudState('u1', state());
    await saveCloudState('u1', state({ shifts: [{ id: 'remoto', _u: 5 }] })); // altro telefono
    const res = await saveCloudStateSafely('u1', state({ shifts: [{ id: 'locale', _u: 6 }] }), version);
    expect(res.merged).toBe(true);
    expect(res.state.shifts.map((s) => s.id).sort()).toEqual(['locale', 'remoto']);
    expect(db.row.data.shifts).toHaveLength(2);
  });

  it('se l\'unione non aggiunge nulla al cloud, non riscrive', async () => {
    const version = await saveCloudState('u1', state());
    await saveCloudState('u1', state({ shifts: [{ id: 'a', _u: 5 }] }));
    const writes = db.writes;
    const res = await saveCloudStateSafely('u1', state(), version);
    expect(res.merged).toBe(true);
    expect(db.writes).toBe(writes);
    expect(res.state.shifts).toHaveLength(1);
  });
});
