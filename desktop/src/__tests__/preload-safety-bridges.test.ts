import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => ({
  api: null as Record<string, (...args: never[]) => unknown> | null,
  invoke: vi.fn(async () => true as unknown),
  listeners: new Map<string, (...args: unknown[]) => void>(),
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (
      _name: string,
      api: Record<string, (...args: never[]) => unknown>,
    ) => {
      electronState.api = api;
    },
  },
  ipcRenderer: {
    invoke: (...args: unknown[]) => electronState.invoke(...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      electronState.listeners.set(channel, listener);
    },
    removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
      if (electronState.listeners.get(channel) === listener) {
        electronState.listeners.delete(channel);
      }
    },
    send: (...args: unknown[]) => electronState.send(...args),
  },
  webUtils: { getPathForFile: vi.fn(() => '/tmp/file') },
}));

vi.mock('../platform/policy', () => ({
  COLD_START_ARG: '--subnota-cold-start',
  DESKTOP_PLATFORM_FEATURES: { platform: 'macos' },
}));

type SafetyBridge = {
  localDbApplyMemoSyncResult: (
    ownerId: string | null,
    memoId: string,
    expectedLocalContent: string,
    value: unknown,
  ) => Promise<boolean>;
  localDbDeleteInboxPendingIfNotDeleted: (
    ownerId: string | null,
    recordId: string,
  ) => Promise<boolean>;
  localDbRestoreMemoSnapshotAfterPull: (
    ownerId: string | null,
    memoId: string,
    value: unknown,
  ) => Promise<void>;
  localDbReplaceSynced: (
    ownerId: string | null,
    recordType: string,
    values: unknown[],
    preserveIds?: string[],
  ) => Promise<unknown[]>;
  onFlushPendingLocalWrites: (
    callback: (reason: LocalWriteFlushReason) => Promise<void>,
  ) => () => void;
  onLocalWriteFlushCancelled: (callback: () => void) => () => void;
  showClipNotification: (
    kind: 'failed' | 'saved',
    body: string,
    onClick?: () => void,
  ) => Promise<boolean>;
};

const api = () => {
  if (!electronState.api) throw new Error('Preload API was not exposed.');
  return electronState.api as unknown as SafetyBridge;
};

const emit = (channel: string, payload: unknown) => {
  const listener = electronState.listeners.get(channel);
  if (!listener) throw new Error(`Missing preload listener: ${channel}`);
  listener({}, payload);
};

beforeAll(async () => {
  await import('../preload');
});

beforeEach(() => {
  electronState.invoke.mockReset();
  electronState.invoke.mockResolvedValue(true);
  electronState.send.mockClear();
});

describe('preload safety bridges', () => {
  it('routes a validated main-process notification click to its callback', async () => {
    const onClick = vi.fn();
    await expect(
      api().showClipNotification('saved', '저장된 페이지', onClick),
    ).resolves.toBe(true);
    const payload = electronState.invoke.mock.calls[0][1] as { id: string };

    expect(electronState.invoke).toHaveBeenCalledWith(
      'clip-notification:show',
      expect.objectContaining({ body: '저장된 페이지', kind: 'saved' }),
    );
    emit('clip-notification:event', { action: 'click', id: payload.id });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('acknowledges renderer flush success and failure without exposing raw IPC', async () => {
    const successful = vi.fn(async () => undefined);
    const unsubscribeSuccess = api().onFlushPendingLocalWrites(successful);
    emit('flush-pending-local-writes', {
      reason: 'shutdown',
      requestId: 'flush-abc-1',
    });
    await vi.waitFor(() =>
      expect(electronState.send).toHaveBeenCalledWith(
        'flush-pending-local-writes-complete',
        { ok: true, requestId: 'flush-abc-1' },
      ),
    );
    expect(successful).toHaveBeenCalledWith('shutdown');
    unsubscribeSuccess();

    electronState.send.mockClear();
    const failed = vi.fn(async () => {
      throw new Error('write failed');
    });
    api().onFlushPendingLocalWrites(failed);
    emit('flush-pending-local-writes', {
      reason: 'window-close',
      requestId: 'flush-abc-2',
    });
    await vi.waitFor(() =>
      expect(electronState.send).toHaveBeenCalledWith(
        'flush-pending-local-writes-complete',
        {
          message: 'write failed',
          ok: false,
          requestId: 'flush-abc-2',
        },
      ),
    );
    expect(failed).toHaveBeenCalledWith('window-close');
  });

  it('ignores flush requests with a missing or unknown reason', async () => {
    const callback = vi.fn(async () => undefined);
    api().onFlushPendingLocalWrites(callback);

    emit('flush-pending-local-writes', { requestId: 'flush-abc-3' });
    emit('flush-pending-local-writes', {
      reason: 'restore-confirmed',
      requestId: 'flush-abc-4',
    });
    await Promise.resolve();

    expect(callback).not.toHaveBeenCalled();
    expect(electronState.send).not.toHaveBeenCalled();
  });

  it('releases renderer write guards when main cancels a shared flush', () => {
    const cancelled = vi.fn();
    const unsubscribe = api().onLocalWriteFlushCancelled(cancelled);

    emit('local-write-flush-cancelled', undefined);
    expect(cancelled).toHaveBeenCalledOnce();

    unsubscribe();
    expect(electronState.listeners.has('local-write-flush-cancelled')).toBe(false);
  });

  it('forwards preserved record ids as the fourth replace-synced argument', async () => {
    electronState.invoke.mockResolvedValue([]);

    await api().localDbReplaceSynced(null, 'memo', [], ['memo-a']);

    expect(electronState.invoke).toHaveBeenCalledWith(
      'local-db:replace-synced',
      null,
      'memo',
      [],
      ['memo-a'],
    );
  });

  it('forwards atomic memo sync compare-and-apply arguments through a narrow bridge', async () => {
    const record = {
      content: 'canonical B',
      id: 'memo-a',
      local_sync_status: 'synced',
      synced_content: 'canonical B',
      synced_content_hash: 'hash-b',
    };

    await api().localDbApplyMemoSyncResult(
      'owner-a',
      record.id,
      'local B',
      record,
    );

    expect(electronState.invoke).toHaveBeenCalledWith(
      'local-db:apply-memo-sync-result',
      'owner-a',
      'memo-a',
      'local B',
      record,
    );
  });

  it('forwards the conditional pending-inbox cleanup through a narrow bridge', async () => {
    await api().localDbDeleteInboxPendingIfNotDeleted(
      'owner-a',
      'pending-client-id',
    );

    expect(electronState.invoke).toHaveBeenCalledWith(
      'local-db:delete-inbox-pending-if-not-deleted',
      'owner-a',
      'pending-client-id',
    );
  });

  it('forwards exact post-pull memo restoration through a narrow bridge', async () => {
    const snapshot = {
      content: 'local A',
      id: 'memo-a',
      local_sync_status: 'pending',
      synced_content: 'base A',
    };

    await api().localDbRestoreMemoSnapshotAfterPull(
      'owner-a',
      snapshot.id,
      snapshot,
    );

    expect(electronState.invoke).toHaveBeenCalledWith(
      'local-db:restore-memo-snapshot-after-pull',
      'owner-a',
      snapshot.id,
      snapshot,
    );
  });
});
