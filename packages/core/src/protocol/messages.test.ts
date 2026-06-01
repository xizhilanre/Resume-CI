// packages/core/src/protocol/messages.test.ts
import { describe, it, expect } from 'vitest';
import { isClientMessage, isServerMessage, createCmd, createCancel } from './messages';

describe('ClientMessage', () => {
  it('validates cmd message', () => {
    const msg = createCmd('jd.parse', { raw: 'hello' });
    expect(isClientMessage(msg)).toBe(true);
    expect(msg.type).toBe('cmd');
    if (msg.type !== 'cmd') throw new Error('narrow');
    expect(msg.method).toBe('jd.parse');
  });

  it('validates cancel message', () => {
    const msg = createCancel('abc-123');
    expect(isClientMessage(msg)).toBe(true);
    expect(msg.type).toBe('cancel');
    expect(msg.id).toBe('abc-123');
  });

  it('cmd has unique id', () => {
    const a = createCmd('resume.get', {});
    const b = createCmd('resume.get', {});
    expect(a.id).not.toBe(b.id);
  });
});

describe('ServerMessage', () => {
  it('validates done with result', () => {
    const msg = { type: 'done' as const, id: '1', result: { text: 'hello' } };
    expect(isServerMessage(msg)).toBe(true);
    expect(msg.result).toEqual({ text: 'hello' });
  });

  it('validates err with partial', () => {
    const msg = { type: 'err' as const, id: '1', code: 'TIMEOUT', message: 'timeout', partial: 'half' };
    expect(isServerMessage(msg)).toBe(true);
  });
});
