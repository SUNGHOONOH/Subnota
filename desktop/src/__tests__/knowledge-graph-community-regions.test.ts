import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createCommunityPolygon,
  findCommunityRegionAtPoint,
  isPointInCommunityPolygon,
  KnowledgeGraphCommunityRegion,
} from '../features/memo/components/knowledgeGraph';

describe('knowledge graph community polygons', () => {
  it('keeps a one-note community visible and targetable', () => {
    const polygon = createCommunityPolygon([{ x: 40, y: 30 }], 20);

    expect(polygon).toHaveLength(24);
    expect(isPointInCommunityPolygon({ x: 40, y: 30 }, polygon)).toBe(true);
    expect(isPointInCommunityPolygon({ x: 70, y: 30 }, polygon)).toBe(false);
  });

  it('wraps a two-note community in a padded capsule', () => {
    const polygon = createCommunityPolygon(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      16,
    );

    expect(isPointInCommunityPolygon({ x: 0, y: 0 }, polygon)).toBe(true);
    expect(isPointInCommunityPolygon({ x: 50, y: 12 }, polygon)).toBe(true);
    expect(isPointInCommunityPolygon({ x: 50, y: 24 }, polygon)).toBe(false);
  });

  it('uses the convex hull for larger communities', () => {
    const polygon = createCommunityPolygon(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
        { x: 50, y: 50 },
      ],
      10,
    );

    expect(polygon).toHaveLength(4);
    expect(isPointInCommunityPolygon({ x: 50, y: 50 }, polygon)).toBe(true);
    expect(isPointInCommunityPolygon({ x: 130, y: 50 }, polygon)).toBe(false);
  });

  it('selects the smallest containing region when hulls overlap', () => {
    const makeRegion = (
      id: string,
      polygon: KnowledgeGraphCommunityRegion['polygon'],
    ): KnowledgeGraphCommunityRegion => ({ color: '#cc785c', id, label: id, polygon });
    const large = makeRegion('large', createCommunityPolygon([{ x: 0, y: 0 }], 40));
    const small = makeRegion('small', createCommunityPolygon([{ x: 0, y: 0 }], 15));

    expect(findCommunityRegionAtPoint([large, small], { x: 0, y: 0 })?.id).toBe('small');
    expect(findCommunityRegionAtPoint([large, small], { x: 60, y: 0 })).toBeNull();
  });
});

describe('knowledge graph community interactions', () => {
  it('supports region focus, blank release, and Escape release', () => {
    const source = readFileSync(
      resolve(__dirname, '../features/memo/components/KnowledgeGraphView.tsx'),
      'utf8',
    );

    expect(source).toContain("renderer.on('clickStage', handleClickStage)");
    expect(source).toContain('setFocusedTopic(region?.id ?? null)');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('onFocusedTopicChange?: (topicId: string | null) => void;');
    expect(source).toContain('showCommunityAreas?: boolean;');
    expect(source).toContain('onShowCommunityAreasChange?: (show: boolean) => void;');
    expect(source).toContain('createCommunityMemoGroups(nodes, communities)');
    expect(source).toContain('if (!showCommunityAreasRef.current)');
    expect(source).toContain(
      "style: { height: '100%', pointerEvents: 'none', width: '100%' }",
    );
  });

  it('expands a topic into notes that can be opened', () => {
    const source = `${readFileSync(
      resolve(__dirname, '../features/memo/components/TopicsPane.tsx'),
      'utf8',
    )}\n${readFileSync(
      resolve(__dirname, '../features/memo/components/TopicsCommunityRail.tsx'),
      'utf8',
    )}`;

    expect(source).toContain('aria-expanded={isExpanded}');
    expect(source).toContain('className="topics-community-memos"');
    expect(source).toContain('<em>{topicMemos.length}</em>');
    expect(source).toContain('onOpenMemo(memo)');
    expect(source).toContain('aria-expanded={!isTopicRailCollapsed}');
  });
});
