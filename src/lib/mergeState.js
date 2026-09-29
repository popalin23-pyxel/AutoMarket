// Unione di due stati (locale + remoto) quando un altro dispositivo ha salvato
// nel frattempo, per non perdere dati per sovrascrittura silenziosa.
//
// Limite noto: è un'unione per id, non una vera risoluzione dei conflitti.
// Se un elemento viene eliminato su un dispositivo mentre l'altro salva senza
// quella modifica, l'elemento può ricomparire (va eliminato di nuovo). In
// cambio, non si perdono mai aggiunte/modifiche fatte nel frattempo altrove.

function mergeArraysById(localArr = [], remoteArr = []) {
  const map = new Map();
  for (const item of remoteArr) map.set(item.id, item);
  for (const item of localArr) map.set(item.id, item); // in caso di stesso id, vince il locale
  return [...map.values()];
}

function mergeSeq(localSeq = {}, remoteSeq = {}) {
  const keys = new Set([...Object.keys(localSeq), ...Object.keys(remoteSeq)]);
  const out = {};
  for (const k of keys) out[k] = Math.max(Number(localSeq[k]) || 1, Number(remoteSeq[k]) || 1);
  return out;
}

export function mergeStates(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  return {
    ...local,
    sites: mergeArraysById(local.sites, remote.sites),
    shifts: mergeArraysById(local.shifts, remote.shifts),
    favorites: mergeArraysById(local.favorites, remote.favorites),
    expenses: mergeArraysById(local.expenses, remote.expenses),
    seq: mergeSeq(local.seq, remote.seq),
  };
}
