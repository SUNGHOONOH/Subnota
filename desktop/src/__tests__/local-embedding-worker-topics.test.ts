import { afterEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  topics: vi.fn(async () => [['치과']]),
}));

vi.mock('../local-embedding-runtime', () => ({
  createLocalEmbeddingRuntime: () => ({
    embed: vi.fn(),
    ensure: vi.fn(),
    releaseAll: vi.fn(),
    releaseIndex: vi.fn(),
    topics: runtime.topics,
  }),
}));

const originalParentPort = Object.getOwnPropertyDescriptor(process, 'parentPort');

afterEach(() => {
  if (originalParentPort) Object.defineProperty(process, 'parentPort', originalParentPort);
  else Reflect.deleteProperty(process, 'parentPort');
});

describe('embedding worker topic requests', () => {
  it('rejects malformed requests before calling the A.X runtime', async () => {
    const responses: Array<{ id?: number; ok?: boolean; error?: string; result?: unknown }> = [];
    let receive: ((event: { data: unknown }) => void) | undefined;
    Object.defineProperty(process, 'parentPort', {
      configurable: true,
      value: {
        on: (_event: string, callback: typeof receive) => { receive = callback; },
        postMessage: (response: typeof responses[number]) => { responses.push(response); },
      },
    });
    vi.resetModules();
    await import('../local-embedding-worker');
    receive?.({ data: { id: 1, method: 'initialize', cacheDirectory: '/tmp/subnota-topic-worker-test' } });
    await vi.waitFor(() => expect(responses.some(response => response.id === 1 && response.ok)).toBe(true));

    receive?.({ data: { id: 2, method: 'topics', texts: [123] } });
    receive?.({ data: { id: 3, method: 'topics', texts: Array(65).fill('메모') } });
    await vi.waitFor(() => expect(responses.filter(response => response.id === 2 || response.id === 3)).toHaveLength(2));
    expect(responses.filter(response => response.id === 2 || response.id === 3).every(
      response => response.ok === false && response.error === 'Invalid topic extraction input.',
    )).toBe(true);
    expect(runtime.topics).not.toHaveBeenCalled();

    receive?.({ data: { id: 4, method: 'topics', texts: ['치과 예약'] } });
    await vi.waitFor(() => expect(responses.find(response => response.id === 4)).toMatchObject({
      ok: true,
      result: [['치과']],
    }));
  });
});
