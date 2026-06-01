// packages/core/src/adapters/mock.adapter.test.ts
import { describe, it, expect } from 'vitest';
import { MockAdapter } from './mock.adapter';

describe('MockAdapter', () => {
  it('parseJD returns mock parsed result', async () => {
    const adapter = new MockAdapter();
    const result = await adapter.parseJD('需要熟悉 React 和 TypeScript');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('techStack');
  });

  it('discoverProjects yields 3 cards', async () => {
    const adapter = new MockAdapter();
    const cards: unknown[] = [];
    for await (const chunk of adapter.discoverProjects({})) {
      cards.push(chunk);
    }
    // Mock 投喂 3 次，每次 1 张卡片
    expect(cards.length).toBe(3);
  });

  it('cancel stops a running command', async () => {
    const adapter = new MockAdapter();
    const id = adapter.send('export.pdf', {});
    adapter.cancel(id);
    // cancel 是同步操作，不应抛错
  });

  it('send returns unique ids', () => {
    const adapter = new MockAdapter();
    const a = adapter.send('resume.get', {});
    const b = adapter.send('resume.get', {});
    expect(a).not.toBe(b);
  });
});
