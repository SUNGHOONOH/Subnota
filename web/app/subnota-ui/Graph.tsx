'use client';

/* 주변 메모 지도 / Topics 그래프.
   노드 색은 앱의 상태색을 빌리되 주제 클러스터를 구분하는 용도로만 쓴다.
   브랜드 액션색과 섞지 않아 "관련 있는 메모"와 "여기를 누르라"가 같은 색으로
   읽히지 않게 한다.
   원본은 desktop/src/features/memo/components/knowledgeGraph.ts. */

const NODE = '#396f55';
const INBOX_NODE = '#6d7185';
const EDGE = '#e6e3dd';
const ACTIVE = '#1d1d1f';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  kind?: 'memo' | 'inbox' | 'center' | 'topic';
  color?: string;
  hideLabel?: boolean;
}

const fillFor = (kind: GraphNode['kind']) => {
  if (kind === 'center' || kind === 'topic') return ACTIVE;
  if (kind === 'inbox') return INBOX_NODE;
  return NODE;
};

export interface GraphEdge {
  from: string;
  to: string;
  color?: string;
}

export function KnowledgeGraph({
  nodes,
  centerId,
  edges,
}: {
  nodes: GraphNode[];
  centerId: string;
  edges?: GraphEdge[];
}) {
  const center = nodes.find((node) => node.id === centerId);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const graphEdges: GraphEdge[] =
    edges ??
    nodes
      .filter((node) => node.id !== centerId)
      .map((node) => ({ from: centerId, to: node.id }));

  return (
    <svg
      aria-hidden="true"
      style={{ display: 'block', height: '100%', width: '100%' }}
      viewBox="0 0 520 320"
    >
      {center &&
        graphEdges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`edge-${edge.from}-${edge.to}`}
              stroke={edge.color ?? EDGE}
              strokeWidth={edge.color ? 2 : 1.5}
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            />
          );
        })}
      {nodes.map((node) => (
        <g key={node.id}>
          {node.kind === 'memo' || node.kind === 'inbox' ? (
            <>
              <circle
                cx={node.x}
                cy={node.y}
                fill="#fff"
                r={node.r}
                stroke={node.color ?? fillFor(node.kind)}
                strokeWidth={2}
              />
              <path
                d={`M${node.x - 3},${node.y - 4}h4l2,2v6h-6z M${node.x + 1},${node.y - 4}v3h2`}
                fill="none"
                stroke={node.color ?? fillFor(node.kind)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
              />
            </>
          ) : (
            <circle
              cx={node.x}
              cy={node.y}
              fill={node.color ?? fillFor(node.kind)}
              r={node.r}
              stroke={node.kind === 'topic' ? '#fff' : undefined}
              strokeWidth={node.kind === 'topic' ? 2 : undefined}
            />
          )}
          {!node.hideLabel && (
            <text
              fill={node.kind === 'center' || node.kind === 'topic' ? ACTIVE : '#5c5348'}
              fontSize={node.kind === 'center' || node.kind === 'topic' ? 12 : 10}
              fontWeight={node.kind === 'center' || node.kind === 'topic' ? 600 : 500}
              textAnchor="middle"
              x={node.x}
              y={node.y + node.r + 14}
            >
              {node.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* 토픽 폴더 목록 — 사이드바의 폴더 모드. 배치는 앱의 `.topic-folder-*`와 같다. */
export function TopicFolders({
  folders,
  openIndex = 0,
  memos,
}: {
  folders: { label: string; count: number }[];
  openIndex?: number;
  memos: Array<string | { title: string; meta?: string }>;
}) {
  return (
    <div className="topic-folder-list">
      {folders.map((folder, index) => (
        <div className="topic-folder" key={folder.label}>
          <div className="topic-folder-head">
            <span className="topic-folder-chevron">
              <ChevronRightIcon open={index === openIndex} />
            </span>
            <span className="topic-folder-icon">
              <FolderIcon />
            </span>
            <span className="topic-folder-label">{folder.label}</span>
            <span className="topic-folder-count">{folder.count}</span>
          </div>
          {index === openIndex && (
            <div className="topic-folder-memos">
              {memos.map((memo) => {
                const title = typeof memo === 'string' ? memo : memo.title;
                const meta = typeof memo === 'string' ? undefined : memo.meta;
                return (
                <div className="memo-row" key={title}>
                  <strong>{title}</strong>
                  {meta && <span>{meta}</span>}
                </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChevronRightIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="m9 5 7 7-7 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        style={{ transform: open ? 'rotate(90deg)' : undefined, transformOrigin: '12px 12px' }}
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M3.5 6.5h6l2 2h9v9.25a1.75 1.75 0 0 1-1.75 1.75H5.25a1.75 1.75 0 0 1-1.75-1.75z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
