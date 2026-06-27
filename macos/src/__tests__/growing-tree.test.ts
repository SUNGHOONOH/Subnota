import { describe, expect, it } from 'vitest';

import { deriveGrowingTree } from '../features/tree/model/deriveGrowingTree';
import { ForestTree, TreeParams } from '../features/tree/model/treeTypes';

const ac = (local_date: string, id = local_date) => ({
  id,
  calendar_block_id: id,
  completed_at: `${local_date}T09:00:00.000Z`,
  local_date,
});
const dc = (local_date: string) => ({
  id: local_date,
  local_date,
  completed_at: `${local_date}T09:00:00.000Z`,
  todo_count: 1,
});
const planted = (generation: number, planted_at: string): ForestTree => ({
  id: `t${generation}`,
  generation,
  planted_at,
  final_params: {} as TreeParams,
  completed_todo_count: 0,
  completed_day_count: 0,
});

describe('deriveGrowingTree', () => {
  it('with no forest, generation 0 counts all events', () => {
    const tree = deriveGrowingTree('u', [], [ac('2026-06-24'), ac('2026-06-25')], [dc('2026-06-24')]);
    expect(tree.generation).toBe(0);
    expect(tree.stats.totalCompleted).toBe(2);
    expect(tree.stats.completedDays).toBe(1);
    expect(tree.seed).toContain(':tree:0:');
  });

  it('after planting, the next generation only counts events since the plant', () => {
    const activities = [ac('2026-06-24', 'old'), ac('2026-06-26', 'new')];
    const tree = deriveGrowingTree('u', [planted(0, '2026-06-25T00:00:00.000Z')], activities, []);
    expect(tree.generation).toBe(1);
    expect(tree.stats.totalCompleted).toBe(1); // only the 06-26 event
    expect(tree.seed).toContain(':tree:1:');
  });

  it('is deterministic for the same user + generation + events', () => {
    const a = deriveGrowingTree('u', [], [ac('2026-06-24')], []);
    const b = deriveGrowingTree('u', [], [ac('2026-06-24')], []);
    expect(a.params).toEqual(b.params);
  });
});
