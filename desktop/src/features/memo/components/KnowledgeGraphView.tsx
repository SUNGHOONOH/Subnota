import { useCallback, useEffect, useRef, useState } from 'react';
import SigmaRenderer from 'sigma';
import { createNodeImageProgram } from '@sigma/node-image';
import { createNodeCompoundProgram, NodeCircleProgram } from 'sigma/rendering';

import { Eye, EyeOff, FocusNode, Minus, Plus, RefreshCw } from '../../../components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';
import {
  applyTopicNetworkLayout,
  buildKnowledgeGraph,
  createCommunityMemoGroups,
  createEdgeReducer,
  createCommunityPolygon,
  createNodeReducer,
  findCommunityRegionAtPoint,
  GRAPH_COLORS,
  KnowledgeGraphCommunity,
  KnowledgeGraphCommunityMembers,
  KnowledgeGraphCommunityRegion,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './knowledgeGraph';

export type {
  KnowledgeGraphCommunity,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './knowledgeGraph';
import EmptyState from '../../../components/EmptyState';
import { localize, useUiLanguage } from '../../../lib/uiLanguage';

interface KnowledgeGraphViewProps {
  activeNodeId?: string | null;
  ariaLabel: string;
  className?: string;
  communities?: KnowledgeGraphCommunity[];
  edges: KnowledgeGraphEdge[];
  emptyBody?: string;
  emptyMessage?: string;
  focusedTopicId?: string | null;
  showActiveNodeControl?: boolean;
  // 'preset' renders nodes exactly where the caller placed them; 'force' uses
  // those positions as a seed for ForceAtlas2 + noverlap (topic map).
  layout?: 'force' | 'preset';
  nodes: KnowledgeGraphNode[];
  onFocusedTopicChange?: (topicId: string | null) => void;
  onShowCommunityAreasChange?: (show: boolean) => void;
  getNodeTooltip?: (nodeId: string) => string | null;
  onSelectNode?: (nodeId: string) => void;
  showCommunityAreas?: boolean;
}

const CAMERA_ANIMATION_DURATION = 220;
const CONTROL_ZOOM_FACTOR = 1.25;
const COMMUNITY_HULL_PADDING = 22;
const COMMUNITY_LAYER_ID = 'community-regions';

interface GraphTooltip {
  alignEnd: boolean;
  label: string;
  x: number;
  y: number;
}

// Icon nodes (type: 'icon'): draw the node disc, then let @sigma/node-image
// redraw the same disc with the SVG's white pixels on top.
const NodePictogramProgram = createNodeImageProgram({
  correctCentering: true,
  drawingMode: 'background',
  keepWithinCircle: true,
  padding: 0.22,
  size: { mode: 'force', value: 256 },
});
const NodeIconProgram = createNodeCompoundProgram([
  NodeCircleProgram,
  NodePictogramProgram,
]);

const getGraphStructureSignature = (
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  layout: 'force' | 'preset',
) => JSON.stringify({ edges, layout, nodes });

const KnowledgeGraphView = ({
  activeNodeId,
  ariaLabel,
  className,
  communities = [],
  edges,
  // "그래프"는 내부 용어다. 사용자에게는 무엇이 없는지로 말한다.
  emptyBody,
  emptyMessage,
  focusedTopicId,
  getNodeTooltip,
  layout = 'preset',
  nodes,
  onFocusedTopicChange,
  onShowCommunityAreasChange,
  onSelectNode,
  showCommunityAreas,
  showActiveNodeControl = true,
}: KnowledgeGraphViewProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SigmaRenderer | null>(null);
  const [localFocusedTopicId, setLocalFocusedTopicId] = useState<string | null>(null);
  const [localShowCommunityAreas, setLocalShowCommunityAreas] = useState(true);
  const [tooltip, setTooltip] = useState<GraphTooltip | null>(null);
  const isFocusedTopicControlled = focusedTopicId !== undefined;
  const isCommunityAreasControlled = showCommunityAreas !== undefined;
  const resolvedFocusedTopicId = isFocusedTopicControlled
    ? (focusedTopicId ?? null)
    : localFocusedTopicId;
  const resolvedShowCommunityAreas = isCommunityAreasControlled
    ? Boolean(showCommunityAreas)
    : localShowCommunityAreas;

  // Selection and the click callback are read through refs so a selection
  // change (or a new callback identity from the parent) does not rebuild the
  // renderer — only a structural nodes/edges change does.
  const activeNodeIdRef = useRef<string | null | undefined>(activeNodeId);
  const focusedTopicIdRef = useRef<string | null>(resolvedFocusedTopicId);
  const hoveredTopicIdRef = useRef<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const showCommunityAreasRef = useRef(resolvedShowCommunityAreas);
  const isFocusedTopicControlledRef = useRef(isFocusedTopicControlled);
  const getNodeTooltipRef = useRef<typeof getNodeTooltip>(getNodeTooltip);
  const onFocusedTopicChangeRef = useRef<typeof onFocusedTopicChange>(onFocusedTopicChange);
  const onSelectRef = useRef<typeof onSelectNode>(onSelectNode);
  const graphCacheRef = useRef<{
    graph: ReturnType<typeof buildKnowledgeGraph>;
    signature: string;
  } | null>(null);
  const communityMemberCacheRef = useRef<{
    groups: KnowledgeGraphCommunityMembers[];
    signature: string;
  } | null>(null);
  const communityMemberGroupsRef = useRef<KnowledgeGraphCommunityMembers[]>([]);

  // Parents reconstruct their node arrays while opening or closing a side
  // panel. Keep Sigma's graph and camera unless the graph data itself changed.
  const graphSignature = getGraphStructureSignature(nodes, edges, layout);
  if (graphCacheRef.current?.signature !== graphSignature) {
    const graph = buildKnowledgeGraph(nodes, edges);
    if (layout === 'force') {
      applyTopicNetworkLayout(graph);
    }
    graphCacheRef.current = { graph, signature: graphSignature };
  }
  const graph = graphCacheRef.current.graph;

  // Sigma redraws while panning and zooming. Cache the memo membership of
  // each area so every frame only projects its known members to the viewport;
  // helper nodes cannot enter a boundary by accident.
  const communityMemberSignature = JSON.stringify({
    communities,
    nodes: nodes.map(node => ({ id: node.id, kind: node.kind, topicId: node.topicId })),
  });
  if (communityMemberCacheRef.current?.signature !== communityMemberSignature) {
    communityMemberCacheRef.current = {
      groups: createCommunityMemoGroups(nodes, communities),
      signature: communityMemberSignature,
    };
  }
  const communityMemberGroups = communityMemberCacheRef.current.groups;
  communityMemberGroupsRef.current = communityMemberGroups;

  const activeNodeExists = Boolean(activeNodeId && graph.hasNode(activeNodeId));

  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    onFocusedTopicChangeRef.current = onFocusedTopicChange;
  }, [onFocusedTopicChange]);

  useEffect(() => {
    isFocusedTopicControlledRef.current = isFocusedTopicControlled;
  }, [isFocusedTopicControlled]);

  useEffect(() => {
    getNodeTooltipRef.current = getNodeTooltip;
  }, [getNodeTooltip]);

  const handleZoomIn = useCallback(() => {
    void rendererRef.current?.getCamera().animatedZoom({
      duration: CAMERA_ANIMATION_DURATION,
      factor: CONTROL_ZOOM_FACTOR,
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    void rendererRef.current?.getCamera().animatedUnzoom({
      duration: CAMERA_ANIMATION_DURATION,
      factor: CONTROL_ZOOM_FACTOR,
    });
  }, []);

  const handleFocusActiveNode = useCallback(() => {
    if (!activeNodeId || !graph.hasNode(activeNodeId)) {
      return;
    }

    const camera = rendererRef.current?.getCamera();

    if (!camera) {
      return;
    }

    void camera.animate(
      {
        x: graph.getNodeAttribute(activeNodeId, 'x'),
        y: graph.getNodeAttribute(activeNodeId, 'y'),
      },
      { duration: CAMERA_ANIMATION_DURATION },
    );
  }, [activeNodeId, graph]);

  const handleResetView = useCallback(() => {
    void rendererRef.current?.getCamera().animatedReset({
      duration: CAMERA_ANIMATION_DURATION,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || graph.order === 0) {
      return undefined;
    }

    const renderer = new SigmaRenderer(graph, container, {
      allowInvalidContainer: true,
      defaultEdgeColor: GRAPH_COLORS.defaultEdge,
      defaultNodeColor: GRAPH_COLORS.defaultNode,
      edgeReducer: createEdgeReducer(
        graph,
        () => activeNodeIdRef.current,
        () => hoveredNodeIdRef.current,
        () => focusedTopicIdRef.current,
        () => hoveredTopicIdRef.current,
      ),
      enableCameraPanning: true,
      enableCameraZooming: true,
      labelColor: { color: '#2c2520' },
      labelDensity: 0.34,
      labelFont: 'inherit',
      labelRenderedSizeThreshold: 7,
      labelSize: 11,
      nodeProgramClasses: { icon: NodeIconProgram },
      nodeReducer: createNodeReducer(
        graph,
        () => activeNodeIdRef.current,
        () => hoveredNodeIdRef.current,
        () => focusedTopicIdRef.current,
        () => hoveredTopicIdRef.current,
      ),
      renderEdgeLabels: false,
      zIndex: true,
    });

    rendererRef.current = renderer;
    const communityCanvas = renderer.createCanvas(COMMUNITY_LAYER_ID, {
      beforeLayer: 'edges',
      // This layer is created after Sigma's initial resize, so give it CSS
      // dimensions explicitly. Otherwise its DPR-sized bitmap also becomes
      // its layout size and community areas render far outside their nodes.
      style: { height: '100%', pointerEvents: 'none', width: '100%' },
    });
    communityCanvas.setAttribute('aria-hidden', 'true');

    let renderedRegions: KnowledgeGraphCommunityRegion[] = [];
    const drawCommunities = () => {
      const dimensions = renderer.getDimensions();
      const pixelRatio = window.devicePixelRatio || 1;
      const canvasWidth = Math.max(1, Math.round(dimensions.width * pixelRatio));
      const canvasHeight = Math.max(1, Math.round(dimensions.height * pixelRatio));
      if (communityCanvas.width !== canvasWidth || communityCanvas.height !== canvasHeight) {
        communityCanvas.width = canvasWidth;
        communityCanvas.height = canvasHeight;
      }

      const context = communityCanvas.getContext('2d');
      if (!context) {
        return;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, dimensions.width, dimensions.height);

      renderedRegions = showCommunityAreasRef.current
        ? communityMemberGroupsRef.current.flatMap(community => {
            const points: { x: number; y: number }[] = [];
            community.memoNodeIds.forEach(node => {
              if (!graph.hasNode(node)) {
                return;
              }
              points.push(
                renderer.graphToViewport({
                  x: graph.getNodeAttribute(node, 'x'),
                  y: graph.getNodeAttribute(node, 'y'),
                }),
              );
            });
            const polygon = createCommunityPolygon(points, COMMUNITY_HULL_PADDING);
            return polygon.length > 0 ? [{ ...community, polygon }] : [];
          })
        : [];

      const focusedTopic = focusedTopicIdRef.current;
      const hoveredTopic = hoveredTopicIdRef.current;
      renderedRegions.forEach(region => {
        const highlighted = region.id === focusedTopic || region.id === hoveredTopic;
        const dimmed = Boolean(focusedTopic && region.id !== focusedTopic);
        context.beginPath();
        region.polygon.forEach((point, index) => {
          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        });
        context.closePath();
        context.fillStyle = region.color;
        // Areas must remain distinguishable at a glance; the fill is quiet,
        // but intentionally not so transparent that only hover reveals it.
        context.globalAlpha = dimmed ? 0.04 : highlighted ? 0.22 : 0.13;
        context.fill();
        context.globalAlpha = dimmed ? 0.16 : highlighted ? 0.84 : 0.58;
        context.lineJoin = 'round';
        context.lineWidth = highlighted ? 2 : 1.25;
        context.setLineDash(highlighted ? [7, 4] : [5, 5]);
        context.strokeStyle = region.color;
        context.stroke();
        context.setLineDash([]);

        if (!highlighted) {
          return;
        }
        const labelX = region.polygon.reduce((sum, point) => sum + point.x, 0) /
          region.polygon.length;
        const labelY = Math.max(
          18,
          Math.min(...region.polygon.map(point => point.y)) - 11,
        );
        context.font = '600 12px system-ui, sans-serif';
        const textWidth = context.measureText(region.label).width;
        const labelWidth = textWidth + 18;
        const labelHeight = 26;
        const labelLeft = Math.min(
          Math.max(6, labelX - labelWidth / 2),
          Math.max(6, dimensions.width - labelWidth - 6),
        );
        const labelTop = labelY - labelHeight / 2;
        context.globalAlpha = 0.94;
        context.fillStyle = '#fffdf9';
        context.beginPath();
        context.roundRect(labelLeft, labelTop, labelWidth, labelHeight, 8);
        context.fill();
        context.globalAlpha = 0.72;
        context.strokeStyle = region.color;
        context.lineWidth = 1;
        context.stroke();
        context.globalAlpha = 1;
        context.fillStyle = '#2c2520';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(region.label, labelLeft + labelWidth / 2, labelTop + labelHeight / 2);
      });
      context.globalAlpha = 1;
    };

    const setFocusedTopic = (topicId: string | null) => {
      focusedTopicIdRef.current = topicId;
      if (!isFocusedTopicControlledRef.current) {
        setLocalFocusedTopicId(topicId);
      }
      onFocusedTopicChangeRef.current?.(topicId);
      renderer.refresh();
    };

    renderer.getCamera().animatedReset({ duration: 250 });

    const handleClickNode = ({ node }: { node: string }) => {
      container.focus({ preventScroll: true });
      setTooltip(null);
      onSelectRef.current?.(node);
    };
    const handleClickStage = ({ event }: { event: { x: number; y: number } }) => {
      container.focus({ preventScroll: true });
      if (!showCommunityAreasRef.current) {
        return;
      }
      const region = findCommunityRegionAtPoint(renderedRegions, event);
      setFocusedTopic(region?.id ?? null);
    };
    const handleMoveBody = ({ event }: { event: { x: number; y: number } }) => {
      if (!showCommunityAreasRef.current) {
        return;
      }
      const nextHoveredTopicId = findCommunityRegionAtPoint(renderedRegions, event)?.id ?? null;
      if (nextHoveredTopicId === hoveredTopicIdRef.current) {
        return;
      }
      hoveredTopicIdRef.current = nextHoveredTopicId;
      renderer.refresh();
    };
    const handleLeaveStage = () => {
      if (!hoveredTopicIdRef.current) {
        return;
      }
      hoveredTopicIdRef.current = null;
      renderer.refresh();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && focusedTopicIdRef.current) {
        setFocusedTopic(null);
      }
    };
    const handleEnterNode = ({
      event,
      node,
    }: {
      event: { x: number; y: number };
      node: string;
    }) => {
      hoveredNodeIdRef.current = node;
      const label = getNodeTooltipRef.current?.(node);
      if (label) {
        setTooltip({
          alignEnd: event.x > container.clientWidth / 2,
          label,
          x: event.x,
          y: event.y,
        });
      } else {
        setTooltip(null);
      }
      renderer.refresh();
    };
    const handleLeaveNode = () => {
      hoveredNodeIdRef.current = null;
      setTooltip(null);
      renderer.refresh();
    };

    renderer.on('clickNode', handleClickNode);
    renderer.on('clickStage', handleClickStage);
    renderer.on('enterNode', handleEnterNode);
    renderer.on('leaveNode', handleLeaveNode);
    renderer.on('moveBody', handleMoveBody);
    renderer.on('leaveStage', handleLeaveStage);
    renderer.on('afterRender', drawCommunities);
    container.addEventListener('keydown', handleKeyDown);

    // CSS grid width changes (such as a pushed side panel closing) do not emit
    // a window resize. Sigma's resize() only changes canvas dimensions and
    // clears WebGL; scheduleRefresh() resizes and redraws in the same frame.
    let animationFrame: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        renderer.scheduleRefresh();
      });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
      renderer.off('clickNode', handleClickNode);
      renderer.off('clickStage', handleClickStage);
      renderer.off('enterNode', handleEnterNode);
      renderer.off('leaveNode', handleLeaveNode);
      renderer.off('moveBody', handleMoveBody);
      renderer.off('leaveStage', handleLeaveStage);
      renderer.off('afterRender', drawCommunities);
      container.removeEventListener('keydown', handleKeyDown);
      renderer.kill();
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
  }, [graph]);

  // Apply selection changes as a cheap refresh (reducers re-run) instead of
  // tearing down and rebuilding the WebGL renderer.
  useEffect(() => {
    activeNodeIdRef.current = activeNodeId;
    rendererRef.current?.refresh();
  }, [activeNodeId]);

  useEffect(() => {
    focusedTopicIdRef.current = resolvedFocusedTopicId;
    rendererRef.current?.refresh();
  }, [resolvedFocusedTopicId]);

  useEffect(() => {
    rendererRef.current?.scheduleRender();
  }, [communityMemberGroups]);

  useEffect(() => {
    showCommunityAreasRef.current = resolvedShowCommunityAreas;
    if (!resolvedShowCommunityAreas) {
      hoveredTopicIdRef.current = null;
    }
    rendererRef.current?.refresh();
  }, [resolvedShowCommunityAreas]);

  const handleToggleCommunityAreas = useCallback(() => {
    const next = !resolvedShowCommunityAreas;
    if (!isCommunityAreasControlled) {
      setLocalShowCommunityAreas(next);
    }
    onShowCommunityAreasChange?.(next);

    // A hidden boundary must not leave the map looking as though an invisible
    // topic is still pinned.
    if (!next && resolvedFocusedTopicId) {
      focusedTopicIdRef.current = null;
      if (!isFocusedTopicControlled) {
        setLocalFocusedTopicId(null);
      }
      onFocusedTopicChange?.(null);
    }
  }, [
    isCommunityAreasControlled,
    isFocusedTopicControlled,
    onFocusedTopicChange,
    onShowCommunityAreasChange,
    resolvedFocusedTopicId,
    resolvedShowCommunityAreas,
  ]);

  const rootClassName = ['knowledge-graph-frame', className].filter(Boolean).join(' ');

  if (nodes.length === 0) {
    return (
      <div className={`${rootClassName} is-empty`} role="img" aria-label={ariaLabel}>
        <EmptyState
          body={emptyBody ?? t('내용이 쌓이면 주변 메모가 나타납니다.', 'Nearby notes will appear as content accumulates.')}
          size="canvas"
          title={emptyMessage ?? t('연결된 메모가 아직 없습니다', 'No connected notes yet')}
          tone="start"
        />
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div
        aria-label={ariaLabel}
        className="knowledge-graph-canvas"
        ref={containerRef}
        role="img"
        tabIndex={0}
      />
      {tooltip && (
        <div
          className="knowledge-graph-node-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: tooltip.alignEnd
              ? 'translate(calc(-100% - 10px), calc(-100% - 10px))'
              : 'translate(10px, calc(-100% - 10px))',
          }}
        >
          {tooltip.label}
        </div>
      )}
      <div className="knowledge-graph-controls">
        <TooltipIconButton
          aria-label={t('그래프 확대', 'Zoom in')}
          className="knowledge-graph-control-button"
          onClick={handleZoomIn}
          tooltip={t('확대', 'Zoom in')}
        >
          <Plus size={15} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={t('그래프 축소', 'Zoom out')}
          className="knowledge-graph-control-button"
          onClick={handleZoomOut}
          tooltip={t('축소', 'Zoom out')}
        >
          <Minus size={15} />
        </TooltipIconButton>
        {showActiveNodeControl && (
          <TooltipIconButton
            aria-label={t('현재 메모로 이동', 'Focus current note')}
            className="knowledge-graph-control-button"
            disabled={!activeNodeExists}
            onClick={handleFocusActiveNode}
            tooltip={t('현재 메모', 'Current note')}
          >
            <FocusNode size={15} />
          </TooltipIconButton>
        )}
        <TooltipIconButton
          aria-label={t('그래프 위치 초기화', 'Reset graph position')}
          className="knowledge-graph-control-button"
          onClick={handleResetView}
          tooltip={t('초기화', 'Reset')}
        >
          <RefreshCw size={15} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={
            resolvedShowCommunityAreas
              ? t('주제 영역 숨기기', 'Hide topic areas')
              : t('주제 영역 보이기', 'Show topic areas')
          }
          className="knowledge-graph-control-button"
          onClick={handleToggleCommunityAreas}
          tooltip={
            resolvedShowCommunityAreas
              ? t('주제 영역 숨기기', 'Hide topic areas')
              : t('주제 영역 보이기', 'Show topic areas')
          }
        >
          {resolvedShowCommunityAreas ? <EyeOff size={15} /> : <Eye size={15} />}
        </TooltipIconButton>
      </div>
    </div>
  );
};

export default KnowledgeGraphView;
