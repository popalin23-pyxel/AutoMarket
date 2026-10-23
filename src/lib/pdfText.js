// Il font standard di jsPDF copre solo WinAnsi (Latin-1 + pochi simboli): lettere come
// ș ț ă (rumeno) o ł (polacco) uscirebbero illeggibili. Le portiamo alla lettera base più vicina.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const EXTRA_MAP = { ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ı: 'i', ø: 'o', Ø: 'O', '−': '-' };
// emoji e loro modificatori (tono della pelle, variante, unione): nei PDF si tolgono,
// altrimenti diventerebbero "?" (es. "Notte ok ??" in un foglio ore mandato al cliente)
const EMOJI = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0e\ufe0f\u20e3]/u;
export function pdfSafe(text) {
  return Array.from(String(text ?? '')).map((ch) => {
    if (ch.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(ch)) return ch;
    if (EXTRA_MAP[ch]) return EXTRA_MAP[ch];
    if (EMOJI.test(ch)) return '';
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return base && base.charCodeAt(0) <= 0xff ? base : '?';
  }).join('').replace(/ {2,}/g, ' ').trim();
}
