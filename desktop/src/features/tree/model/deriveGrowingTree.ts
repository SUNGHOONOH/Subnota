import { deriveActivityStats } from './deriveActivityStats';
import { deriveTreeParams } from './deriveTreeParams';
import { treeSeedKey } from './seededRandom';
import {
  ActivityCompletion,
  DailyCompletion,
  ForestTree,
  GrowingTree,
} from './treeTypes';

// The growing tree is fully derived: its generation is how many trees are
// already planted, and its events are those completed AFTER the last planting
// (all events when nothing is planted yet). Planted trees keep their frozen
// final_params, so nothing here ever recomputes a forest tree.
export const deriveGrowingTree = (
  userId: string,
  forest: ForestTree[],
  activities: ActivityCompletion[],
  dailies: DailyCompletion[],
  today: Date = new Date(),
): GrowingTree => {
  const generation = forest.length;
  const startedAt = forest.reduce<string | null>(
    (latest, tree) =>
      latest === null || tree.planted_at > latest ? tree.planted_at : latest,
    null,
  );

  const since = (completedAt: string) => startedAt === null || completedAt > startedAt;
  const stats = deriveActivityStats(
    activities.filter(item => since(item.completed_at)),
    dailies.filter(item => since(item.completed_at)),
    today,
  );

  const seed = treeSeedKey(userId, generation);
  const params = deriveTreeParams(stats, seed);
  return {
    generation,
    seed,
    params,
    stats,
    startedAt,
    isMature: params.stage === 'mature_tree',
  };
};
