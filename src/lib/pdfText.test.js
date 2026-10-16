import { describe, it, expect } from 'vitest';
import { pdfSafe } from './pdfText.js';

describe('pdfSafe: testo leggibile nel PDF con il font standard', () => {
  it('lascia invariati italiano, accenti latini e simboli supportati', () => {
    expect(pdfSafe('Niccolò Bianchi – Infermiera, €1.234')).toBe('Niccolò Bianchi – Infermiera, €1.234');
  });

  it('porta alla lettera base i caratteri non supportati (es. rumeno, polacco)', () => {
    expect(pdfSafe('Ștefănescu Țurcanu')).toBe('Stefanescu Turcanu');
    expect(pdfSafe('Łukasz')).toBe('Lukasz');
  });

  it('caratteri senza equivalente latino diventano "?" invece di testo illeggibile', () => {
    expect(pdfSafe('王')).toBe('?');
  });

  it('gestisce valori mancanti', () => {
    expect(pdfSafe(undefined)).toBe('');
  });
});
