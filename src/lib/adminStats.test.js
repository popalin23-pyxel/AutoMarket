import { describe, it, expect } from 'vitest';
import { accountStats } from '../components/AdminTab.jsx';

describe('accountStats', () => {
  const now = new Date('2026-11-24T12:00:00Z').getTime();
  const rows = [
    { id: 'a', role: 'admin', approved: true, created_at: '2026-01-10T10:00:00Z' },
    { id: 'b', role: 'user', approved: true, created_at: '2026-11-22T10:00:00Z' },
    { id: 'c', role: 'user', approved: false, created_at: '2026-11-05T10:00:00Z' },
    { id: 'd', role: 'user', approved: true, created_at: '2026-09-01T10:00:00Z' },
  ];
  it('conta totale, nuovi e bloccati', () => {
    expect(accountStats(rows, now)).toEqual({ total: 4, week: 1, month: 2, blocked: 1 });
  });
  it('elenco vuoto', () => {
    expect(accountStats([], now)).toEqual({ total: 0, week: 0, month: 0, blocked: 0 });
  });
});
