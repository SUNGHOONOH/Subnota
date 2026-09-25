import {
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
  TopicCluster,
  TopicMembership,
} from '../../types';

export interface FolderRecommendation {
  memoIds: string[];
  name: string;
  topicId: string;
}

/** A recommendation is only a reviewable draft. It never creates a folder or
 * assigns a memo until the user approves it. */
export const getFolderRecommendations = ({
  folders,
  memberships,
  topicClusters,
  topicMemberships,
}: {
  folders: MemoFolder[];
  memberships: MemoFolderMembership[];
  topicClusters: TopicCluster[];
  topicMemberships: TopicMembership[];
}): FolderRecommendation[] => {
  const classifiedMemoIds = new Set(memberships.map(item => item.memoId));
  const topicById = new Map(topicClusters.map(topic => [topic.id, topic]));
  const sourceTopicIds = new Set(
    folders.flatMap(folder => (folder.sourceTopicId ? [folder.sourceTopicId] : [])),
  );
  const memoIdsByTopic = new Map<string, string[]>();

  topicMemberships.forEach(membership => {
    if (classifiedMemoIds.has(membership.memoId)) return;
    const memoIds = memoIdsByTopic.get(membership.topicId) ?? [];
    memoIds.push(membership.memoId);
    memoIdsByTopic.set(membership.topicId, memoIds);
  });

  return [...memoIdsByTopic]
    .map(([topicId, memoIds]) => ({ memoIds, topic: topicById.get(topicId), topicId }))
    .filter(
      (item): item is { memoIds: string[]; topic: TopicCluster; topicId: string } =>
        Boolean(item.topic) &&
        item.memoIds.length >= 2 &&
        !sourceTopicIds.has(item.topicId),
    )
    .sort((a, b) => b.memoIds.length - a.memoIds.length)
    .slice(0, 3)
    .map(({ memoIds, topic, topicId }) => ({
      memoIds,
      name: topic.label,
      topicId,
    }));
};

/** Measured on 73 hand-labelled memos (centered memo means, see
 * `local-database.ts`): two seeds give 0.90-0.97 precision at 0.40, and a
 * third seed mostly adds recall. A wrong automatic filing costs the user a
 * removal, so the threshold favours precision (~30% recall). */
export const AUTOMATIC_FOLDER_MIN_SEEDS = 2;
const AUTOMATIC_FOLDER_THRESHOLD = 0.4;
const AUTOMATIC_FOLDER_MARGIN = 0.03;

/** Seeds are notes the user filed (directly or by importing a Topic).
 * Automatic filings never count, so one wrong guess cannot train the next. */
const isSeed = (membership: MemoFolderMembership) =>
  membership.source !== 'automatic';

export const getFolderSeedCount = (
  folderId: string,
  memberships: MemoFolderMembership[],
) =>
  memberships.filter(item => item.folderId === folderId && isSeed(item)).length;

/** Automatic folders may only claim notes that are in no folder at all. */
export const buildFolderClassificationRequest = ({
  activeMemoIds,
  folders,
  memberships,
}: {
  activeMemoIds: string[];
  folders: MemoFolder[];
  memberships: MemoFolderMembership[];
}) => {
  const classifyingFolders = folders
    .filter(folder => folder.mode === 'automatic')
    .map(folder => ({
      folderId: folder.id,
      seedMemoIds: memberships
        .filter(item => item.folderId === folder.id && isSeed(item))
        .map(item => item.memoId),
    }))
    .filter(folder => folder.seedMemoIds.length >= AUTOMATIC_FOLDER_MIN_SEEDS);
  const filedMemoIds = new Set(memberships.map(item => item.memoId));
  const candidateMemoIds = activeMemoIds.filter(memoId => !filedMemoIds.has(memoId));
  if (classifyingFolders.length === 0 || candidateMemoIds.length === 0) {
    return null;
  }
  return {
    candidateMemoIds,
    folders: classifyingFolders,
    margin: AUTOMATIC_FOLDER_MARGIN,
    minimumSeeds: AUTOMATIC_FOLDER_MIN_SEEDS,
    threshold: AUTOMATIC_FOLDER_THRESHOLD,
  };
};

/** A note the user took out of a folder never goes back in automatically. */
export const toAutomaticMemberships = (
  assignments: Array<{ folderId: string; memoId: string; score: number }>,
  exclusions: MemoFolderExclusion[],
  now = new Date().toISOString(),
): MemoFolderMembership[] => {
  const excludedPairs = new Set(
    exclusions.map(item => `${item.folderId}:${item.memoId}`),
  );
  return assignments
    .filter(item => !excludedPairs.has(`${item.folderId}:${item.memoId}`))
    .map(item => ({
      createdAt: now,
      folderId: item.folderId,
      memoId: item.memoId,
      score: item.score,
      source: 'automatic' as const,
    }));
};

export const createTopicFolderMemberships = (
  folderId: string,
  topicId: string,
  memberships: TopicMembership[],
  now = new Date().toISOString(),
): MemoFolderMembership[] =>
  memberships
    .filter(item => item.topicId === topicId)
    .map(item => ({
      createdAt: now,
      folderId,
      memoId: item.memoId,
      score: item.score,
      source: 'topic_import',
    }));
