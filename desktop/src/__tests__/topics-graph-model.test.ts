import { describe, expect, it } from 'vitest';

import { buildSplitTopicGraph } from '../features/memo/topicsGraphModel';
import type { MemoRow, TopicCluster } from '../types';

const cluster: TopicCluster = {
  confidence: 0.9,
  id: 'topic-1',
  keywords: ['alpha'],
  label: 'Alpha',
  memoCount: 2,
  representativeMemoIds: ['memo-1', 'memo-2'],
};

const memo = (id: string, content: string): MemoRow => ({
  content,
  content_hash: null,
  created_at: '2026-09-08T00:00:00.000Z',
  id,
  is_archived: false,
  updated_at: '2026-09-08T00:00:00.000Z',
});

describe('Topics graph model', () => {
  it('creates neutral memo nodes with active memo priority and topic metadata', () => {
    const graph = buildSplitTopicGraph(
      [cluster],
      [
        { memoId: 'memo-1', score: 0.5, topicId: 'topic-1' },
        { memoId: 'memo-2', score: 0.9, topicId: 'topic-1' },
      ],
      [],
      [memo('memo-1', '첫 번째 메모'), memo('memo-2', '두 번째 메모')],
      'memo-1',
      [],
      [],
      [],
      'ko',
    );

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0]).toMatchObject({
      color: '#1d1d1f',
      id: 'memo:memo-1',
      kind: 'memo',
      topicId: 'topic-1',
    });
    expect(graph.nodes[1]).toMatchObject({
      color: '#69717a',
      id: 'memo:memo-2',
      kind: 'memo',
      topicId: 'topic-1',
    });
  });

  it('truncates long memo titles for the graph label', () => {
    const graph = buildSplitTopicGraph(
      [cluster],
      [{ memoId: 'memo-1', score: 0.5, topicId: 'topic-1' }],
      [],
      [memo('memo-1', '12345678901234567890\n본문')],
      null,
      [],
      [],
      [],
      'ko',
    );

    expect(graph.nodes[0]?.label).toBe('1234567890123...');
  });

  it('keeps only graph edges whose memo nodes are present', () => {
    const graph = buildSplitTopicGraph(
      [cluster],
      [
        { memoId: 'memo-1', score: 0.8, topicId: 'topic-1' },
        { memoId: 'memo-2', score: 0.7, topicId: 'topic-1' },
      ],
      [
        {
          similarity: 0.8,
          sourceMemoId: 'memo-1',
          sourceTopicId: 'topic-1',
          targetMemoId: 'memo-2',
          targetTopicId: 'topic-1',
        },
        {
          similarity: 0.9,
          sourceMemoId: 'memo-1',
          sourceTopicId: 'topic-1',
          targetMemoId: 'missing',
          targetTopicId: null,
        },
      ],
      [memo('memo-1', 'one'), memo('memo-2', 'two')],
      null,
      [],
      [],
      [],
      'ko',
    );

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      source: 'memo:memo-1',
      target: 'memo:memo-2',
      weight: 0.8,
    });
  });

  it('does not create nodes for memberships whose memo is absent', () => {
    const graph = buildSplitTopicGraph(
      [cluster],
      [{ memoId: 'missing', score: 0.8, topicId: 'topic-1' }],
      [],
      [],
      null,
      [],
      [],
      [],
      'ko',
    );

    expect(graph).toEqual({ edges: [], nodes: [] });
  });

  it('returns an empty graph for no clusters without throwing', () => {
    expect(
      buildSplitTopicGraph([], [], [], [], null, [], [], [], 'ko'),
    ).toEqual({ edges: [], nodes: [] });
  });
});
