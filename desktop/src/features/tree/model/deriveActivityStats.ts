import { getLocalDateString } from './dayCompletion';
import { ActivityCompletion, ActivityStats, DailyCompletion } from './treeTypes';

const RECENT_WINDOW_DAYS = 7;

// Longest run of consecutive active days. Monotonic: adding days can only
// keep or extend the best run, so it never shrinks the tree.
const longestStreak = (sortedDates: string[]): number => {
  if (sortedDates.length === 0) {
    return 0;
  }
  let best = 1;
  let run = 1;
  for (let i = 1; i < sortedDates.length; i += 1) {
    const diffDays = Math.round(
      (new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime()) /
        86_400_000,
    );
    run = diffDays === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
};

export const deriveActivityStats = (
  activities: ActivityCompletion[],
  dailies: DailyCompletion[],
  today: Date = new Date(),
): ActivityStats => {
  const activeDates = [...new Set(activities.map(item => item.local_date))].sort();

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (RECENT_WINDOW_DAYS - 1));
  const cutoffDate = getLocalDateString(cutoff);

  return {
    totalCompleted: activities.length,
    completedDays: dailies.length,
    activeDays: activeDates.length,
    streakDays: longestStreak(activeDates),
    recentActivity: activities.filter(item => item.local_date >= cutoffDate).length,
  };
};
