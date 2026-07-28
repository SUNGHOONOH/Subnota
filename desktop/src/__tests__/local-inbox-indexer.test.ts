import { describe, expect, it, vi } from 'vitest';

import { hashText } from '../lib/contentHash';
import {
  createLocalInboxIndexer,
  localInboxEmbeddingText,
} from '../services/local/localInboxIndexer';
import type { InboxSession } from '../services/backend/inboxService';

const item = (patch: Partial<InboxSession> = {}): InboxSession => ({
  canonicalUrl: 'https://example.com/article',
  channelTitle: null,
  createdAt: '2026-07-27T00:00:00.000Z',
  description: '색인 대상이 아닌 설명',
  domain: 'example.com',
  duration: null,
  id: 'inbox-1',
  keywords: ['임베딩', '검색'],
  liked: false,
  originalUrl: 'https://example.com/article',
  publishedAt: null,
  selectedText: '선택한 문장',
  sourceType: 'url',
  summary: '저장한 링크 요약',
  summaryBasis: null,
  summaryDetail: null,
  summaryOneLiner: null,
  summaryProvider: null,
  summarySearchText: '검색용 요약',
  summaryStatus: 'ready',
  thumbnailUrl: null,
  title: '링크 제목',
  userNote: '사용자 메모',
  ...patch,
});

const createApi = () => ({
  localDbDeleteInboxVector: vi.fn(async () => undefined),
  localDbInboxVectorState: vi.fn(async () => []),
  localDbReplaceInboxVector: vi.fn(async () => ({ stored: true })),
  localDbSetOwner: vi.fn(async () => undefined),
  localEmbedForIndex: vi.fn(async () => [
    Array.from({ length: 1024 }, (_, index) => (index === 0 ? 1 : 0)),
  ]),
  localEmbedReleaseIndexModel: vi.fn(async () => undefined),
});

describe('local inbox indexer', () => {
  it('정해진 필드만 모아 한 항목씩 임베딩한다', async () => {
    const api = createApi();
    const indexer = createLocalInboxIndexer({ api });
    const source = localInboxEmbeddingText(item());

    await indexer.reconcile([item()], 'owner-1');

    expect(source).toBe(
      [
        '링크 제목',
        '저장한 링크 요약',
        '검색용 요약',
        '사용자 메모',
        '선택한 문장',
        '임베딩',
        '검색',
      ].join('\n'),
    );
    expect(source).not.toContain('색인 대상이 아닌 설명');
    expect(api.localEmbedForIndex).toHaveBeenCalledWith([source]);
    expect(api.localDbReplaceInboxVector).toHaveBeenCalledWith(
      'owner-1',
      'inbox-1',
      hashText(source),
      source,
      expect.any(Array),
    );
  });

  it('내용 hash가 같은 Inbox는 다시 임베딩하지 않는다', async () => {
    const api = createApi();
    const source = localInboxEmbeddingText(item());
    api.localDbInboxVectorState.mockResolvedValueOnce([
      {
        inboxSessionId: 'inbox-1',
        sourceContentHash: hashText(source),
      },
    ]);
    const indexer = createLocalInboxIndexer({ api });

    await indexer.reconcile([item()], null);

    expect(api.localEmbedForIndex).not.toHaveBeenCalled();
    expect(api.localDbReplaceInboxVector).not.toHaveBeenCalled();
  });
});
