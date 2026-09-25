import type Graph from 'graphology';

import { applyTopicNetworkLayout } from './knowledgeGraph';
import type { TopicLayoutPositions } from './topicLayout.worker';

/**
 * Lays out the Topics map on a worker and writes the positions back onto
 * `graph`, which Sigma then redraws. Cancelling (a newer graph replaced this
 * one) terminates the worker and drops its answer.
 */
export const runTopicNetworkLayout = (
  graph: Graph,
): { cancel: () => void; promise: Promise<void> } => {
  if (typeof Worker === 'undefined') {
    applyTopicNetworkLayout(graph);
    return { cancel: () => undefined, promise: Promise.resolve() };
  }

  const worker = new Worker(new URL('./topicLayout.worker.ts', import.meta.url), {
    type: 'module',
  });
  let isCancelled = false;
  const promise = new Promise<void>(resolve => {
    worker.onmessage = (event: MessageEvent<TopicLayoutPositions>) => {
      worker.terminate();
      if (isCancelled) return;
      graph.updateEachNodeAttributes((node, attributes) => ({
        ...attributes,
        ...event.data[node],
      }));
      resolve();
    };
    worker.onerror = error => {
      worker.terminate();
      if (isCancelled) return;
      // A broken worker must not leave the map on its seed positions.
      console.warn('Topic layout worker failed; laying out inline:', error);
      applyTopicNetworkLayout(graph);
      resolve();
    };
  });
  worker.postMessage(graph.export());
  return {
    cancel: () => {
      isCancelled = true;
      worker.terminate();
    },
    promise,
  };
};
