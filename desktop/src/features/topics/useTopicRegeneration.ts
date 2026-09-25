import { useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';

import { regenerateTopics as requestTopicRegeneration } from '../../services/backend/topicService';
import { saveLocalTopicMap } from '../../services/local/offlineStore';
import { fetchTopicMap } from '../../services/supabase/data';
import type { TopicMapData } from '../../types';

interface UseTopicRegenerationOptions {
  applyTopicMap: (topicMap: TopicMapData | null) => void;
  session: Session | null;
  t: (korean: string, english: string) => string;
}

/**
 * Runs the explicit Topics regeneration action and commits the resulting map
 * to the local cache before updating the visible graph state.
 */
export const useTopicRegeneration = ({
  applyTopicMap,
  session,
  t,
}: UseTopicRegenerationOptions) => {
  const regenerateTopics = useCallback(async () => {
    if (session === null) {
      throw new Error(
        t(
          '로그인 후 주제를 다시 분석할 수 있습니다.',
          'Sign in to re-analyze topics.',
        ),
      );
    }
    await requestTopicRegeneration(session);
    const nextTopicMap = await fetchTopicMap(session);
    const ownerId = session.user.id;
    await saveLocalTopicMap(nextTopicMap, ownerId);
    applyTopicMap(nextTopicMap);
  }, [applyTopicMap, session, t]);

  return { regenerateTopics };
};
