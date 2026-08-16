import Graph from 'graphology';
import forceAtlas2, { inferSettings } from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';

export interface KnowledgeGraphNode {
  color?: string;
  forceLabel?: boolean;
  id: string;
  // Pictogram data-URI drawn as a white glyph over the node disc.
  image?: string;
  kind?: 'inbox' | 'memo' | 'root' | 'topic';
  label: string;
  memoId?: string;
  muted?: boolean;
  size?: number;
  topicId?: string | null;
  x: number;
  y: number;
}

const svgDataUri = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// White stroke glyphs (feather-style). Width/height are explicit so data-URI
// SVGs rasterize reliably inside @sigma/node-image's texture atlas.
export const NOTE_NODE_ICON = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>',
);
export const LINK_NODE_ICON = svgDataUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h3a5 5 0 0 1 0 10h-3"/><path d="M9 17H6A5 5 0 0 1 6 7h3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
);

export interface KnowledgeGraphEdge {
  color?: string;
  id?: string;
  size?: number;
  source: string;
  target: string;
  weight?: number;
}

/**
 * 그래프는 데이터다. 그래서 노드는 브랜드색이 아니라 초록 계열이다 —
 * 브랜드색을 여기 쓰면 "관련 있는 메모"와 "여기를 누르라"가 같은 색이 된다.
 *
 * 값은 로고 잎의 말라카이트(#0b6e4f)와 캘린더 기본색(#66705A)의 중간이다.
 * 로고 쪽만 쓰면 캘린더와 남남이 되고, 캘린더 쪽만 쓰면 올리브라 흰 캔버스
 * 위에서 노드가 묻힌다. 두 초록을 잇는 자리라 가운데를 쓴다.
 *
 * Sigma에 넘기는 값이라 CSS 변수를 못 쓰고 리터럴로 둔다. 세 값이 갈라지지
 * 않도록 바꿀 때는 `_color-tokens.scss`의 두 원본을 같이 확인할 것.
 */
export const GRAPH_NODE_COLOR = '#396f55';

export const GRAPH_COLORS = {
  active: '#1d1d1f',
  activeEdge: GRAPH_NODE_COLOR,
  defaultEdge: '#e6e3dd',
  defaultNode: GRAPH_NODE_COLOR,
  mutedNode: '#c7c3bb',
} as const;

/** 수집함에서 온 노드. 메모(초록)와 구분되는 중립 회청색. */
export const GRAPH_INBOX_NODE = '#6d7185';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// A surrounding-memo map needs an absolute floor so a weak search result
// cannot masquerade as a strong match. Within that truthful range, give the
// local ranking a modest lift: otherwise 100% and 52% occupy nearly the same
// visual weight in a small result set.
export const getSimilarityMapGeometry = (
  similarity: number,
  lowestSimilarity: number,
  highestSimilarity: number,
  minimumSimilarity: number,
) => {
  const score = clamp(similarity, 0, 1);
  const absoluteWeight = clamp(
    (score - minimumSimilarity) / (1 - minimumSimilarity),
    0,
    1,
  );
  const span = Math.max(highestSimilarity - lowestSimilarity, 0);
  const relativeWeight =
    span >= 0.08 ? clamp((score - lowestSimilarity) / span, 0, 1) : absoluteWeight;
  const visualWeight = clamp(
    absoluteWeight + relativeWeight * (1 - absoluteWeight) * 0.35,
    0,
    1,
  );

  return {
    distance: 1.35 - visualWeight * 0.95,
    size: 7.5 + visualWeight * 15.5,
  };
};

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
    if (!node.id || graph.hasNode(node.id)) {
      return;
    }
    graph.addNode(node.id, {
      color: node.color ?? (node.muted ? GRAPH_COLORS.mutedNode : GRAPH_COLORS.defaultNode),
      forceLabel: node.forceLabel,
      kind: node.kind,
      label: node.label,
      memoId: node.memoId,
      size: node.size ?? 8,
      topicId: node.topicId,
      x: Number.isFinite(node.x) ? node.x : 0,
      y: Number.isFinite(node.y) ? node.y : 0,
      // Icon nodes: disc + white pictogram (compound 'icon' program).
      ...(node.image
        ? { image: node.image, type: 'icon' }
        : {}),
      // Topic hubs get a dark ring (border node program) so they read as a
      // different species from memo nodes at a glance. Wins over the icon.
      ...(node.kind === 'topic'
        ? { borderColor: GRAPH_COLORS.active, type: 'border' }
        : {}),
    });
  });

  edges.forEach((edge, index) => {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      return;
    }

    const edgeId = edge.id ?? `${edge.source}-${edge.target}-${index}`;
    if (graph.hasEdge(edgeId)) {
      return;
    }

    const weight = normalizeWeight(edge.weight);
    graph.addEdgeWithKey(edgeId, edge.source, edge.target, {
      color: edge.color ?? GRAPH_COLORS.defaultEdge,
      size: edge.size ?? 0.6 + weight * 2.4,
      weight,
    });
  });

  return graph;
};

// Topic-map layout: the x/y passed into buildKnowledgeGraph are only a seed.
// Seeded ForceAtlas2 (similarity as edge weight) pulls related memos into
// organic islands and pushes clusters apart; noverlap then removes stacking.
// Memo node size becomes weighted degree so well-connected memos read bigger.
// Deterministic: same nodes/edges + same seed positions → same layout.
export const applyTopicNetworkLayout = (graph: Graph) => {
  if (graph.order < 2) {
    return;
  }

  graph.forEachNode((node, data) => {
    if (data.kind !== 'memo') {
      return;
    }

    let weightedDegree = 0;
    graph.forEachEdge(node, (_edge, edgeData) => {
      weightedDegree += typeof edgeData.weight === 'number' ? edgeData.weight : 0.5;
    });
    graph.setNodeAttribute(
      node,
      'size',
      Math.min(11, Math.max(4.5, 4 + weightedDegree * 1.6)),
    );
  });

  // ponytail: synchronous layout, fine up to a few thousand nodes; switch to
  // graphology-layout-forceatlas2/worker if graph build ever janks the UI.
  forceAtlas2.assign(graph, {
    iterations: 200,
    settings: {
      ...inferSettings(graph),
      edgeWeightInfluence: 1,
    },
  });
  noverlap.assign(graph, {
    maxIterations: 60,
    settings: { margin: 2, ratio: 1.1 },
  });
};

interface TopicBridgeEdge {
  similarity: number;
  sourceTopicId?: string | null;
  targetTopicId?: string | null;
}

// Intra-topic edges all pass through; cross-topic pairs keep only their
// strongest few bridges so inter-cluster links read as bridges, not spaghetti
// (same policy as the rail Topics map).
export const capCrossTopicBridges = <T extends TopicBridgeEdge>(
  edges: T[],
  limit: number,
): T[] => {
  const kept: T[] = [];
  const bridgesByTopicPair = new Map<string, T[]>();

  edges.forEach(edge => {
    const isIntraTopic =
      Boolean(edge.sourceTopicId) && edge.sourceTopicId === edge.targetTopicId;

    if (isIntraTopic) {
      kept.push(edge);
      return;
    }

    const pairKey = [edge.sourceTopicId ?? '', edge.targetTopicId ?? '']
      .sort()
      .join('>');
    const bridges = bridgesByTopicPair.get(pairKey) ?? [];
    bridges.push(edge);
    bridgesByTopicPair.set(pairKey, bridges);
  });

  bridgesByTopicPair.forEach(bridges => {
    kept.push(
      ...bridges.sort((a, b) => b.similarity - a.similarity).slice(0, limit),
    );
  });

  return kept;
};

interface MemoEdgeLike {
  similarity: number;
  sourceMemoId: string;
  sourceTopicId?: string | null;
  targetMemoId: string;
  targetTopicId?: string | null;
}

// Sparsify intra-topic edges to a per-memo KNN union. BGE-M3 similarities sit
// in a narrow band (our data: p50≈0.44, real matches ≥0.7), so an absolute
// floor alone keeps near-complete cliques — an edge survives only when it is
// among the top K strongest for either endpoint AND above the floor.
// Cross-topic edges pass through untouched (capCrossTopicBridges handles them).
export const capIntraTopicEdges = <T extends MemoEdgeLike>(
  edges: T[],
  topK: number,
  minSimilarity: number,
): T[] => {
  const isIntraTopic = (edge: T) =>
    Boolean(edge.sourceTopicId) && edge.sourceTopicId === edge.targetTopicId;

  const edgesByMemo = new Map<string, T[]>();
  edges.forEach(edge => {
    if (!isIntraTopic(edge)) {
      return;
    }
    for (const memoId of [edge.sourceMemoId, edge.targetMemoId]) {
      const list = edgesByMemo.get(memoId) ?? [];
      list.push(edge);
      edgesByMemo.set(memoId, list);
    }
  });

  const kept = new Set<T>();
  edgesByMemo.forEach(list => {
    [...list]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .forEach(edge => kept.add(edge));
  });

  return edges.filter(
    edge =>
      !isIntraTopic(edge) ||
      (kept.has(edge) && edge.similarity >= minSimilarity),
  );
};

type GetActiveId = () => string | null | undefined;
type GetHoveredId = () => string | null | undefined;
type GetFocusedTopicId = () => string | null | undefined;

const getStringAttribute = (data: Record<string, unknown>, key: string) =>
  typeof data[key] === 'string' ? data[key] : null;

const isNodeRelatedToHovered = (
  graph: Graph,
  node: string,
  data: Record<string, unknown>,
  hovered: string,
) => {
  // An edge-less similarity map uses spatial distance, not graph adjacency.
  // Keep every point legible while a result is hovered.
  if (graph.size === 0) {
    return true;
  }

  if (node === hovered || !graph.hasNode(hovered)) {
    return true;
  }

  if (graph.neighbors(hovered).includes(node)) {
    return true;
  }

  const hoveredData = graph.getNodeAttributes(hovered) as Record<string, unknown>;
  const hoveredTopicId = getStringAttribute(hoveredData, 'topicId');
  const nodeTopicId = getStringAttribute(data, 'topicId');

  return Boolean(hoveredTopicId && nodeTopicId === hoveredTopicId);
};

// Sigma nodeReducer: highlight the active node without mutating the graph, so a
// selection change is a cheap refresh() rather than a renderer rebuild.
export const createNodeReducer =
  (
    graph: Graph,
    getActiveId: GetActiveId,
    getHoveredId: GetHoveredId = () => null,
    getFocusedTopicId: GetFocusedTopicId = () => null,
  ) =>
  (node: string, data: Record<string, unknown>): Record<string, unknown> => {
    const focusedTopicId = getFocusedTopicId();
    const nodeTopicId = getStringAttribute(data, 'topicId');
    if (focusedTopicId && nodeTopicId !== focusedTopicId) {
      return {
        ...data,
        color: GRAPH_COLORS.mutedNode,
        forceLabel: false,
        size: Math.max((typeof data.size === 'number' ? data.size : 8) - 1, 3),
        zIndex: 0,
      };
    }

    const active = getActiveId();
    if (node === active) {
      return {
        ...data,
        color: GRAPH_COLORS.active,
        forceLabel: true,
        size: (typeof data.size === 'number' ? data.size : 8) + 3,
        zIndex: 2,
      };
    }

    const hovered = getHoveredId();
    if (!hovered || isNodeRelatedToHovered(graph, node, data, hovered)) {
      if (!hovered) {
        return data;
      }

      return {
        ...data,
        forceLabel: Boolean(data.forceLabel) || node === hovered || getStringAttribute(data, 'kind') === 'memo',
        zIndex: 1,
      };
    }

    return {
      ...data,
      color: GRAPH_COLORS.mutedNode,
      forceLabel: false,
      size: Math.max((typeof data.size === 'number' ? data.size : 8) - 1, 3),
      zIndex: 0,
    };
  };

// Sigma edgeReducer: highlight edges touching the active node.
export const createEdgeReducer =
  (
    graph: Graph,
    getActiveId: GetActiveId,
    getHoveredId: GetHoveredId = () => null,
    getFocusedTopicId: GetFocusedTopicId = () => null,
  ) =>
  (edge: string, data: Record<string, unknown>): Record<string, unknown> => {
    const focusedTopicId = getFocusedTopicId();
    if (focusedTopicId) {
      const sourceTopicId = getStringAttribute(
        graph.getNodeAttributes(graph.source(edge)) as Record<string, unknown>,
        'topicId',
      );
      const targetTopicId = getStringAttribute(
        graph.getNodeAttributes(graph.target(edge)) as Record<string, unknown>,
        'topicId',
      );
      if (sourceTopicId !== focusedTopicId || targetTopicId !== focusedTopicId) {
        return { ...data, color: GRAPH_COLORS.defaultEdge, size: 0.35, zIndex: 0 };
      }
    }

    const active = getActiveId();
    const source = graph.source(edge);
    const target = graph.target(edge);
    if (active && (source === active || target === active)) {
      return { ...data, color: GRAPH_COLORS.activeEdge, zIndex: 2 };
    }

    const hovered = getHoveredId();
    if (!hovered || source === hovered || target === hovered || !graph.hasNode(hovered)) {
      return data;
    }

    const hoveredTopicId = getStringAttribute(
      graph.getNodeAttributes(hovered) as Record<string, unknown>,
      'topicId',
    );
    const sourceTopicId = getStringAttribute(
      graph.getNodeAttributes(source) as Record<string, unknown>,
      'topicId',
    );
    const targetTopicId = getStringAttribute(
      graph.getNodeAttributes(target) as Record<string, unknown>,
      'topicId',
    );
    if (hoveredTopicId && sourceTopicId === hoveredTopicId && targetTopicId === hoveredTopicId) {
      return { ...data, zIndex: 1 };
    }

    return { ...data, color: GRAPH_COLORS.defaultEdge, size: 0.35, zIndex: 0 };
  };
