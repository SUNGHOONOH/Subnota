export interface KeyedMutationContext {
  isLatest: () => boolean;
}

export interface KeyedMutationQueue {
  enqueue: <Result>(
    key: string,
    task: (context: KeyedMutationContext) => Promise<Result>,
  ) => Promise<Result>;
}

// Network mutations for one row must reach the server in user order. Results
// from an older mutation are still allowed to finish, but `isLatest` prevents
// them from overwriting the newer local-first state on their way back.
export const createKeyedMutationQueue = (): KeyedMutationQueue => {
  const revisions = new Map<string, number>();
  const tails = new Map<string, Promise<void>>();

  return {
    enqueue(key, task) {
      const revision = (revisions.get(key) ?? 0) + 1;
      revisions.set(key, revision);

      const previous = tails.get(key) ?? Promise.resolve();
      const run = previous.then(() =>
        task({
          isLatest: () => revisions.get(key) === revision,
        }),
      );

      const tail: Promise<void> = run
        .then(() => undefined, () => undefined)
        .finally(() => {
          if (tails.get(key) !== tail) return;
          tails.delete(key);
          if (revisions.get(key) === revision) {
            revisions.delete(key);
          }
        });
      tails.set(key, tail);
      return run;
    },
  };
};
