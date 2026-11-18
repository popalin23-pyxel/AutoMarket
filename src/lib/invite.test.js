import { describe, it, expect } from 'vitest';
import { appUrl, inviteMessage, shareLinks } from './invite.js';

const URL = 'https://turnify-vert.vercel.app/';

describe('invita un amico', () => {
  it('il link è l’indirizzo da cui è aperta l’app', () => {
    expect(appUrl({ origin: 'https://turnify-vert.vercel.app' })).toBe(URL);
    expect(appUrl(null)).toBe('');
  });

  it('il messaggio spiega l’app e finisce col link', () => {
    const m = inviteMessage(URL);
    expect(m).toMatch(/Horarya/);
    expect(m).toMatch(/tasse e cassa/);
    expect(m.endsWith(URL)).toBe(true);
  });

  it('WhatsApp, email e SMS ricevono tutto il messaggio; Telegram il link a parte', () => {
    const m = inviteMessage(URL);
    const l = shareLinks(m, URL);
    expect(decodeURIComponent(l.whatsapp.split('text=')[1])).toBe(m);
    expect(decodeURIComponent(l.sms.split('body=')[1])).toBe(m);
    expect(l.email).toMatch(/^mailto:\?subject=Ti%20consiglio%20Horarya&body=/);
    const tg = new globalThis.URL(l.telegram);
    expect(tg.searchParams.get('url')).toBe(URL);
    expect(tg.searchParams.get('text')).not.toContain('http');
    expect(tg.searchParams.get('text')).toMatch(/come un’app\.$/);
  });

  it('un messaggio modificato a mano resta com’è', () => {
    const m = `Guarda questa app: ${URL} 😊`;
    const l = shareLinks(m, URL);
    expect(decodeURIComponent(l.whatsapp.split('text=')[1])).toBe(m);
  });
});
