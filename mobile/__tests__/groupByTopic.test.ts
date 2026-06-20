import { groupByTopic } from '../src/features/memo/components/GlobalNetworkGraph.shared';

describe('groupByTopic', () => {
  it('returns an empty map for no items', () => {
    expect(groupByTopic([]).size).toBe(0);
  });

  it('groups items by topicId preserving insertion order', () => {
    const items = [
      { topicId: 't1', memoId: 'a' },
      { topicId: 't2', memoId: 'b' },
      { topicId: 't1', memoId: 'c' },
      { topicId: 't2', memoId: 'd' },
      { topicId: 't1', memoId: 'e' },
    ];

    const grouped = groupByTopic(items);

    expect(grouped.size).toBe(2);
    expect(grouped.get('t1')).toEqual([
      { topicId: 't1', memoId: 'a' },
      { topicId: 't1', memoId: 'c' },
      { topicId: 't1', memoId: 'e' },
    ]);
    expect(grouped.get('t2')).toEqual([
      { topicId: 't2', memoId: 'b' },
      { topicId: 't2', memoId: 'd' },
    ]);
  });

  it('does not mutate the input array', () => {
    const items = [{ topicId: 't1' }];
    const snapshot = [...items];
    groupByTopic(items);
    expect(items).toEqual(snapshot);
  });
});
