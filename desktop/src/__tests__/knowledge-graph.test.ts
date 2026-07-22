import { describe, expect, it } from 'vitest';

import {
  applyTopicNetworkLayout,
  buildKnowledgeGraph,
  capCrossTopicBridges,
  capIntraTopicEdges,
  createEdgeReducer,
  createNodeReducer,
  GRAPH_COLORS,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  LINK_NODE_ICON,
  NOTE_NODE_ICON,
} from '../features/memo/components/knowledgeGraph';

const nodes: KnowledgeGraphNode[] = [
  { id: 'a', label: 'A', x: 0, y: 0 },
  { id: 'b', label: 'B', muted: true, x: 1, y: 1 },
  { id: 'c', label: 'C', x: 2, y: 2 },
];

const edges: KnowledgeGraphEdge[] = [
  { source: 'a', target: 'b', weight: 0.8 },
  { source: 'b', target: 'c', weight: 0.4 },
];

describe('buildKnowledgeGraph', () => {
  it('builds identical structure regardless of selection (renderer is not rebuilt on click)', () => {
    const first = buildKnowledgeGraph(nodes, edges);
    const second = buildKnowledgeGraph(nodes, edges);

    expect(first.order).toBe(3);
    expect(first.size).toBe(2);
    expect(second.order).toBe(first.order);
    expect(second.size).toBe(first.size);

    // Base attributes carry NO active styling — selection is applied by the
    // reducers at render time, so the graph (and thus the Sigma renderer) only
    // changes when nodes/edges change.
    expect(first.getNodeAttribute('a', 'color')).toBe(GRAPH_COLORS.defaultNode);
    expect(first.getNodeAttribute('b', 'color')).toBe(GRAPH_COLORS.mutedNode);
    expect(first.getNodeAttribute('a', 'size')).toBe(8);
  });

  it('drops edges whose endpoints are missing', () => {
    const graph = buildKnowledgeGraph(nodes, [{ source: 'a', target: 'missing' }]);
    expect(graph.size).toBe(0);
  });

  it('ignores duplicate node and edge ids instead of crashing the view', () => {
    const graph = buildKnowledgeGraph(
      [nodes[0], { ...nodes[0], label: 'Duplicate' }, nodes[1]],
      [
        { id: 'same-edge', source: 'a', target: 'b' },
        { id: 'same-edge', source: 'a', target: 'b' },
      ],
    );

    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1);
    expect(graph.getNodeAttribute('a', 'label')).toBe('A');
  });

  it('normalizes invalid node coordinates', () => {
    const graph = buildKnowledgeGraph(
      [{ id: 'invalid', label: 'Invalid', x: Number.NaN, y: Infinity }],
      [],
    );

    expect(graph.getNodeAttribute('invalid', 'x')).toBe(0);
    expect(graph.getNodeAttribute('invalid', 'y')).toBe(0);
  });
});

describe('selection reducers', () => {
  it('node reducer highlights only the current active node and follows the ref', () => {
    const graph = buildKnowledgeGraph(nodes, edges);
    let active: string | null = 'a';
    const reduce = createNodeReducer(graph, () => active);

    expect(reduce('a', { color: GRAPH_COLORS.defaultNode, size: 8 })).toMatchObject({
      color: GRAPH_COLORS.active,
      size: 11,
    });
    expect(reduce('b', { color: GRAPH_COLORS.mutedNode, size: 8 })).toMatchObject({
      color: GRAPH_COLORS.mutedNode,
    });

    active = 'b';
    expect(reduce('b', { color: GRAPH_COLORS.mutedNode, size: 8 })).toMatchObject({
      color: GRAPH_COLORS.active,
    });
    expect(reduce('a', { color: GRAPH_COLORS.defaultNode, size: 8 })).toMatchObject({
      color: GRAPH_COLORS.defaultNode,
    });
  });

  it('node reducer mutes unrelated nodes while hovering', () => {
    const graph = buildKnowledgeGraph(
      [
        { id: 'topic:t1', kind: 'topic', label: 'T1', topicId: 't1', x: 0, y: 0 },
        { id: 'memo:m1', kind: 'memo', label: 'M1', topicId: 't1', x: 1, y: 0 },
        { id: 'topic:t2', kind: 'topic', label: 'T2', topicId: 't2', x: 2, y: 0 },
      ],
      [{ source: 'topic:t1', target: 'memo:m1' }],
    );
    const reduce = createNodeReducer(graph, () => null, () => 'topic:t1');

    expect(reduce('memo:m1', { kind: 'memo', topicId: 't1', size: 8 })).toMatchObject({
      forceLabel: true,
    });
    expect(reduce('topic:t2', { kind: 'topic', topicId: 't2', size: 8 })).toMatchObject({
      color: GRAPH_COLORS.mutedNode,
      forceLabel: false,
    });
  });

  it('edge reducer highlights only edges touching the active node', () => {
    const graph = buildKnowledgeGraph(nodes, edges);
    const [edgeAB, edgeBC] = graph.edges();
    let active: string | null = 'a';
    const reduce = createEdgeReducer(graph, () => active);

    expect(reduce(edgeAB, { color: GRAPH_COLORS.defaultEdge })).toMatchObject({
      color: GRAPH_COLORS.activeEdge,
    });
    expect(reduce(edgeBC, { color: GRAPH_COLORS.defaultEdge })).toMatchObject({
      color: GRAPH_COLORS.defaultEdge,
    });

    active = null;
    expect(reduce(edgeAB, { color: GRAPH_COLORS.defaultEdge })).toMatchObject({
      color: GRAPH_COLORS.defaultEdge,
    });
  });
});

describe('applyTopicNetworkLayout', () => {
  // Two seeded clusters: t1 owns m1/m2 (densely linked), t2 owns m3.
  const clusterNodes: KnowledgeGraphNode[] = [
    { id: 'topic:t1', kind: 'topic', label: 'T1', topicId: 't1', x: 10, y: 0 },
    { id: 'memo:m1', kind: 'memo', label: 'M1', topicId: 't1', x: 11, y: 1 },
    { id: 'memo:m2', kind: 'memo', label: 'M2', topicId: 't1', x: 12, y: 0 },
    { id: 'topic:t2', kind: 'topic', label: 'T2', topicId: 't2', x: -10, y: 0 },
    { id: 'memo:m3', kind: 'memo', label: 'M3', topicId: 't2', x: -11, y: 1 },
  ];
  const clusterEdges: KnowledgeGraphEdge[] = [
    { source: 'topic:t1', target: 'memo:m1', weight: 0.7 },
    { source: 'topic:t1', target: 'memo:m2', weight: 0.6 },
    { source: 'memo:m1', target: 'memo:m2', weight: 0.9 },
    { source: 'topic:t2', target: 'memo:m3', weight: 0.7 },
  ];

  const layout = () => {
    const graph = buildKnowledgeGraph(clusterNodes, clusterEdges);
    applyTopicNetworkLayout(graph);
    return graph;
  };

  it('sizes memo nodes by weighted degree and leaves topic nodes alone', () => {
    const graph = layout();

    const m1 = graph.getNodeAttribute('memo:m1', 'size') as number;
    const m3 = graph.getNodeAttribute('memo:m3', 'size') as number;
    expect(m1).toBeGreaterThan(m3);
    expect(graph.getNodeAttribute('topic:t1', 'size')).toBe(8);
  });

  it('is deterministic and moves nodes away from their seed positions', () => {
    const first = layout();
    const second = layout();

    first.forEachNode((node, data) => {
      expect(second.getNodeAttribute(node, 'x')).toBe(data.x);
      expect(second.getNodeAttribute(node, 'y')).toBe(data.y);
    });
    expect(first.getNodeAttribute('memo:m1', 'x')).not.toBe(11);
  });

  it('keeps linked memos closer than memos from another cluster', () => {
    const graph = layout();
    const distance = (a: string, b: string) =>
      Math.hypot(
        (graph.getNodeAttribute(a, 'x') as number) -
          (graph.getNodeAttribute(b, 'x') as number),
        (graph.getNodeAttribute(a, 'y') as number) -
          (graph.getNodeAttribute(b, 'y') as number),
      );

    expect(distance('memo:m1', 'memo:m2')).toBeLessThan(distance('memo:m1', 'memo:m3'));
  });
});

describe('capCrossTopicBridges', () => {
  const edge = (
    sourceTopicId: string | null,
    targetTopicId: string | null,
    similarity: number,
  ) => ({ similarity, sourceTopicId, targetTopicId });

  it('keeps every intra-topic edge', () => {
    const edges = [edge('t1', 't1', 0.2), edge('t1', 't1', 0.1)];

    expect(capCrossTopicBridges(edges, 1)).toEqual(edges);
  });

  it('keeps only the strongest bridges per topic pair', () => {
    // Bug repro: the split Topics tab rendered EVERY cross-topic edge, turning
    // the map into spaghetti; only the top bridges per pair should survive.
    const weak = edge('t1', 't2', 0.1);
    const strong = edge('t1', 't2', 0.9);
    const mid = edge('t2', 't1', 0.5);

    expect(capCrossTopicBridges([weak, strong, mid], 2)).toEqual([strong, mid]);
  });

  it('caps pairs independently', () => {
    const ab = edge('a', 'b', 0.9);
    const ac = edge('a', 'c', 0.8);

    expect(capCrossTopicBridges([ab, ac], 1)).toEqual([ab, ac]);
  });
});

describe('capIntraTopicEdges', () => {
  const edge = (
    sourceMemoId: string,
    targetMemoId: string,
    topicId: string | null,
    similarity: number,
  ) => ({
    similarity,
    sourceMemoId,
    sourceTopicId: topicId,
    targetMemoId,
    targetTopicId: topicId,
  });

  it('keeps only each memo top-K strongest intra-topic edges (union)', () => {
    // Bug repro: backend ships top-8 per node, so a 10-memo cluster renders as
    // a near-complete clique; the split map must sparsify to a KNN union.
    const ab = edge('a', 'b', 't1', 0.9);
    const ac = edge('a', 'c', 't1', 0.8);
    const bc = edge('b', 'c', 't1', 0.7);

    // topK=1: ab is strongest for both a and b; ac is not top-1 for a but is
    // top-1 for c → kept via the union; bc is top-1 for neither.
    expect(capIntraTopicEdges([ab, ac, bc], 1, 0)).toEqual([ab, ac]);
  });

  it('drops intra edges below the similarity floor even inside top-K', () => {
    const weak = edge('a', 'b', 't1', 0.4);

    expect(capIntraTopicEdges([weak], 3, 0.45)).toEqual([]);
  });

  it('passes cross-topic edges through untouched', () => {
    const cross = {
      similarity: 0.2,
      sourceMemoId: 'a',
      sourceTopicId: 't1',
      targetMemoId: 'x',
      targetTopicId: 't2',
    };

    expect(capIntraTopicEdges([cross], 1, 0.9)).toEqual([cross]);
  });
});

describe('topic node border', () => {
  it('gives topic nodes a border type and dark ring, memo nodes none', () => {
    const graph = buildKnowledgeGraph(
      [
        { id: 'topic:t1', kind: 'topic', label: 'T', x: 0, y: 0 },
        { id: 'memo:m1', kind: 'memo', label: 'M', x: 1, y: 1 },
      ],
      [],
    );

    expect(graph.getNodeAttribute('topic:t1', 'type')).toBe('border');
    expect(graph.getNodeAttribute('topic:t1', 'borderColor')).toBe(
      GRAPH_COLORS.active,
    );
    expect(graph.getNodeAttribute('memo:m1', 'type')).toBeUndefined();
  });
});

describe('node icons', () => {
  it('gives icon nodes the pictogram compound type', () => {
    const graph = buildKnowledgeGraph(
      [
        { id: 'network:a', image: NOTE_NODE_ICON, label: 'A', x: 0, y: 0 },
        { id: 'network:b', label: 'B', x: 1, y: 1 },
      ],
      [],
    );

    expect(graph.getNodeAttribute('network:a', 'type')).toBe('icon');
    expect(graph.getNodeAttribute('network:a', 'image')).toBe(NOTE_NODE_ICON);
    expect(graph.getNodeAttribute('network:a', 'pictogramColor')).toBeUndefined();
    expect(graph.getNodeAttribute('network:b', 'type')).toBeUndefined();
  });

  it('keeps the border type on topic hubs even when an image is set', () => {
    const graph = buildKnowledgeGraph(
      [{ id: 'topic:t', image: LINK_NODE_ICON, kind: 'topic', label: 'T', x: 0, y: 0 }],
      [],
    );

    expect(graph.getNodeAttribute('topic:t', 'type')).toBe('border');
  });
});
