// Permanent growth-event records. These only ever accumulate — uncompleting or
// deleting a calendar block never removes them (see the growth_events migration).

export interface ActivityCompletion {
  id: string;
  calendar_block_id: string;
  completed_at: string;
  local_date: string; // YYYY-MM-DD in the user's local timezone
}

export interface DailyCompletion {
  id: string;
  local_date: string; // YYYY-MM-DD in the user's local timezone
  completed_at: string;
  todo_count: number;
}

export type TreeStage = 'seed' | 'sprout' | 'seedling' | 'young_tree' | 'mature_tree';

// Derived from the append-only growth events. The size-relevant fields only
// ever grow (events are never removed), so the tree never regresses.
export interface ActivityStats {
  totalCompleted: number; // first-ever block completions
  completedDays: number; // watered (fully-completed) days
  activeDays: number; // distinct days with >=1 completion
  streakDays: number; // longest consecutive-active-day run (monotonic)
  recentActivity: number; // completions in the last 7 days (vitality only)
}

export interface TreeParams {
  stage: TreeStage;
  height: number;
  trunkThickness: number;
  rootDepth: number;
  branchCount: number;
  branchSpread: number;
  leafDensity: number;
  vitality: number;
}

// A planted tree, frozen at plant time (one row in public.trees).
export interface ForestTree {
  id: string;
  generation: number;
  planted_at: string;
  final_params: TreeParams;
  completed_todo_count: number;
  completed_day_count: number;
}

// The currently-growing tree — always derived, never stored.
export interface GrowingTree {
  generation: number;
  seed: string;
  params: TreeParams;
  stats: ActivityStats;
  startedAt: string | null;
  isMature: boolean;
}
