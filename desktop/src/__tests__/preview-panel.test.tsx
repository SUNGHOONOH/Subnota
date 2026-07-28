import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import PreviewPanel, {
  type PreviewPanelState,
} from '../features/preview/PreviewPanel';
import { findPreviewHighlight } from '../lib/previewHighlight';
import type { NetworkSearchResult } from '../services/backend/networkService';
import type { MemoRow } from '../types';

const CONTENT = '앞 문장입니다.\nSQLite WAL 모드 전환 후기\n뒤 문장입니다.';
const CHUNK = 'SQLite WAL 모드 전환 후기';
const START = CONTENT.indexOf(CHUNK);

describe('findPreviewHighlight', () => {
  it('인덱스가 본문과 맞으면 그대로 쓴다', () => {
    expect(
      findPreviewHighlight(CONTENT, CHUNK, START, START + CHUNK.length),
    ).toEqual({ end: START + CHUNK.length, start: START });
  });

  // start/end는 색인 시점 기준이라 그 뒤 편집으로 어긋난다. 어긋난 인덱스를
  // 그대로 잘라 쓰면 엉뚱한 구간이 강조된다.
  it('인덱스가 어긋나면 텍스트로 다시 찾는다', () => {
    expect(findPreviewHighlight(CONTENT, CHUNK, 0, 4)).toEqual({
      end: START + CHUNK.length,
      start: START,
    });
  });

  it('본문 밖을 가리키는 인덱스도 텍스트로 복구한다', () => {
    expect(findPreviewHighlight(CONTENT, CHUNK, 9999, 10_000)).toEqual({
      end: START + CHUNK.length,
      start: START,
    });
  });

  // 잘못된 구간을 강조하는 것보다 강조가 없는 편이 낫다.
  it('본문에 없는 청크는 강조하지 않는다', () => {
    expect(findPreviewHighlight(CONTENT, '본문에 없는 문장', 0, 5)).toBeNull();
    expect(findPreviewHighlight(CONTENT, '', 0, 5)).toBeNull();
  });
});

const memo = {
  content: CONTENT,
  created_at: '2026-07-18T10:00:00.000Z',
  id: 'memo-1',
  updated_at: '2026-07-18T10:00:00.000Z',
} as unknown as MemoRow;

const result = (patch: Partial<NetworkSearchResult> = {}): NetworkSearchResult => ({
  chunkId: 'chunk-1',
  chunkText: CHUNK,
  createdAt: null,
  endIndex: START + CHUNK.length,
  inboxSessionId: null,
  memoContent: CONTENT,
  memoCreatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  memoId: 'memo-1',
  memoUpdatedAt: null,
  similarity: 0.8,
  sourceKind: 'memo',
  sourceLabel: null,
  sourceType: null,
  sourceUrl: null,
  startIndex: START,
  thumbnailUrl: null,
  title: null,
  ...patch,
});

const markup = (state: PreviewPanelState) =>
  renderToStaticMarkup(
    <PreviewPanel
      inboxItems={[]}
      memos={[memo]}
      onClose={vi.fn()}
      onPromote={vi.fn()}
      onResizeStart={vi.fn()}
      onSelectResult={vi.fn()}
      onShowList={vi.fn()}
      state={state}
    />,
  );

describe('PreviewPanel', () => {
  it('상세 모드는 청크만 감싸고 앞뒤 본문을 그대로 보여준다', () => {
    const html = markup({ mode: 'detail', result: result(), results: [] });

    expect(html).toContain(`<mark class="preview-highlight">${CHUNK}</mark>`);
    expect(html).toContain('앞 문장입니다.');
    expect(html).toContain('뒤 문장입니다.');
  });

  it('상세 모드에만 승격 버튼이 있다', () => {
    expect(markup({ mode: 'detail', result: result(), results: [] })).toContain(
      '새 탭으로 열기',
    );
    expect(
      markup({ mode: 'list', result: null, results: [result()] }),
    ).not.toContain('새 탭으로 열기');
  });

  it('목록 모드는 개수와 상대 날짜를 함께 보여준다', () => {
    const html = markup({
      mode: 'list',
      result: null,
      results: [result(), result({ chunkId: 'chunk-2', chunkText: '두 번째' })],
    });

    expect(html).toContain('연결된 문장 2개');
    expect(html).toContain('7일 전');
    expect(html).toContain('두 번째');
  });

  // 목록에서 들어온 상세에서만 되돌아갈 곳이 있다.
  it('목록에서 온 상세에만 뒤로 버튼이 있다', () => {
    expect(
      markup({ mode: 'detail', result: result(), results: [] }),
    ).not.toContain('목록</button>');
    expect(
      markup({ mode: 'detail', result: result(), results: [result()] }),
    ).toContain('목록</button>');
  });
});
