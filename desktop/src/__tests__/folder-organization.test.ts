import { describe, expect, it } from 'vitest';

import {
  createTopicFolderMemberships,
  getAutomaticFolderAssignments,
  getFolderRecommendations,
} from '../features/memo/folderOrganization';
import { MemoFolder, MemoFolderMembership, TopicCluster } from '../types';

const folder = (patch: Partial<MemoFolder> = {}): MemoFolder => ({
  classifierTerms: [],
  createdAt: '2026-09-06T00:00:00.000Z',
  description: '',
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
  it('only auto-classifies memos that do not already belong to a folder', () => {
    const existing: MemoFolderMembership[] = [{
      createdAt: '2026-09-06T00:00:00.000Z',
      folderId: 'other-folder',
      memoId: 'memo-kept',
      score: null,
      source: 'user',
    }];

    expect(getAutomaticFolderAssignments({
      folders: [folder()],
      memberships: existing,
      now: '2026-09-06T01:00:00.000Z',
      topicClusters: topics,
      topicMemberships: [
        { memoId: 'memo-kept', score: 0.8, topicId: 'topic-db' },
        { memoId: 'memo-new', score: 0.7, topicId: 'topic-db' },
      ],
    })).toEqual([{
      createdAt: '2026-09-06T01:00:00.000Z',
      folderId: 'folder-a',
      memoId: 'memo-new',
      score: 0.7,
      source: 'automatic',
    }]);
  });

  it('never lets manual folders claim notes automatically', () => {
    expect(getAutomaticFolderAssignments({
      folders: [folder({ mode: 'manual', sourceTopicId: 'topic-db' })],
      memberships: [],
      topicClusters: topics,
      topicMemberships: [{ memoId: 'memo-new', score: 0.7, topicId: 'topic-db' }],
    })).toEqual([]);
  });

  it('copies every current topic member without removing overlapping memberships', () => {
    expect(createTopicFolderMemberships('folder-topic', 'topic-db', [
      { memoId: 'memo-a', score: 0.9, topicId: 'topic-db' },
      { memoId: 'memo-b', score: 0.8, topicId: 'topic-db' },
    ], '2026-09-06T02:00:00.000Z')).toHaveLength(2);
  });

  it('keeps an ambiguous memo unfiled when automatic folders tie', () => {
    expect(getAutomaticFolderAssignments({
      folders: [folder({ id: 'folder-a' }), folder({ id: 'folder-b' })],
      memberships: [],
      topicClusters: topics,
      topicMemberships: [{ memoId: 'memo-new', score: 0.7, topicId: 'topic-db' }],
    })).toEqual([]);
  });

  it('does not re-add a memo the user removed from an automatic folder', () => {
    expect(getAutomaticFolderAssignments({
      exclusions: [{
        createdAt: '2026-09-06T00:00:00.000Z',
        folderId: 'folder-a',
        memoId: 'memo-new',
      }],
      folders: [folder()],
      memberships: [],
      topicClusters: topics,
      topicMemberships: [{ memoId: 'memo-new', score: 0.7, topicId: 'topic-db' }],
    })).toEqual([]);
  });

  it('keeps a Topic-imported folder target stable after Topics are regenerated', () => {
    const regeneratedTopics: TopicCluster[] = [
      ...topics,
      {
        confidence: 0.9,
        id: 'topic-groceries',
        keywords: ['market'],
        label: 'Groceries',
        memoCount: 2,
        representativeMemoIds: [],
      },
    ];

    expect(getAutomaticFolderAssignments({
      folders: [folder({ classifierTerms: ['databases'], name: 'Archive' })],
      memberships: [{
        createdAt: '2026-09-06T00:00:00.000Z',
        folderId: 'folder-a',
        memoId: 'former-database-note',
        score: 0.9,
        source: 'topic_import',
      }],
      topicClusters: regeneratedTopics,
      topicMemberships: [
        { memoId: 'former-database-note', score: 0.9, topicId: 'topic-groceries' },
        { memoId: 'new-database-note', score: 0.8, topicId: 'topic-db' },
        { memoId: 'new-grocery-note', score: 0.8, topicId: 'topic-groceries' },
      ],
    })).toMatchObject([{
      folderId: 'folder-a',
      memoId: 'new-database-note',
      source: 'automatic',
    }]);
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
      description: 'SQLite · sync',
      memoIds: ['memo-a', 'memo-b'],
      name: 'Databases',
      topicId: 'topic-db',
    }]);
  });
});
