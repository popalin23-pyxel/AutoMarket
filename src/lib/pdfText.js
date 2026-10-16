// Il font standard di jsPDF copre solo WinAnsi (Latin-1 + pochi simboli): lettere come
// ș ț ă (rumeno) o ł (polacco) uscirebbero illeggibili. Le portiamo alla lettera base più vicina.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const EXTRA_MAP = { ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ı: 'i', ø: 'o', Ø: 'O' };
export function pdfSafe(text) {
  return Array.from(String(text ?? '')).map((ch) => {
    if (ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(ch)) return ch;
    if (EXTRA_MAP[ch]) return EXTRA_MAP[ch];
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return base && base.charCodeAt(0) <= 0xff ? base : '?';
  }).join('');
}
