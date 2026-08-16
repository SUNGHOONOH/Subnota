'use client';

/* 주변 메모 지도 / Topics 그래프.
   색은 앱과 같다 — 노드는 브랜드색이 아니라 초록 계열이다. 브랜드색을 데이터에
   쓰면 "관련 있는 메모"와 "여기를 누르라"가 같은 색이 된다.
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
  kind?: 'memo' | 'inbox' | 'center';
}

const fillFor = (kind: GraphNode['kind']) => {
  if (kind === 'center') return ACTIVE;
  if (kind === 'inbox') return INBOX_NODE;
  return NODE;
};

export function KnowledgeGraph({
  nodes,
  centerId,
}: {
  nodes: GraphNode[];
  centerId: string;
}) {
  const center = nodes.find((node) => node.id === centerId);

  return (
    <svg
      aria-hidden="true"
      style={{ display: 'block', height: '100%', width: '100%' }}
      viewBox="0 0 520 320"
    >
      {center &&
        nodes
          .filter((node) => node.id !== centerId)
          .map((node) => (
            <line
              key={`edge-${node.id}`}
              stroke={EDGE}
              strokeWidth={1.5}
              x1={center.x}
              x2={node.x}
              y1={center.y}
              y2={node.y}
            />
          ))}
      {nodes.map((node) => (
        <g key={node.id}>
          <circle cx={node.x} cy={node.y} fill={fillFor(node.kind)} r={node.r} />
          <text
            fill={node.kind === 'center' ? ACTIVE : '#5c5348'}
            fontSize={node.kind === 'center' ? 12 : 11}
            fontWeight={node.kind === 'center' ? 600 : 500}
            textAnchor="middle"
            x={node.x}
            y={node.y + node.r + 14}
          >
            {node.label}
          </text>
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
  memos: string[];
}) {
  return (
    <div className="topic-folder-list">
      {folders.map((folder, index) => (
        <div className="topic-folder" key={folder.label}>
          <div className="topic-folder-head">
            <span
              className="topic-folder-chevron"
              style={{
                transform: index === openIndex ? 'rotate(90deg)' : undefined,
              }}
            >
              ›
            </span>
            <span className="topic-folder-label">{folder.label}</span>
            <span className="topic-folder-count">{folder.count}</span>
          </div>
          {index === openIndex && (
            <div className="topic-folder-memos">
              {memos.map((memo) => (
                <div className="memo-row" key={memo}>
                  <strong>{memo}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
