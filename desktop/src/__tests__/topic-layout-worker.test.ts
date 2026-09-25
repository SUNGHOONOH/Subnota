import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyTopicNetworkLayout,
  buildKnowledgeGraph,
  getGraphStructureSignature,
  type KnowledgeGraphEdge,
  type KnowledgeGraphNode,
} from '../features/memo/components/knowledgeGraph';
import { runTopicNetworkLayout } from '../features/memo/components/topicLayoutClient';

const nodes: KnowledgeGraphNode[] = [
  { id: 'memo:m1', kind: 'memo', label: 'M1', topicId: 't1', x: 11, y: 1 },
  { id: 'memo:m2', kind: 'memo', label: 'M2', topicId: 't1', x: 12, y: 0 },
  { id: 'memo:m3', kind: 'memo', label: 'M3', topicId: 't2', x: -11, y: 1 },
];
const edges: KnowledgeGraphEdge[] = [{ source: 'memo:m1', target: 'memo:m2', weight: 0.9 }];

describe('graph structure signature', () => {
  it('ignores label edits so typing a title does not re-run the layout', () => {
    const renamed = nodes.map(node => (node.id === 'memo:m1' ? { ...node, label: 'M1 새 제목' } : node));
    expect(getGraphStructureSignature(renamed, edges, 'force')).toBe(
      getGraphStructureSignature(nodes, edges, 'force'),
    );
  });

  it('changes when the graph itself changes', () => {
    const base = getGraphStructureSignature(nodes, edges, 'force');
    expect(getGraphStructureSignature(nodes.slice(1), edges, 'force')).not.toBe(base);
    expect(getGraphStructureSignature(nodes, [], 'force')).not.toBe(base);
    expect(getGraphStructureSignature(nodes, edges, 'preset')).not.toBe(base);
  });
});

describe('runTopicNetworkLayout', () => {
  afterEach(() => vi.unstubAllGlobals());

  const expected = () => {
    const graph = buildKnowledgeGraph(nodes, edges);
    applyTopicNetworkLayout(graph);
    return graph;
  };

  it('falls back to the synchronous layout where workers are unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    const graph = buildKnowledgeGraph(nodes, edges);
    await runTopicNetworkLayout(graph).promise;
    const reference = expected();
    graph.forEachNode((node, data) => {
      expect(data.x).toBe(reference.getNodeAttribute(node, 'x'));
      expect(data.size).toBe(reference.getNodeAttribute(node, 'size'));
    });
  });

  // Stands in for the real worker: runs the same layout on the posted graph.
  class InlineWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    terminated = false;
    static last: InlineWorker | null = null;
    constructor() {
      InlineWorker.last = this;
    }
    postMessage(serialized: Parameters<typeof import('graphology').default.from>[0]) {
      void import('graphology').then(({ default: Graph }) => {
        const graph = Graph.from(serialized);
        applyTopicNetworkLayout(graph);
        const positions: Record<string, { size: number; x: number; y: number }> = {};
        graph.forEachNode((node, data) => {
          positions[node] = { size: data.size, x: data.x, y: data.y };
        });
        if (!this.terminated) this.onmessage?.({ data: positions });
      });
    }
    terminate() {
      this.terminated = true;
    }
  }

  it('applies the positions computed off the main thread', async () => {
    vi.stubGlobal('Worker', InlineWorker);
    const graph = buildKnowledgeGraph(nodes, edges);
    await runTopicNetworkLayout(graph).promise;
    const reference = expected();
    graph.forEachNode((node, data) => {
      expect(data.x).toBe(reference.getNodeAttribute(node, 'x'));
      expect(data.y).toBe(reference.getNodeAttribute(node, 'y'));
    });
    expect(InlineWorker.last?.terminated).toBe(true);
  });

  it('drops the result of a cancelled layout', async () => {
    vi.stubGlobal('Worker', InlineWorker);
    const graph = buildKnowledgeGraph(nodes, edges);
    const request = runTopicNetworkLayout(graph);
    request.cancel();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(graph.getNodeAttribute('memo:m1', 'x')).toBe(11);
    expect(InlineWorker.last?.terminated).toBe(true);
  });
});
