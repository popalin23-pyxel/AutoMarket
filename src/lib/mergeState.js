// Unione di due stati (locale + remoto) quando un altro dispositivo ha salvato
// nel frattempo, per non perdere dati per sovrascrittura silenziosa.
//
// Le eliminazioni sono tracciate con "tombstone" (id + quando è stato
// eliminato): senza, un'unione per id da sola farebbe ricomparire un
// elemento eliminato su un dispositivo se l'altro lo salva ancora presente.
// Con i tombstone, un elemento eliminato su un dispositivo qualsiasi resta
// eliminato ovunque, anche dopo l'unione.

function mergeArraysById(localArr = [], remoteArr = [], tombstones = {}) {
  const map = new Map();
  for (const item of remoteArr) map.set(item.id, item);
  for (const item of localArr) map.set(item.id, item); // in caso di stesso id, vince il locale
  for (const id of map.keys()) {
    if (tombstones[id] != null) map.delete(id);
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

const COLLECTIONS = ['sites', 'shifts', 'favorites', 'expenses'];

function mergeTombstones(localTomb = {}, remoteTomb = {}) {
  const out = {};
  for (const key of COLLECTIONS) out[key] = mergeTombstoneMap(localTomb[key], remoteTomb[key]);
  return out;
}

export function mergeStates(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const merged = { ...local, seq: mergeSeq(local.seq, remote.seq), tombstones };
  for (const key of COLLECTIONS) merged[key] = mergeArraysById(local[key], remote[key], tombstones[key]);
  return merged;
}
