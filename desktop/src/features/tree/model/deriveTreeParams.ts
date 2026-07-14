import { seededRandom } from './seededRandom';
import { ActivityStats, TreeParams, TreeStage } from './treeTypes';

// Single source of growth numbers — no user-tunable config (by design).
// A tree matures in ~2 weeks of completed days (was 30 — felt endless).
const STAGE = { sprout: 2, seedling: 5, youngTree: 14 } as const;
const CAP = { height: 112, trunk: 14, root: 10, branches: 12 } as const;

export const getTreeStage = (stats: ActivityStats): TreeStage => {
  if (stats.totalCompleted === 0) {
    return 'seed';
  }
  if (stats.completedDays < STAGE.sprout) {
    return 'sprout';
  }
  if (stats.completedDays < STAGE.seedling) {
    return 'seedling';
  }
  if (stats.completedDays < STAGE.youngTree) {
    return 'young_tree';
  }
  return 'mature_tree';
};

// Size fields derive from append-only stats and are capped, so growth is
// monotonic (never regresses) and bounded once mature. Only vitality and
// branchSpread vary — vitality from recent activity, branchSpread from the seed.
export const deriveTreeParams = (stats: ActivityStats, treeSeed: string): TreeParams => {
  const rng = seededRandom(treeSeed);
  return {
    stage: getTreeStage(stats),
    height: Math.min(8 + stats.completedDays * 7, CAP.height),
    trunkThickness: Math.min(2 + stats.streakDays, CAP.trunk),
    rootDepth: Math.min(1 + stats.streakDays * 0.8, CAP.root),
    branchCount: Math.min(stats.activeDays, CAP.branches),
    branchSpread: 0.5 + rng() * 0.4,
    leafDensity: Math.min(1, stats.totalCompleted / 20),
    vitality: Math.min(1, stats.recentActivity / 10),
  };
};
