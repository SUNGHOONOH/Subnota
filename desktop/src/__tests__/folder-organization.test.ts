import { describe, expect, it } from 'vitest';

import {
  AUTOMATIC_FOLDER_MIN_SEEDS,
  buildFolderClassificationRequest,
  createTopicFolderMemberships,
  getFolderRecommendations,
  getFolderSeedCount,
  toAutomaticMemberships,
} from '../features/memo/folderOrganization';
import { MemoFolder, MemoFolderMembership, TopicCluster } from '../types';

const folder = (patch: Partial<MemoFolder> = {}): MemoFolder => ({
  createdAt: '2026-09-06T00:00:00.000Z',
  id: 'folder-a',
  mode: 'automatic',
  name: 'Databases',
  sourceTopicId: null,
  updatedAt: '2026-09-06T00:00:00.000Z',
  ...patch,
});

const topics: TopicCluster[] = [
  {
    confidence: 0.9,
    id: 'topic-db',
    keywords: ['SQLite', 'sync'],
    label: 'Databases',
    memoCount: 3,
    representativeMemoIds: [],
  },
];

describe('folder organization', () => {
  const membership = (
    folderId: string,
    memoId: string,
    source: MemoFolderMembership['source'] = 'user',
  ): MemoFolderMembership => ({
    createdAt: '2026-09-06T00:00:00.000Z',
    folderId,
    memoId,
    score: null,
    source,
  });
  it('asks only about unfiled notes, using hand-filed seeds of automatic folders', () => {
    expect(AUTOMATIC_FOLDER_MIN_SEEDS).toBe(2);
    expect(buildFolderClassificationRequest({
      folders: [
        folder(),
        folder({ id: 'folder-manual', mode: 'manual' }),
        folder({ id: 'folder-one-seed' }),
      ],
      memberships: [
        membership('folder-a', 'seed-user'),
        membership('folder-a', 'seed-topic', 'topic_import'),
        membership('folder-a', 'auto-filed', 'automatic'),
        membership('folder-manual', 'manual-1'),
        membership('folder-manual', 'manual-2'),
        membership('folder-one-seed', 'lonely'),
      ],
      activeMemoIds: ['seed-user', 'auto-filed', 'manual-1', 'unfiled'],
    })).toEqual({
      candidateMemoIds: ['unfiled'],
      folders: [{ folderId: 'folder-a', seedMemoIds: ['seed-user', 'seed-topic'] }],
      margin: 0.03,
      minimumSeeds: 2,
      threshold: 0.4,
    });
  });

  it('skips the request when no automatic folder has enough seeds or nothing is unfiled', () => {
    expect(buildFolderClassificationRequest({
      folders: [folder()],
      memberships: [membership('folder-a', 'seed-user')],
      activeMemoIds: ['unfiled'],
    })).toBeNull();
    expect(buildFolderClassificationRequest({
      folders: [folder()],
      memberships: [membership('folder-a', 'm1'), membership('folder-a', 'm2')],
      activeMemoIds: ['m1', 'm2'],
    })).toBeNull();
  });

  it('counts only hand-filed notes as seeds', () => {
    expect(getFolderSeedCount('folder-a', [
      membership('folder-a', 'm1'),
      membership('folder-a', 'm2', 'automatic'),
      membership('folder-a', 'm3', 'topic_import'),
      membership('folder-b', 'm4'),
    ])).toBe(2);
  });

  it('turns classifier hits into automatic memberships except removed pairs', () => {
    expect(toAutomaticMemberships(
      [
        { folderId: 'folder-a', memoId: 'memo-new', score: 0.52 },
        { folderId: 'folder-a', memoId: 'memo-removed', score: 0.61 },
      ],
      [{ createdAt: '2026-09-06T00:00:00.000Z', folderId: 'folder-a', memoId: 'memo-removed' }],
      '2026-09-06T01:00:00.000Z',
    )).toEqual([{
      createdAt: '2026-09-06T01:00:00.000Z',
      folderId: 'folder-a',
      memoId: 'memo-new',
      score: 0.52,
      source: 'automatic',
    }]);
  });

  it('copies every current topic member without removing overlapping memberships', () => {
    expect(createTopicFolderMemberships('folder-topic', 'topic-db', [
      { memoId: 'memo-a', score: 0.9, topicId: 'topic-db' },
      { memoId: 'memo-b', score: 0.8, topicId: 'topic-db' },
    ], '2026-09-06T02:00:00.000Z')).toHaveLength(2);
  });

  it('only suggests a reviewable folder for a sufficiently large unfiled topic', () => {
    expect(getFolderRecommendations({
      folders: [],
      memberships: [{
        createdAt: '2026-09-06T00:00:00.000Z',
        folderId: 'existing',
        memoId: 'memo-filed',
        score: null,
        source: 'user',
      }],
      topicClusters: topics,
      topicMemberships: [
        { memoId: 'memo-a', score: 0.9, topicId: 'topic-db' },
        { memoId: 'memo-b', score: 0.8, topicId: 'topic-db' },
        { memoId: 'memo-filed', score: 0.7, topicId: 'topic-db' },
      ],
    })).toEqual([{
      memoIds: ['memo-a', 'memo-b'],
      name: 'Databases',
      topicId: 'topic-db',
    }]);
  });
});
