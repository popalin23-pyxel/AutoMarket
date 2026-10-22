// Unione di due stati (locale + remoto) quando un altro dispositivo ha salvato
// nel frattempo, per non perdere dati per sovrascrittura silenziosa.
//
// Regole:
// - elementi presenti solo da una parte: si tengono entrambi;
// - stesso elemento (stesso id) modificato da entrambe le parti: vince la
//   modifica più recente (`_u`, impostato da store.js a ogni creazione/modifica);
// - eliminazioni tracciate con "tombstone" (id + quando): un elemento eliminato
//   resta eliminato ovunque, a meno che non sia stato ripristinato/modificato dopo;
// - impostazioni: vince la versione modificata più di recente (`settingsUpdatedAt`).
// A parità (es. dati salvati prima che esistessero i timestamp) vince il locale,
// oppure il remoto se richiesto con preferRemoteOnTie.

const stamp = (item) => Number(item?._u) || 0;

function mergeArraysById(localArr = [], remoteArr = [], tombstones = {}, preferRemoteOnTie = false) {
  const map = new Map();
  for (const item of remoteArr) map.set(item.id, item);
  for (const item of localArr) {
    const other = map.get(item.id);
    const localWins = !other || stamp(item) > stamp(other) || (stamp(item) === stamp(other) && !preferRemoteOnTie);
    if (localWins) map.set(item.id, item);
  }
  for (const [id, item] of map) {
    const deletedAt = tombstones[id];
    if (deletedAt != null && Number(deletedAt) >= stamp(item)) map.delete(id);
  }
  return [...map.values()];
}

function mergeSeq(localSeq = {}, remoteSeq = {}) {
  const keys = new Set([...Object.keys(localSeq), ...Object.keys(remoteSeq)]);
  const out = {};
  for (const k of keys) out[k] = Math.max(Number(localSeq[k]) || 1, Number(remoteSeq[k]) || 1);
  return out;
}

function mergeTombstoneMap(localT = {}, remoteT = {}) {
  const out = { ...remoteT };
  for (const [id, ts] of Object.entries(localT)) {
    out[id] = Math.max(Number(out[id]) || 0, Number(ts) || 0);
  }
  return out;
}

const COLLECTIONS = ['sites', 'shifts', 'favorites', 'expenses', 'occasionalWork', 'dayMarks'];

function mergeTombstones(localTomb = {}, remoteTomb = {}) {
  const out = {};
  for (const key of COLLECTIONS) out[key] = mergeTombstoneMap(localTomb[key], remoteTomb[key]);
  return out;
}

export function mergeStates(local, remote, { preferRemoteOnTie = false } = {}) {
  if (!remote) return local;
  if (!local) return remote;
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const localSet = Number(local.settingsUpdatedAt) || 0;
  const remoteSet = Number(remote.settingsUpdatedAt) || 0;
  const useRemoteSettings = remote.settings && (remoteSet > localSet || (remoteSet === localSet && preferRemoteOnTie));
  const merged = {
    ...local,
    seq: mergeSeq(local.seq, remote.seq),
    tombstones,
    settings: useRemoteSettings ? remote.settings : local.settings,
    settingsUpdatedAt: Math.max(localSet, remoteSet),
  };
  for (const key of COLLECTIONS) merged[key] = mergeArraysById(local[key], remote[key], tombstones[key], preferRemoteOnTie);
  return merged;
}

// JSON con le chiavi ordinate: due oggetti con lo stesso contenuto danno la stessa stringa.
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonical(state) {
  const out = { settings: state?.settings ?? {} };
  for (const key of COLLECTIONS) {
    out[key] = [...(state?.[key] ?? [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return stable(out);
}

// true se i due stati hanno gli stessi dati (turni, sedi, spese, prestazioni, scorciatoie,
// impostazioni), a prescindere dall'ordine: serve a capire se un'unione ha davvero
// portato qualcosa di nuovo, invece di avvisare l'utente a vuoto.
export function sameData(a, b) {
  return canonical(a) === canonical(b);
}
