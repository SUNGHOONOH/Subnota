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

  it('uses a rounded convex hull for larger communities', () => {
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

    expect(polygon.length).toBeGreaterThan(4);
    expect(isPointInCommunityPolygon({ x: 50, y: 50 }, polygon)).toBe(true);
    expect(isPointInCommunityPolygon({ x: 130, y: 50 }, polygon)).toBe(false);
  });

  it('rounds every corner with an arc of the padding radius', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const padding = 20;
    const polygon = createCommunityPolygon(square, padding);

    // Every boundary point sits exactly `padding` away from the notes' hull.
    const distanceToSquare = ({ x, y }: { x: number; y: number }) =>
      Math.hypot(Math.max(0, -x, x - 100), Math.max(0, -y, y - 100));
    polygon.forEach(point => {
      expect(distanceToSquare(point)).toBeCloseTo(padding, 5);
    });

    // No sharp turns: the outline bends in small, even steps.
    const turns = polygon.map((point, index) => {
      const previous = polygon[(index - 1 + polygon.length) % polygon.length];
      const next = polygon[(index + 1) % polygon.length];
      const inAngle = Math.atan2(point.y - previous.y, point.x - previous.x);
      const outAngle = Math.atan2(next.y - point.y, next.x - point.x);
      return Math.abs(Math.atan2(Math.sin(outAngle - inAngle), Math.cos(outAngle - inAngle)));
    });
    expect(Math.max(...turns)).toBeLessThanOrEqual(Math.PI / 12 + 1e-9);
  });

  it('keeps a thin, pointy triangle round at its tip', () => {
    const polygon = createCommunityPolygon(
      [
        { x: 0, y: 0 },
        { x: 200, y: 10 },
        { x: 0, y: 20 },
      ],
      16,
    );
    const tip = polygon.reduce((best, point) => (point.x > best.x ? point : best));
    // The far edge is a 16px arc around the note at (200, 10), not a spike.
    expect(tip.x).toBeCloseTo(216, 0);
    expect(isPointInCommunityPolygon({ x: 205, y: 10 }, polygon)).toBe(true);
    expect(isPointInCommunityPolygon({ x: 230, y: 10 }, polygon)).toBe(false);
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
