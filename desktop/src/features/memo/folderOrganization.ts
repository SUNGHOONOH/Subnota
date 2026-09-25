import {
  MemoFolder,
  MemoFolderExclusion,
  MemoFolderMembership,
  TopicCluster,
  TopicMembership,
} from '../../types';

const tokenize = (value: string) =>
  new Set(
    value
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map(token => token.trim())
      .filter(token => token.length >= 2),
  );

const intersectionSize = (left: Set<string>, right: Set<string>) => {
  let count = 0;
  left.forEach(token => {
    if (right.has(token)) count += 1;
  });
  return count;
};

/** The folder classifier is frozen from user-approved folder details and seed
 * notes. It deliberately does not retain a live Topic id: regenerating the
 * map must never redirect a folder that came from a Topic. */
export const createFolderClassifierTerms = (values: string[]) =>
  [...new Set(values.flatMap(value => [...tokenize(value)]))].slice(0, 80);

interface AutomaticFolderAssignmentInput {
  folders: MemoFolder[];
  exclusions?: MemoFolderExclusion[];
  memberships: MemoFolderMembership[];
  now?: string;
  topicClusters: TopicCluster[];
  topicMemberships: TopicMembership[];
}

export interface FolderRecommendation {
  description: string;
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
}: Pick<
  AutomaticFolderAssignmentInput,
  'folders' | 'memberships' | 'topicClusters' | 'topicMemberships'
>): FolderRecommendation[] => {
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
      description: topic.keywords.join(' · '),
      memoIds,
      name: topic.label,
      topicId,
    }));
};

/**
 * Automatic folders may only claim notes that are not in any folder. Their
 * frozen classifier terms are compared with the current topic description;
 * previous automatic assignments are deliberately excluded so one wrong guess
 * cannot train the next one. Topic regeneration cannot change a folder's
 * target merely because a former seed memo moved to another Topic.
 */
export const getAutomaticFolderAssignments = ({
  folders,
  exclusions = [],
  memberships,
  now = new Date().toISOString(),
  topicClusters,
  topicMemberships,
}: AutomaticFolderAssignmentInput): MemoFolderMembership[] => {
  const classifiedMemoIds = new Set(memberships.map(item => item.memoId));
  const targetByFolderId = new Map<string, { score: number; topicId: string }>();

  folders
    .filter(folder => folder.mode === 'automatic')
    .forEach(folder => {
      const folderTokens = new Set([
        ...createFolderClassifierTerms([
          folder.name,
          folder.description,
          ...(folder.classifierTerms ?? []),
        ]),
      ]);
      const textualTarget = topicClusters
        .map(topic => {
          const topicTokens = tokenize(`${topic.label} ${topic.keywords.join(' ')}`);
          return {
            score: intersectionSize(folderTokens, topicTokens),
            topicId: topic.id,
          };
        })
        .filter(candidate => candidate.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (textualTarget) targetByFolderId.set(folder.id, textualTarget);
    });

  const candidatesByTopicId = new Map<
    string,
    Array<{ folderId: string; score: number }>
  >();
  targetByFolderId.forEach((target, folderId) => {
    const candidates = candidatesByTopicId.get(target.topicId) ?? [];
    candidates.push({ folderId, score: target.score });
    candidatesByTopicId.set(target.topicId, candidates);
  });
  const bestFolderByTopicId = new Map<string, { folderId: string; score: number }>();
  candidatesByTopicId.forEach((candidates, topicId) => {
    const ranked = candidates.sort((a, b) => b.score - a.score);
    if (ranked[1] && ranked[0].score - ranked[1].score < 0.5) return;
    bestFolderByTopicId.set(topicId, ranked[0]);
  });
  const excludedPairs = new Set(
    exclusions.map(item => `${item.folderId}:${item.memoId}`),
  );

  return topicMemberships.flatMap(topicMembership => {
    if (classifiedMemoIds.has(topicMembership.memoId)) return [];
    const target = bestFolderByTopicId.get(topicMembership.topicId);
    if (!target) return [];
    if (excludedPairs.has(`${target.folderId}:${topicMembership.memoId}`)) return [];
    return [{
      createdAt: now,
      folderId: target.folderId,
      memoId: topicMembership.memoId,
      score: topicMembership.score,
      source: 'automatic' as const,
    }];
  });
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
