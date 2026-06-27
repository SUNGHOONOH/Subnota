import { describe, expect, it } from 'vitest';

import { deriveActivityStats } from '../features/tree/model/deriveActivityStats';
import { deriveTreeParams, getTreeStage } from '../features/tree/model/deriveTreeParams';
import { seededRandom, treeSeedKey } from '../features/tree/model/seededRandom';
import { ActivityStats } from '../features/tree/model/treeTypes';

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
const stats = (over: Partial<ActivityStats>): ActivityStats => ({
  totalCompleted: 0,
  completedDays: 0,
  activeDays: 0,
  streakDays: 0,
  recentActivity: 0,
  ...over,
});

describe('deriveActivityStats', () => {
  it('counts totals, distinct active days, and the longest streak', () => {
    const activities = [ac('2026-06-23', 'a'), ac('2026-06-24', 'b'), ac('2026-06-24', 'c'), ac('2026-06-26', 'd')];
    const s = deriveActivityStats(activities, [dc('2026-06-23'), dc('2026-06-24')], new Date('2026-06-26T12:00:00'));
    expect(s.totalCompleted).toBe(4);
    expect(s.completedDays).toBe(2);
    expect(s.activeDays).toBe(3);
    expect(s.streakDays).toBe(2);
  });

  it('recentActivity counts only the last 7 days', () => {
    const s = deriveActivityStats([ac('2026-06-01', 'old'), ac('2026-06-26', 'new')], [], new Date('2026-06-26T12:00:00'));
    expect(s.recentActivity).toBe(1);
  });
});

describe('getTreeStage', () => {
  it('walks the stage boundaries', () => {
    expect(getTreeStage(stats({}))).toBe('seed');
    expect(getTreeStage(stats({ totalCompleted: 1, completedDays: 0 }))).toBe('sprout');
    expect(getTreeStage(stats({ totalCompleted: 1, completedDays: 3 }))).toBe('seedling');
    expect(getTreeStage(stats({ totalCompleted: 1, completedDays: 10 }))).toBe('young_tree');
    expect(getTreeStage(stats({ totalCompleted: 1, completedDays: 30 }))).toBe('mature_tree');
  });
});

describe('deriveTreeParams', () => {
  const seed = treeSeedKey('user-1', 0);

  it('is deterministic for the same stats + seed', () => {
    const s = stats({ totalCompleted: 5, completedDays: 4, activeDays: 3, streakDays: 2 });
    expect(deriveTreeParams(s, seed)).toEqual(deriveTreeParams(s, seed));
  });

  it('never regresses: more completed days never lowers height', () => {
    const small = deriveTreeParams(stats({ completedDays: 2 }), seed);
    const big = deriveTreeParams(stats({ completedDays: 8 }), seed);
    expect(big.height).toBeGreaterThanOrEqual(small.height);
  });

  it('caps height once mature', () => {
    expect(deriveTreeParams(stats({ completedDays: 9999 }), seed).height).toBe(112);
  });
});

describe('seededRandom', () => {
  it('same key yields the same first draw; different keys differ', () => {
    expect(seededRandom('k')()).toBe(seededRandom('k')());
    expect(seededRandom('k')()).not.toBe(seededRandom('other')());
  });
});
