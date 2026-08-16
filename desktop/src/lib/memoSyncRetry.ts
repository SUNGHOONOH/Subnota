const MEMO_SYNC_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000, 300_000] as const;

// Keep retries inexpensive during outages while continuing to protect queued edits.
export const memoSyncRetryDelay = (attempt: number) =>
  MEMO_SYNC_RETRY_DELAYS_MS[
    Math.min(Math.max(attempt - 1, 0), MEMO_SYNC_RETRY_DELAYS_MS.length - 1)
  ];
