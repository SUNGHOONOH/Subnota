export interface LatestWriteQueue<Value> {
  drain: () => Promise<void>;
  enqueue: (key: string, value: Value) => Promise<void>;
}

interface PendingWrite<Value> {
  latest: Value;
  promise: Promise<void>;
}

const defaultRetryDelay = (attempt: number) =>
  Math.min(250 * 2 ** Math.max(0, attempt - 1), 5000);

const DEFAULT_MAX_ATTEMPTS = 5;

export const createLatestWriteQueue = <Value>({
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryDelay = defaultRetryDelay,
  shouldRetry = () => true,
  write,
}: {
  maxAttempts?: number;
  retryDelay?: (attempt: number) => number;
  shouldRetry?: (error: unknown) => boolean;
  write: (value: Value) => Promise<void>;
}): LatestWriteQueue<Value> => {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }

  const failures = new Map<string, { error: unknown; value: Value }>();
  const pending = new Map<string, PendingWrite<Value>>();

  const flush = async (key: string, state: PendingWrite<Value>) => {
    let failedAttempts = 0;

    try {
      while (pending.get(key) === state) {
        const value = state.latest;
        try {
          await write(value);
          failedAttempts = 0;
          failures.delete(key);
        } catch (error) {
          // A newer value supersedes the failed one and receives its own retry
          // budget. This is what makes a delete tombstone win over an older edit.
          if (state.latest !== value) {
            failedAttempts = 0;
            continue;
          }

          if (!shouldRetry(error)) {
            failures.set(key, { error, value });
            throw error;
          }

          failedAttempts += 1;
          if (failedAttempts >= maxAttempts) {
            failures.set(key, { error, value });
            throw error;
          }
          await new Promise(resolve =>
            setTimeout(resolve, retryDelay(failedAttempts)),
          );
          if (state.latest !== value) {
            failedAttempts = 0;
          }
          continue;
        }

        if (state.latest === value) {
          return;
        }
      }
    } finally {
      if (pending.get(key) === state) {
        pending.delete(key);
      }
    }
  };

  const start = (key: string, value: Value) => {
    failures.delete(key);
    const state: PendingWrite<Value> = {
      latest: value,
      promise: Promise.resolve(),
    };
    pending.set(key, state);
    state.promise = flush(key, state);
    return state.promise;
  };

  return {
    async drain() {
      // A later quit/restore attempt is also an explicit retry opportunity.
      // Keep the failed value so storage recovery does not require changing
      // the memo text merely to enqueue the same content again.
      for (const [key, failure] of [...failures]) {
        if (!pending.has(key)) start(key, failure.value);
      }
      while (pending.size > 0) {
        const writes = [
          ...new Set([...pending.values()].map(state => state.promise)),
        ];
        await Promise.allSettled(writes);
      }
      const failure = failures.values().next();
      if (!failure.done) {
        throw failure.value.error;
      }
    },
    enqueue(key, value) {
      const current = pending.get(key);
      if (current) {
        current.latest = value;
        return current.promise;
      }
      return start(key, value);
    },
  };
};
