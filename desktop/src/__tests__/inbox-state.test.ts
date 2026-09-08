import { describe, expect, it } from 'vitest';

import {
  collectPendingInboxDeletes,
  mergeInboxItems,
  reconcileRemoteInboxLikes,
  withoutDeletedPendingInboxItems,
} from '../features/inbox/inboxState';
import type { InboxSession } from '../services/backend/inboxService';

const inboxItem = (
  id: string,
  createdAt: string,
  clientId?: string | null,
): InboxSession => ({
  canonicalUrl: null,
  channelTitle: null,
  clientId,
  createdAt,
  description: null,
  domain: null,
  duration: null,
  id,
  keywords: [],
  liked: false,
  originalUrl: null,
  publishedAt: null,
  selectedText: null,
  sourceType: 'url',
  summary: null,
  summaryBasis: null,
  summaryDetail: null,
  summaryOneLiner: null,
  summaryProvider: null,
  summarySearchText: null,
  summaryStatus: 'pending',
  thumbnailUrl: null,
  title: null,
  userNote: null,
});

describe('inbox state helpers', () => {
  it('keeps unsynced local items and removes their duplicate remote item', () => {
    const result = mergeInboxItems(
      [inboxItem('remote', '2026-09-07T10:00:00Z', 'shared')],
      [
        inboxItem('local-duplicate', '2026-09-07T11:00:00Z', 'shared'),
        inboxItem('local-pending', '2026-09-07T12:00:00Z', 'pending'),
      ],
    );

    expect(result.map((item) => item.id)).toEqual(['local-pending', 'remote']);
  });

  it('does not duplicate a cached row when the server id is already remote', () => {
    const item = inboxItem('same-id', '2026-09-07T10:00:00Z');

    const result = mergeInboxItems([item], [item]);

    expect(result.map((entry) => entry.id)).toEqual(['same-id']);
  });

  it('keeps an unsynced local row when it shares the server id', () => {
    const remote = inboxItem('same-id', '2026-09-07T10:00:00Z');
    const local = {
      ...inboxItem('same-id', '2026-09-07T11:00:00Z'),
      local_sync_status: 'pending' as const,
      title: '로컬 변경',
    };

    const result = mergeInboxItems([remote], [local]);

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('로컬 변경');
  });

  it('deduplicates repeated remote rows by server id', () => {
    const first = inboxItem('same-id', '2026-09-07T11:00:00Z');
    const second = inboxItem('same-id', '2026-09-07T10:00:00Z');

    const result = mergeInboxItems([first, second], []);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(first);
  });

  it('hides items marked for deletion by id or client id', () => {
    const items = [
      inboxItem('deleted-id', '2026-09-07T10:00:00Z'),
      inboxItem('deleted-client', '2026-09-07T10:00:00Z', 'deleted-client'),
      inboxItem('visible', '2026-09-07T10:00:00Z', 'visible-client'),
    ];

    expect(
      withoutDeletedPendingInboxItems(
        items,
        new Set(['deleted-client']),
        new Set(['deleted-id']),
      ).map((item) => item.id),
    ).toEqual(['visible']);
  });

  it('collects only pending local deletes', () => {
    const result = collectPendingInboxDeletes([
      { ...inboxItem('pending', '2026-09-07T10:00:00Z', 'client-a'), local_sync_status: 'pending_delete' },
      { ...inboxItem('synced', '2026-09-07T10:00:00Z', 'client-b'), local_sync_status: 'synced' },
    ]);

    expect(result.ids).toEqual(new Set(['pending']));
    expect(result.clientIds).toEqual(new Set(['client-a']));
  });

  it('preserves a pending local like over a stale remote response', () => {
    const state = {
      confirmedLikes: new Map<string, boolean>(),
      latestLikes: new Map([['item', true]]),
      pendingCounts: new Map([['item', 1]]),
      refreshFloor: new Map<string, number>(),
    };

    const result = reconcileRemoteInboxLikes(
      [inboxItem('item', '2026-09-07T10:00:00Z')],
      1,
      state,
    );

    expect(result[0]?.liked).toBe(true);
    expect(state.confirmedLikes.size).toBe(0);
  });

  it('waits for a fresh response before replacing a local like', () => {
    const state = {
      confirmedLikes: new Map<string, boolean>(),
      latestLikes: new Map([['item', true]]),
      pendingCounts: new Map<string, number>(),
      refreshFloor: new Map([['item', 3]]),
    };

    const stale = reconcileRemoteInboxLikes(
      [inboxItem('item', '2026-09-07T10:00:00Z')],
      2,
      state,
    );
    const fresh = reconcileRemoteInboxLikes(
      [{ ...inboxItem('item', '2026-09-07T10:00:00Z'), liked: true }],
      3,
      state,
    );

    expect(stale[0]?.liked).toBe(true);
    expect(state.refreshFloor.has('item')).toBe(false);
    expect(fresh[0]?.liked).toBe(true);
    expect(state.confirmedLikes.get('item')).toBe(true);
  });
});
