import { useState } from "react";
import { Menu, Skeleton, VisuallyHidden } from "@mantine/core";
import { format } from "date-fns";
import {
  MoreHorizontal,
  RefreshCw,
} from "@/components/icons";
import type {
  MemoRow,
  MemoSimilarityEdge,
  TopicCluster,
  TopicInboxMembership,
  TopicMemoInboxEdge,
  TopicMembership,
} from "../../../types";
import type { InboxSession } from "../../../services/backend/inboxService";
import type { NetworkSearchResult } from "../../../services/local/memoSearchTypes";
import { getMemoCategory } from "../../../lib/memoCategory";
import { localize, useUiLanguage } from "../../../lib/uiLanguage";
import EmptyState from "../../../components/EmptyState";
import KnowledgeGraphView from "./KnowledgeGraphView";
import TopicsCommunityRail from "./TopicsCommunityRail";
import { buildSplitTopicGraph, TOPIC_COLORS } from "../topicsGraphModel";

const formatTopicUpdatedAt = (updatedAt: string | null | undefined) => {
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? null : format(date, "yyyy.MM.dd HH:mm");
};

const TopicsBusyDot = ({ language }: { language: "en" | "ko" }) => (
  <>
    <span aria-hidden="true" className="inline-busy" />
    <VisuallyHidden role="status">
      {localize(language, "Topics 갱신 중", "Updating topics")}
    </VisuallyHidden>
  </>
);

const inboxSessionToSourceResult = (
  item: InboxSession,
): NetworkSearchResult => ({
  chunkId: `inbox-${item.id}`,
  chunkText: item.summaryOneLiner ?? item.summary ?? item.description ?? "",
  createdAt: item.createdAt ? Date.parse(item.createdAt) : null,
  endIndex: 0,
  inboxSessionId: item.id,
  memoContent: null,
  memoCreatedAt: null,
  memoId: null,
  memoUpdatedAt: null,
  similarity: 0,
  sourceKind: "inbox",
  sourceLabel: item.channelTitle ?? item.domain,
  sourceType: item.sourceType,
  sourceUrl: item.canonicalUrl ?? item.originalUrl,
  startIndex: 0,
  thumbnailUrl: item.thumbnailUrl,
  title: item.title,
});

const memoToPreviewResult = (memo: MemoRow): NetworkSearchResult => ({
  chunkId: `memo-${memo.id}`,
  chunkText: "",
  createdAt: memo.created_at ? Date.parse(memo.created_at) : null,
  endIndex: 0,
  inboxSessionId: null,
  memoContent: memo.content,
  memoCreatedAt: memo.created_at ? Date.parse(memo.created_at) : null,
  memoId: memo.id,
  memoUpdatedAt: memo.updated_at ? Date.parse(memo.updated_at) : null,
  similarity: 0,
  sourceKind: "memo",
  sourceLabel: null,
  sourceType: null,
  sourceUrl: null,
  startIndex: 0,
  thumbnailUrl: null,
  title: null,
});

export interface TopicsPaneProps {
  activeMemoId?: string | null;
  folderSourceTopicIds?: string[];
  inboxItems: InboxSession[];
  isTopicsLoading?: boolean;
  onCreateFolderFromTopic?: (draft: {
    description?: string;
    mode: "automatic" | "manual";
    name: string;
    topicId: string;
  }) => Promise<unknown>;
  onOpenMemo: (memo: MemoRow) => void;
  onOpenPreview?: (results: NetworkSearchResult[]) => void;
  onRegenerateTopics?: () => Promise<void>;
  onSelectMemoById: (memoId: string) => void;
  memos: MemoRow[];
  topicClusters: TopicCluster[];
  topicGlobalEdges: MemoSimilarityEdge[];
  topicInboxEdges?: TopicMemoInboxEdge[];
  topicInboxMemberships?: TopicInboxMembership[];
  topicMemberships: TopicMembership[];
  topicUpdatedAt?: string | null;
}

const TopicsPane = ({
  activeMemoId,
  folderSourceTopicIds = [],
  inboxItems,
  isTopicsLoading = false,
  onCreateFolderFromTopic,
  onOpenMemo,
  onOpenPreview,
  onRegenerateTopics,
  onSelectMemoById,
  memos,
  topicClusters,
  topicGlobalEdges,
  topicInboxEdges = [],
  topicInboxMemberships = [],
  topicMemberships,
  topicUpdatedAt = null,
}: TopicsPaneProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const [topicFocusId, setTopicFocusId] = useState<string | null>(null);
  const [focusedMemoId, setFocusedMemoId] = useState<string | null>(null);
  const [isRegeneratingTopics, setIsRegeneratingTopics] = useState(false);
  if (topicClusters.length > 0) {
    const graph = buildSplitTopicGraph(
      topicClusters,
      topicMemberships,
      topicGlobalEdges,
      memos,
      activeMemoId,
      topicInboxMemberships,
      topicInboxEdges,
      inboxItems,
      language,
    );
    return (
      <div className="split-global-network split-topics-stage">
        <div className="split-topics-stage-title">
          <span>
            Topics{isTopicsLoading && <TopicsBusyDot language={language} />}
          </span>
          {onRegenerateTopics && (
            <Menu position="bottom-end" shadow="md" width={228}>
              <Menu.Target>
                <button
                  aria-label={t("Topics 메뉴", "Topics menu")}
                  className="topics-stage-more"
                  type="button"
                >
                  <MoreHorizontal size={17} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  disabled={isRegeneratingTopics}
                  leftSection={<RefreshCw size={15} />}
                  onClick={() => {
                    if (
                      !window.confirm(
                        t(
                          "현재 주제 영역을 전체 메모 기준으로 다시 분석할까요? 주제 이름과 구성은 바뀔 수 있지만 폴더는 바뀌지 않습니다.",
                          "Re-analyze every topic from your current notes? Topic names and membership may change, but folders will not.",
                        ),
                      )
                    )
                      return;
                    setIsRegeneratingTopics(true);
                    void onRegenerateTopics()
                      .catch((error) => {
                        console.warn("Topic regeneration failed:", error);
                        window.alert(
                          t(
                            "주제를 다시 분석하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                            "Could not re-analyze topics. Please try again shortly.",
                          ),
                        );
                      })
                      .finally(() => setIsRegeneratingTopics(false));
                  }}
                >
                  {isRegeneratingTopics
                    ? t("다시 분석 중", "Re-analyzing")
                    : t("주제 다시 분석", "Re-analyze topics")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </div>
        {formatTopicUpdatedAt(topicUpdatedAt) && (
          <span
            className="split-topics-stage-updated-at"
            title={t(
              "Topics 데이터가 마지막으로 갱신된 시간",
              "Time Topics data was last updated",
            )}
          >
            {t("마지막 업데이트", "Last updated")} ·{" "}
            {formatTopicUpdatedAt(topicUpdatedAt)}
          </span>
        )}
        <TopicsCommunityRail
          focusedMemoId={focusedMemoId}
          folderSourceTopicIds={folderSourceTopicIds}
          language={language}
          memos={memos}
          onCreateFolderFromTopic={onCreateFolderFromTopic}
          onFocusMemo={setFocusedMemoId}
          onFocusTopic={setTopicFocusId}
          onOpenMemo={onOpenMemo}
          topicClusters={topicClusters}
          topicFocusId={topicFocusId}
          topicMemberships={topicMemberships}
        />
        <KnowledgeGraphView
          activeNodeId={
            focusedMemoId
              ? `memo:${focusedMemoId}`
              : activeMemoId
                ? `memo:${activeMemoId}`
                : null
          }
          ariaLabel={t("토픽 지식 그래프", "Topic knowledge graph")}
          className="split-knowledge-graph"
          communities={topicClusters.map((cluster, index) => ({
            color: TOPIC_COLORS[index % TOPIC_COLORS.length],
            id: cluster.id,
            label: cluster.label,
          }))}
          edges={graph.edges}
          focusedTopicId={topicFocusId}
          layout="force"
          nodes={graph.nodes}
          onFocusedTopicChange={(topicId) => {
            setTopicFocusId(topicId);
            setFocusedMemoId(null);
          }}
          showActiveNodeControl={false}
          onSelectNode={(nodeId) => {
            if (nodeId.startsWith("inbox:")) {
              const item = inboxItems.find(
                (candidate) => candidate.id === nodeId.slice("inbox:".length),
              );
              if (item) onOpenPreview?.([inboxSessionToSourceResult(item)]);
              return;
            }
            if (nodeId.startsWith("memo:")) {
              const memoId = nodeId.slice("memo:".length);
              const memo = memos.find((candidate) => candidate.id === memoId);
              if (memo) {
                onOpenMemo(memo);
                setFocusedMemoId(memoId);
              }
            }
          }}
        />
      </div>
    );
  }
  const fallbackCategories = Array.from(
    new Set(memos.map((memo) => getMemoCategory(memo.category))),
  );
  if (isTopicsLoading && fallbackCategories.length === 0)
    return (
      <div className="split-global-network split-topics-stage">
        <div className="split-topics-stage-title">
          Topics
          <TopicsBusyDot language={language} />
        </div>
        <div aria-hidden="true" className="split-topics-placeholder">
          {[0, 1, 2].map((index) => (
            <Skeleton
              className="subnota-skeleton split-topics-placeholder-chip"
              height={22}
              key={index}
              radius="xl"
            />
          ))}
        </div>
      </div>
    );
  return (
    <div className="split-global-network">
      <h4>Topics{isTopicsLoading && <TopicsBusyDot language={language} />}</h4>
      {fallbackCategories.length > 0 ? (
        <>
          <p>
            {t(
              "카테고리 기반 임시 묶음",
              "Temporary groups based on categories",
            )}
          </p>
          <div className="split-topic-list">
            {fallbackCategories.map((category) => (
              <button
                key={category}
                className="split-topic-chip"
                onClick={() => {
                  const target = memos.find(
                    (memo) => getMemoCategory(memo.category) === category,
                  );
                  if (target) {
                    onSelectMemoById(target.id);
                    onOpenPreview?.([memoToPreviewResult(target)]);
                  }
                }}
              >
                {category}
              </button>
            ))}
          </div>
          <EmptyState
            size="inline"
            title={t(
              "메모가 쌓이면 주제별로 자동으로 묶입니다",
              "Notes are grouped by topic as they accumulate.",
            )}
          />
        </>
      ) : (
        <EmptyState
          body={t(
            "비슷한 내용끼리 저절로 모입니다.",
            "Similar notes will gather here automatically.",
          )}
          title={t(
            "메모가 쌓이면 주제별로 자동으로 묶입니다",
            "Notes are grouped by topic as they accumulate.",
          )}
          tone="start"
        />
      )}
    </div>
  );
};

export default TopicsPane;
