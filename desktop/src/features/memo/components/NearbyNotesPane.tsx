import SubnotaScatterMark from '../../../components/SubnotaScatterMark';
import EmptyState from '../../../components/EmptyState';
import { NETWORK_MIN_SIMILARITY } from '../../../lib/constants';
import { MemoChunk } from '../../../lib/memoChunker';
import { localize } from '../../../lib/uiLanguage';
import type { MemoRow } from '../../../types';
import { LOCAL_SEARCH_ERROR_MESSAGE } from '../../../services/local/localMemoSearch';
import {
  isNetworkSearchRetryableMessage,
  type NetworkSearchResult,
} from '../../../services/local/memoSearchTypes';
import KnowledgeGraphView, {
  type KnowledgeGraphEdge,
  type KnowledgeGraphNode,
} from './KnowledgeGraphView';
import {
  getSimilarityMapGeometry,
  GRAPH_COLORS,
  GRAPH_INBOX_NODE,
  LINK_NODE_ICON,
  NOTE_NODE_ICON,
} from './knowledgeGraph';

type NearbyNotesPaneProps = {
  errorMessage?: string | null;
  isLoading?: boolean;
  language: 'en' | 'ko';
  memos: MemoRow[];
  onOpenResult: (result: NetworkSearchResult) => void;
  onRetry: () => void;
  queryChunk?: MemoChunk | null;
  results?: NetworkSearchResult[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getResultTitle = (
  result: NetworkSearchResult,
  memos: MemoRow[],
  language: 'en' | 'ko',
) => {
  if (result.sourceKind === 'inbox') {
    return result.title || result.sourceLabel || localize(language, '링크', 'Link');
  }
  const memo = result.memoId
    ? memos.find((item) => item.id === result.memoId)
    : null;
  const source = memo?.content ?? result.memoContent ?? result.chunkText ?? '';
  const firstLine = source
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return localize(language, '제목 없는 노트', 'Untitled note');
  }
  return firstLine.length > 22
    ? `${firstLine.slice(0, 22).trimEnd()}…`
    : firstLine;
};

const buildSplitKnnGraph = (
  results: NetworkSearchResult[],
  getLabel: (result: NetworkSearchResult) => string,
  language: 'en' | 'ko',
) => {
  const nodes: KnowledgeGraphNode[] = [
    {
      color: '#1d1d1f',
      id: 'network:query',
      label: localize(language, '현재 메모', 'Current note'),
      size: 15,
      x: 0,
      y: 0,
    },
  ];
  const edges: KnowledgeGraphEdge[] = [];
  const total = Math.max(results.length, 1);
  const similarities = results.map((result) => clamp(result.similarity, 0, 1));
  const lowestSimilarity = Math.min(...similarities, 1);
  const highestSimilarity = Math.max(...similarities, 0);

  results.forEach((result, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const similarity = clamp(result.similarity, 0, 1);
    const geometry = getSimilarityMapGeometry(
      similarity,
      lowestSimilarity,
      highestSimilarity,
      NETWORK_MIN_SIMILARITY,
    );
    const nodeId = `network:${result.chunkId}`;

    nodes.push({
      color:
        result.sourceKind === 'inbox'
          ? GRAPH_INBOX_NODE
          : GRAPH_COLORS.defaultNode,
      id: nodeId,
      image: result.sourceKind === 'inbox' ? LINK_NODE_ICON : NOTE_NODE_ICON,
      label: getLabel(result),
      size: geometry.size,
      x: Math.cos(angle) * geometry.distance,
      y: Math.sin(angle) * geometry.distance,
    });
  });

  return { edges, nodes };
};

const NearbyNotesPane = ({
  errorMessage,
  isLoading,
  language,
  memos,
  onOpenResult,
  onRetry,
  queryChunk,
  results,
}: NearbyNotesPaneProps) => {
  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);
  const isNetworkEmpty =
    !isLoading && !errorMessage && Boolean(queryChunk) && results?.length === 0;
  const canRetry =
    isNetworkSearchRetryableMessage(errorMessage) ||
    errorMessage === LOCAL_SEARCH_ERROR_MESSAGE;
  const graph = buildSplitKnnGraph(
    results ?? [],
    (result) => getResultTitle(result, memos, language),
    language,
  );

  return (
    <div className="split-network-search net-graph-view">
      {errorMessage && (
        <EmptyState
          body={
            canRetry ? (
              <button
                className="quick-date-chip net-error-retry"
                onClick={onRetry}
                type="button"
              >
                {t('다시 시도', 'Try again')}
              </button>
            ) : undefined
          }
          className="net-empty-state"
          size="canvas"
          title={errorMessage}
          tone="start"
        />
      )}
      {isLoading &&
        (results && results.length > 0 ? (
          <span className="net-search-pip" role="status">
            <span aria-hidden="true" className="inline-busy" />
            <span className="net-search-pip-label">
              {t('주변 메모 찾는 중', 'Finding nearby notes')}
            </span>
          </span>
        ) : (
          <div aria-live="polite" className="net-search-bloom" role="status">
            <SubnotaScatterMark />
          </div>
        ))}
      {isNetworkEmpty && (
        <EmptyState
          className="net-empty-state"
          size="canvas"
          title={t(
            '연결된 메모나 저장한 링크가 아직은 없네요!',
            'No related notes or saved links yet.',
          )}
          tone="start"
        />
      )}
      {results && results.length > 0 && (
        <KnowledgeGraphView
          ariaLabel={t(
            '현재 메모 기준 주변 메모와 링크의 유사도 맵',
            'Similarity map of nearby notes and links for the current note',
          )}
          className="net-graph-canvas"
          edges={graph.edges}
          getNodeTooltip={(nodeId) => {
            if (!nodeId.startsWith('network:') || nodeId === 'network:query') {
              return null;
            }
            const chunkId = nodeId.slice('network:'.length);
            const result = results.find((item) => item.chunkId === chunkId);
            return result
              ? `${getResultTitle(result, memos, language)} · ${t('유사도', 'Similarity')} ${Math.round(result.similarity * 100)}%`
              : null;
          }}
          nodes={graph.nodes}
          showActiveNodeControl={false}
          onSelectNode={(nodeId) => {
            if (!nodeId.startsWith('network:') || nodeId === 'network:query') {
              return;
            }
            const chunkId = nodeId.slice('network:'.length);
            const result = results.find((item) => item.chunkId === chunkId);
            if (result) {
              onOpenResult(result);
            }
          }}
        />
      )}
    </div>
  );
};

export default NearbyNotesPane;
