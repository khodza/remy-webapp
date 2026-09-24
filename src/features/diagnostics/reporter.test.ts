import { describe, expect, it } from 'vitest';
import type { ClientErrorReport } from '@/shared/api';
import { ClientErrorReportSchema } from '@/shared/api';
import { createErrorReporter, describeError, routeFromHash, scrubSecrets } from './reporter';

function setup(overrides: Partial<Parameters<typeof createErrorReporter>[0]> = {}) {
  const sent: ClientErrorReport[] = [];
  let clock = Date.parse('2026-09-23T08:00:00Z');
  const reporter = createErrorReporter({
    send: async (report) => {
      sent.push(report);
    },
    now: () => clock,
    appVersion: '0.1.0',
    userAgent: 'TestAgent/1.0',
    ...overrides,
  });
  return { reporter, sent, tick: (ms: number) => (clock += ms) };
}

describe('createErrorReporter', () => {
  it('sends a contract-valid report with version, agent, route and time', () => {
    const { reporter, sent } = setup();
    expect(
      reporter.report({ message: 'TypeError: x is undefined', kind: 'error', stack: 'at foo', url: '/tasks/abc' }),
    ).toBe(true);
    expect(sent).toHaveLength(1);
    expect(ClientErrorReportSchema.parse(sent[0])).toEqual({
      message: 'TypeError: x is undefined',
      kind: 'error',
      stack: 'at foo',
      url: '/tasks/abc',
      userAgent: 'TestAgent/1.0',
      appVersion: '0.1.0',
      at: '2026-09-23T08:00:00.000Z',
    });
  });

  it('sends an identical message once a minute, and different ones up to five a minute', () => {
    const { reporter, sent, tick } = setup();
    expect(reporter.report({ message: 'same', kind: 'error' })).toBe(true);
    expect(reporter.report({ message: 'same', kind: 'error' })).toBe(false);
    // Another kind is another report.
    expect(reporter.report({ message: 'same', kind: 'api' })).toBe(true);
    for (let i = 0; i < 3; i += 1) expect(reporter.report({ message: `other ${i}`, kind: 'error' })).toBe(true);
    // Sixth in the minute: over budget.
    expect(reporter.report({ message: 'one too many', kind: 'error' })).toBe(false);
    expect(sent).toHaveLength(5);

    tick(60_000);
    expect(reporter.report({ message: 'same', kind: 'error' })).toBe(true);
    expect(reporter.report({ message: 'one too many', kind: 'error' })).toBe(true);
    expect(sent).toHaveLength(7);
  });

  it('never carries initData, tokens or JWTs', () => {
    const { reporter, sent } = setup();
    reporter.report({
      message:
        'Request failed with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop and tma user=%7B%7D&hash=deadbeef',
      kind: 'api',
      stack: 'at fetch (initDataRaw=user%3D1%26auth_date%3D123%26hash%3Dabc)',
      url: '/?tgWebAppData=secret&day=2026-09-24',
    });
    const text = JSON.stringify(sent[0]);
    expect(text).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(text).not.toContain('deadbeef');
    expect(text).not.toContain('tgWebAppData=secret');
    expect(text).not.toContain('user%3D1');
    expect(text).toContain('Bearer [redacted]');
    expect(text).toContain('tma [redacted]');
    expect(scrubSecrets('open ?hash=deadbeef&day=1')).toBe('open ?hash=[redacted]&day=1');
  });

  it('keeps every field inside the contract limits', () => {
    const { reporter, sent } = setup({ appVersion: 'v'.repeat(100), userAgent: 'u'.repeat(600) });
    reporter.report({ message: 'm'.repeat(2000), kind: 'error', stack: 's'.repeat(9000), url: `/${'p'.repeat(3000)}` });
    expect(() => ClientErrorReportSchema.parse(sent[0])).not.toThrow();
  });

  it('drops an empty message and survives a failing send', async () => {
    const { reporter, sent } = setup();
    expect(reporter.report({ message: '   ', kind: 'error' })).toBe(false);
    expect(sent).toHaveLength(0);
    const failing = createErrorReporter({ send: () => Promise.reject(new Error('down')) });
    expect(failing.report({ message: 'boom', kind: 'error' })).toBe(true);
    await Promise.resolve();
  });
});

describe('helpers', () => {
  it('reads the route out of the hash without its query', () => {
    expect(routeFromHash('#/tasks/64b?day=2026-09-24')).toBe('/tasks/64b');
    expect(routeFromHash('#/')).toBe('/');
    expect(routeFromHash('')).toBe('/');
  });

  it('describes errors, strings and objects', () => {
    const error = new TypeError('bad');
    expect(describeError(error).message).toBe('TypeError: bad');
    expect(describeError(error).stack).toBeDefined();
    expect(describeError('plain')).toEqual({ message: 'plain' });
    expect(describeError({ a: 1 })).toEqual({ message: '{"a":1}' });
  });

  it('scrubs secrets case-insensitively', () => {
    expect(scrubSecrets('TMA abc.def')).toBe('TMA [redacted]');
    expect(scrubSecrets('signature=xyz&auth_date=1')).toBe('signature=[redacted]&auth_date=[redacted]');
  });
});
