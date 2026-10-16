import { describe, it, expect } from 'vitest';
import { roleLabel, professionalHeaderLines } from './defaults.js';

describe('Anagrafica: ruolo e intestazione dei report', () => {
  it('roleLabel restituisce l\'etichetta del ruolo scelto', () => {
    expect(roleLabel({ professionalRole: 'medico' })).toBe('Medico');
    expect(roleLabel({ professionalRole: 'infermiere' })).toBe('Infermiere');
    expect(roleLabel({ professionalRole: 'infermiera' })).toBe('Infermiera');
    expect(roleLabel({ professionalRole: 'medica' })).toBe('Medica');
  });

  it('con "Altro" usa il testo libero, e vuoto se non specificato', () => {
    expect(roleLabel({ professionalRole: 'altro', professionalRoleOther: ' Fisioterapista ' })).toBe('Fisioterapista');
    expect(roleLabel({ professionalRole: 'altro', professionalRoleOther: '' })).toBe('');
  });

  it('ruolo non impostato o impostazioni mancanti → stringa vuota', () => {
    expect(roleLabel({ professionalRole: '' })).toBe('');
    expect(roleLabel(undefined)).toBe('');
  });

  it('l\'intestazione include solo i campi compilati', () => {
    expect(professionalHeaderLines({ displayName: 'Maria Rossi', professionalRole: 'infermiera', vatNumber: '012345' }))
      .toEqual(['Maria Rossi', 'Infermiera', 'P.IVA / Albo: 012345']);
    expect(professionalHeaderLines({ displayName: '  ', professionalRole: '', vatNumber: '' })).toEqual([]);
  });
});
