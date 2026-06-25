import { describe, expect, it } from 'vitest';

import {
  buildKnowledgeGraph,
  createEdgeReducer,
  createNodeReducer,
  GRAPH_COLORS,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
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
});

describe('selection reducers', () => {
  it('node reducer highlights only the current active node and follows the ref', () => {
    let active: string | null = 'a';
    const reduce = createNodeReducer(() => active);

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
