import { useCallback, useEffect, useMemo, useRef } from 'react';
import Graph from 'graphology';
import SigmaRenderer from 'sigma';

import { FocusNode, Minus, Plus, RefreshCw } from '../../../components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';

export interface KnowledgeGraphNode {
  color?: string;
  id: string;
  label: string;
  muted?: boolean;
  size?: number;
  x: number;
  y: number;
}

export interface KnowledgeGraphEdge {
  color?: string;
  id?: string;
  size?: number;
  source: string;
  target: string;
  weight?: number;
}

interface KnowledgeGraphViewProps {
  activeNodeId?: string | null;
  ariaLabel: string;
  className?: string;
  edges: KnowledgeGraphEdge[];
  emptyMessage?: string;
  nodes: KnowledgeGraphNode[];
  onSelectNode?: (nodeId: string) => void;
}

const ACTIVE_COLOR = '#236b45';
const DEFAULT_NODE_COLOR = '#5c4d3c';
const MUTED_NODE_COLOR = '#c8bda9';
const DEFAULT_EDGE_COLOR = '#d8cebc';
const ACTIVE_EDGE_COLOR = '#7f8a6f';
const CAMERA_ANIMATION_DURATION = 220;
const CONTROL_ZOOM_FACTOR = 1.25;

const normalizeWeight = (weight?: number) => {
  if (!Number.isFinite(weight)) {
    return 0.5;
  }

  return Math.max(0, Math.min(weight ?? 0.5, 1));
};

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
  const graph = useMemo(() => {
    const nextGraph = new Graph({ multi: true, type: 'undirected' });

    nodes.forEach(node => {
      const isActive = node.id === activeNodeId;

      nextGraph.addNode(node.id, {
        color: isActive ? ACTIVE_COLOR : node.color ?? (node.muted ? MUTED_NODE_COLOR : DEFAULT_NODE_COLOR),
        label: node.label,
        size: (node.size ?? 8) + (isActive ? 3 : 0),
        x: node.x,
        y: node.y,
      });
    });

    edges.forEach((edge, index) => {
      if (!nextGraph.hasNode(edge.source) || !nextGraph.hasNode(edge.target)) {
        return;
      }

      const isActiveEdge = edge.source === activeNodeId || edge.target === activeNodeId;
      const weight = normalizeWeight(edge.weight);

      nextGraph.addEdgeWithKey(edge.id ?? `${edge.source}-${edge.target}-${index}`, edge.source, edge.target, {
        color: edge.color ?? (isActiveEdge ? ACTIVE_EDGE_COLOR : DEFAULT_EDGE_COLOR),
        size: edge.size ?? 0.6 + weight * 2.4,
      });
    });

    return nextGraph;
  }, [activeNodeId, edges, nodes]);

  const activeNodeExists = Boolean(activeNodeId && graph.hasNode(activeNodeId));

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
      defaultEdgeColor: DEFAULT_EDGE_COLOR,
      defaultNodeColor: DEFAULT_NODE_COLOR,
      enableCameraPanning: true,
      enableCameraZooming: true,
      labelColor: { color: '#2c2520' },
      labelDensity: 0.2,
      labelFont: 'inherit',
      labelRenderedSizeThreshold: 8,
      labelSize: 10,
      renderEdgeLabels: false,
      zIndex: true,
    });

    rendererRef.current = renderer;
    renderer.getCamera().animatedReset({ duration: 250 });

    const handleClickNode = ({ node }: { node: string }) => {
      onSelectNode?.(node);
    };

    renderer.on('clickNode', handleClickNode);

    return () => {
      renderer.off('clickNode', handleClickNode);
      renderer.kill();
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
  }, [graph, onSelectNode]);

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
