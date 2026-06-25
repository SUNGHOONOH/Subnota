import Graph from 'graphology';

export interface KnowledgeGraphNode {
  color?: string;
  id: string;
  label: string;
  muted?: boolean;
  size?: number;
  x: number;
  y: number;
}

export interface KnowledgeGraphEdge {
  color?: string;
  id?: string;
  size?: number;
  source: string;
  target: string;
  weight?: number;
}

export const GRAPH_COLORS = {
  active: '#236b45',
  activeEdge: '#7f8a6f',
  defaultEdge: '#d8cebc',
  defaultNode: '#5c4d3c',
  mutedNode: '#c8bda9',
} as const;

const normalizeWeight = (weight?: number) => {
  if (!Number.isFinite(weight)) {
    return 0.5;
  }

  return Math.max(0, Math.min(weight ?? 0.5, 1));
};

// Build the graph STRUCTURE only. This is intentionally independent of the
// active selection so the memo that feeds Sigma changes (and the renderer is
// rebuilt) only when the underlying nodes/edges change — not on every click.
// Selection is applied at render time via the reducers below.
export const buildKnowledgeGraph = (
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
): Graph => {
  const graph = new Graph({ multi: true, type: 'undirected' });

  nodes.forEach(node => {
    graph.addNode(node.id, {
      color: node.color ?? (node.muted ? GRAPH_COLORS.mutedNode : GRAPH_COLORS.defaultNode),
      label: node.label,
      size: node.size ?? 8,
      x: node.x,
      y: node.y,
    });
  });

  edges.forEach((edge, index) => {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      return;
    }

    const weight = normalizeWeight(edge.weight);
    graph.addEdgeWithKey(edge.id ?? `${edge.source}-${edge.target}-${index}`, edge.source, edge.target, {
      color: edge.color ?? GRAPH_COLORS.defaultEdge,
      size: edge.size ?? 0.6 + weight * 2.4,
    });
  });

  return graph;
};

type GetActiveId = () => string | null | undefined;

// Sigma nodeReducer: highlight the active node without mutating the graph, so a
// selection change is a cheap refresh() rather than a renderer rebuild.
export const createNodeReducer =
  (getActiveId: GetActiveId) =>
  (node: string, data: Record<string, unknown>): Record<string, unknown> => {
    if (node !== getActiveId()) {
      return data;
    }

    return {
      ...data,
      color: GRAPH_COLORS.active,
      size: (typeof data.size === 'number' ? data.size : 8) + 3,
      zIndex: 1,
    };
  };

// Sigma edgeReducer: highlight edges touching the active node.
export const createEdgeReducer =
  (graph: Graph, getActiveId: GetActiveId) =>
  (edge: string, data: Record<string, unknown>): Record<string, unknown> => {
    const active = getActiveId();
    if (!active || (graph.source(edge) !== active && graph.target(edge) !== active)) {
      return data;
    }

    return { ...data, color: GRAPH_COLORS.activeEdge, zIndex: 1 };
  };
