import { useCallback, useEffect, useMemo, useRef } from 'react';
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

interface KnowledgeGraphViewProps {
  activeNodeId?: string | null;
  ariaLabel: string;
  className?: string;
  edges: KnowledgeGraphEdge[];
  emptyMessage?: string;
  // 'preset' renders nodes exactly where the caller placed them; 'force' uses
  // those positions as a seed for ForceAtlas2 + noverlap (topic map).
  layout?: 'force' | 'preset';
  nodes: KnowledgeGraphNode[];
  onSelectNode?: (nodeId: string) => void;
}

const CAMERA_ANIMATION_DURATION = 220;
const CONTROL_ZOOM_FACTOR = 1.25;

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

const KnowledgeGraphView = ({
  activeNodeId,
  ariaLabel,
  className,
  edges,
  emptyMessage = '표시할 그래프가 없습니다.',
  layout = 'preset',
  nodes,
  onSelectNode,
}: KnowledgeGraphViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SigmaRenderer | null>(null);

  // Selection and the click callback are read through refs so a selection
  // change (or a new callback identity from the parent) does not rebuild the
  // renderer — only a structural nodes/edges change does.
  const activeNodeIdRef = useRef<string | null | undefined>(activeNodeId);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const onSelectRef = useRef<typeof onSelectNode>(onSelectNode);

  // Structure only — independent of activeNodeId.
  const graph = useMemo(() => {
    const built = buildKnowledgeGraph(nodes, edges);
    if (layout === 'force') {
      applyTopicNetworkLayout(built);
    }
    return built;
  }, [nodes, edges, layout]);

  const activeNodeExists = Boolean(activeNodeId && graph.hasNode(activeNodeId));

  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

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
      ),
      renderEdgeLabels: false,
      zIndex: true,
    });

    rendererRef.current = renderer;
    renderer.getCamera().animatedReset({ duration: 250 });

    const handleClickNode = ({ node }: { node: string }) => {
      onSelectRef.current?.(node);
    };
    const handleEnterNode = ({ node }: { node: string }) => {
      hoveredNodeIdRef.current = node;
      renderer.refresh();
    };
    const handleLeaveNode = () => {
      hoveredNodeIdRef.current = null;
      renderer.refresh();
    };

    renderer.on('clickNode', handleClickNode);
    renderer.on('enterNode', handleEnterNode);
    renderer.on('leaveNode', handleLeaveNode);

    return () => {
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

  const rootClassName = ['knowledge-graph-frame', className].filter(Boolean).join(' ');

  if (nodes.length === 0) {
    return (
      <div className={rootClassName} role="img" aria-label={ariaLabel}>
        <p className="knowledge-graph-empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div className="knowledge-graph-canvas" ref={containerRef} role="img" aria-label={ariaLabel} />
      <div className="knowledge-graph-controls">
        <TooltipIconButton
          aria-label="그래프 확대"
          className="knowledge-graph-control-button"
          onClick={handleZoomIn}
          tooltip="확대"
        >
          <Plus size={15} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="그래프 축소"
          className="knowledge-graph-control-button"
          onClick={handleZoomOut}
          tooltip="축소"
        >
          <Minus size={15} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="현재 메모로 이동"
          className="knowledge-graph-control-button"
          disabled={!activeNodeExists}
          onClick={handleFocusActiveNode}
          tooltip="현재 메모"
        >
          <FocusNode size={15} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="그래프 위치 초기화"
          className="knowledge-graph-control-button"
          onClick={handleResetView}
          tooltip="초기화"
        >
          <RefreshCw size={15} />
        </TooltipIconButton>
      </div>
    </div>
  );
};

export default KnowledgeGraphView;
