import { useCallback, useEffect, useMemo, useRef } from 'react';
import SigmaRenderer from 'sigma';

import { FocusNode, Minus, Plus, RefreshCw } from '../../../components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';
import {
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
  nodes: KnowledgeGraphNode[];
  onSelectNode?: (nodeId: string) => void;
}

const CAMERA_ANIMATION_DURATION = 220;
const CONTROL_ZOOM_FACTOR = 1.25;

const KnowledgeGraphView = ({
  activeNodeId,
  ariaLabel,
  className,
  edges,
  emptyMessage = '표시할 그래프가 없습니다.',
  nodes,
  onSelectNode,
}: KnowledgeGraphViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<SigmaRenderer | null>(null);

  // Selection and the click callback are read through refs so a selection
  // change (or a new callback identity from the parent) does not rebuild the
  // renderer — only a structural nodes/edges change does.
  const activeNodeIdRef = useRef<string | null | undefined>(activeNodeId);
  const onSelectRef = useRef<typeof onSelectNode>(onSelectNode);

  // Structure only — independent of activeNodeId.
  const graph = useMemo(() => buildKnowledgeGraph(nodes, edges), [nodes, edges]);

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
      edgeReducer: createEdgeReducer(graph, () => activeNodeIdRef.current),
      enableCameraPanning: true,
      enableCameraZooming: true,
      labelColor: { color: '#2c2520' },
      labelDensity: 0.2,
      labelFont: 'inherit',
      labelRenderedSizeThreshold: 8,
      labelSize: 10,
      nodeReducer: createNodeReducer(() => activeNodeIdRef.current),
      renderEdgeLabels: false,
      zIndex: true,
    });

    rendererRef.current = renderer;
    renderer.getCamera().animatedReset({ duration: 250 });

    const handleClickNode = ({ node }: { node: string }) => {
      onSelectRef.current?.(node);
    };

    renderer.on('clickNode', handleClickNode);

    return () => {
      renderer.off('clickNode', handleClickNode);
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
