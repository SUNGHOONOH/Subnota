// Permanent growth-event records. These only ever accumulate — uncompleting or
// deleting a calendar block never removes them (see the growth_events migration).
// The monthly report reads them for "해낸 일".

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
