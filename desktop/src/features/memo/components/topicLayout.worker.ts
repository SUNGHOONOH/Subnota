import Graph from 'graphology';

import { applyTopicNetworkLayout } from './knowledgeGraph';

export type TopicLayoutPositions = Record<string, { size: number; x: number; y: number }>;

// ForceAtlas2 + noverlap take seconds on large notebooks (2,000 notes ≈ 3s,
// 5,000 ≈ 10s on an M-series Mac). Here they cannot block typing or clicks.
self.onmessage = (event: MessageEvent<ReturnType<Graph['export']>>) => {
  const graph = Graph.from(event.data);
  applyTopicNetworkLayout(graph);
  const positions: TopicLayoutPositions = {};
  graph.forEachNode((node, data) => {
    positions[node] = { size: data.size, x: data.x, y: data.y };
  });
  self.postMessage(positions);
};
