import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/topics/useTopicRegeneration.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('Topic regeneration boundary', () => {
  it('keeps App with the explicit regeneration hook wiring only', () => {
    expect(appSource).toContain(
      "import { useTopicRegeneration } from './features/topics/useTopicRegeneration';",
    );
    expect(appSource).toContain('useTopicRegeneration({');
    expect(appSource).not.toContain('const regenerateTopics = async () =>');
  });

  it('requires a signed-in session before regenerating Topics', () => {
    expect(source).toContain('if (session === null)');
    expect(source).toContain('로그인 후 주제를 다시 분석할 수 있습니다.');
    expect(source).toContain("'Sign in to re-analyze topics.'");
  });

  it('requests a new map and reloads it from the canonical endpoint', () => {
    expect(source).toContain('await requestTopicRegeneration(session);');
    expect(source).toContain('const nextTopicMap = await fetchTopicMap(session);');
  });

  it('commits the map to the owner cache before visible state', () => {
    expect(source.indexOf('await saveLocalTopicMap(nextTopicMap, ownerId);')).toBeLessThan(
      source.indexOf('applyTopicMap(nextTopicMap);'),
    );
    expect(source).toContain('const ownerId = session.user.id;');
  });

  it('keeps regeneration callback stable with the Topic state inputs', () => {
    expect(source).toContain('const regenerateTopics = useCallback(async () =>');
    expect(source).toContain('[applyTopicMap, session, t]');
  });
});
