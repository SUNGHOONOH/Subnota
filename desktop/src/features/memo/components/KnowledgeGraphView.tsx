import { useCallback, useEffect, useRef, useState } from 'react';
import SigmaRenderer from 'sigma';
import { createNodeBorderProgram } from '@sigma/node-border';
import { createNodeImageProgram } from '@sigma/node-image';
import { createNodeCompoundProgram, NodeCircleProgram } from 'sigma/rendering';

import { FocusNode, Minus, Plus, RefreshCw } from '../../../components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';
import {
  applyTopicNetworkLayout,
  buildKnowledgeGraph,
  createEdgeReducer,
  createNodeReducer,
  GRAPH_COLORS,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from './knowledgeGraph';

export type { KnowledgeGraphEdge, KnowledgeGraphNode } from './knowledgeGraph';
import EmptyState from '../../../components/EmptyState';
import { localize, useUiLanguage } from '../../../lib/uiLanguage';

interface KnowledgeGraphViewProps {
  activeNodeId?: string | null;
  ariaLabel: string;
  className?: string;
  edges: KnowledgeGraphEdge[];
  emptyBody?: string;
  emptyMessage?: string;
  focusedTopicId?: string | null;
  showActiveNodeControl?: boolean;
  // 'preset' renders nodes exactly where the caller placed them; 'force' uses
  // those positions as a seed for ForceAtlas2 + noverlap (topic map).
  layout?: 'force' | 'preset';
  nodes: KnowledgeGraphNode[];
  getNodeTooltip?: (nodeId: string) => string | null;
  onSelectNode?: (nodeId: string) => void;
}

const CAMERA_ANIMATION_DURATION = 220;
const CONTROL_ZOOM_FACTOR = 1.25;

interface GraphTooltip {
  alignEnd: boolean;
  label: string;
  x: number;
  y: number;
}

// Topic hubs render with a thin dark ring (nodes with type: 'border').
const NodeBorderProgram = createNodeBorderProgram({
  borders: [
    { color: { attribute: 'borderColor' }, size: { value: 0.12 } },
    { color: { attribute: 'color' }, size: { fill: true } },
  ],
});

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
  edges,
  // "그래프"는 내부 용어다. 사용자에게는 무엇이 없는지로 말한다.
  emptyBody,
  emptyMessage,
  focusedTopicId = null,
  getNodeTooltip,
  layout = 'preset',
  nodes,
  onSelectNode,
  showActiveNodeControl = true,
}: KnowledgeGraphViewProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SigmaRenderer | null>(null);
  const [tooltip, setTooltip] = useState<GraphTooltip | null>(null);

  // Selection and the click callback are read through refs so a selection
  // change (or a new callback identity from the parent) does not rebuild the
  // renderer — only a structural nodes/edges change does.
  const activeNodeIdRef = useRef<string | null | undefined>(activeNodeId);
  const focusedTopicIdRef = useRef<string | null>(focusedTopicId);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const getNodeTooltipRef = useRef<typeof getNodeTooltip>(getNodeTooltip);
  const onSelectRef = useRef<typeof onSelectNode>(onSelectNode);
  const graphCacheRef = useRef<{
    graph: ReturnType<typeof buildKnowledgeGraph>;
    signature: string;
  } | null>(null);

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

  const activeNodeExists = Boolean(activeNodeId && graph.hasNode(activeNodeId));

  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

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
      ),
      enableCameraPanning: true,
      enableCameraZooming: true,
      labelColor: { color: '#2c2520' },
      labelDensity: 0.34,
      labelFont: 'inherit',
      labelRenderedSizeThreshold: 7,
      labelSize: 11,
      nodeProgramClasses: { border: NodeBorderProgram, icon: NodeIconProgram },
      nodeReducer: createNodeReducer(
        graph,
        () => activeNodeIdRef.current,
        () => hoveredNodeIdRef.current,
        () => focusedTopicIdRef.current,
      ),
      renderEdgeLabels: false,
      zIndex: true,
    });

    rendererRef.current = renderer;
    renderer.getCamera().animatedReset({ duration: 250 });

    const handleClickNode = ({ node }: { node: string }) => {
      setTooltip(null);
      onSelectRef.current?.(node);
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
    renderer.on('enterNode', handleEnterNode);
    renderer.on('leaveNode', handleLeaveNode);

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
      renderer.off('enterNode', handleEnterNode);
      renderer.off('leaveNode', handleLeaveNode);
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
    focusedTopicIdRef.current = focusedTopicId;
    rendererRef.current?.refresh();
  }, [focusedTopicId]);

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
      <div className="knowledge-graph-canvas" ref={containerRef} role="img" aria-label={ariaLabel} />
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
      </div>
    </div>
  );
};

export default KnowledgeGraphView;
