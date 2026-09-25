import { useCallback, useState } from 'react';

import type {
  MemoSimilarityEdge,
  TopicCluster,
  TopicInboxMembership,
  TopicMapData,
  TopicMemoInboxEdge,
  TopicMembership,
} from '../../types';

export const useTopicMapState = () => {
  const [topicClusters, setTopicClusters] = useState<TopicCluster[]>([]);
  const [topicUpdatedAt, setTopicUpdatedAt] = useState<string | null>(null);
  const [topicGlobalEdges, setTopicGlobalEdges] = useState<MemoSimilarityEdge[]>([]);
  const [topicInboxEdges, setTopicInboxEdges] = useState<TopicMemoInboxEdge[]>([]);
  const [topicMemberships, setTopicMemberships] = useState<TopicMembership[]>([]);
  const [topicInboxMemberships, setTopicInboxMemberships] = useState<TopicInboxMembership[]>([]);

  const applyTopicMap = useCallback((topicMap: TopicMapData | null) => {
    setTopicClusters(topicMap?.clusters ?? []);
    setTopicUpdatedAt(topicMap?.updatedAt ?? null);
    setTopicGlobalEdges(topicMap?.globalEdges ?? []);
    setTopicInboxEdges(topicMap?.inboxEdges ?? []);
    setTopicMemberships(topicMap?.memberships ?? []);
    setTopicInboxMemberships(topicMap?.inboxMemberships ?? []);
  }, []);

  const clearTopicMap = useCallback(() => applyTopicMap(null), [applyTopicMap]);

  return {
    applyTopicMap,
    clearTopicMap,
    topicClusters,
    topicGlobalEdges,
    topicInboxEdges,
    topicInboxMemberships,
    topicMemberships,
    topicUpdatedAt,
  };
};
