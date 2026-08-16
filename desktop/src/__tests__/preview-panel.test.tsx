import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import PreviewPanel, {
  type PreviewPanelState,
} from '../features/preview/PreviewPanel';
import { findPreviewHighlight } from '../lib/previewHighlight';
import {
  PREVIEW_PANEL_DEFAULT_WIDTH,
  PREVIEW_PANEL_MAX_WIDTH,
  PREVIEW_PANEL_MIN_WIDTH,
  canPushSidePanel,
  effectiveSidePanelWidth,
  NAV_RAIL_WIDTH,
} from '../lib/previewPanelWidth';
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

const markup = (
  state: PreviewPanelState,
  onCollapse?: () => void,
  onShowMoreResults?: () => void,
  onRetry?: () => void,
) =>
  renderToStaticMarkup(
    <MantineProvider>
      <PreviewPanel
        inboxItems={[]}
        memos={[memo]}
        onClose={vi.fn()}
        onCollapse={onCollapse}
        onPromote={vi.fn()}
        onResizeStart={vi.fn()}
        onRetry={onRetry}
        onSelectResult={vi.fn()}
        onShowMoreResults={onShowMoreResults}
        onShowList={vi.fn()}
        state={state}
      />
    </MantineProvider>,
  );

// ⌘⏎는 "패널을 열어 달라"는 요청이다. 실패를 편집기 쪽 고스트로 되돌리면
// 사용자는 열리지 않은 패널을 기다린다.
describe('목록 열기 실패', () => {
  it('패널 안에서 알리고 다시 시도를 받는다', () => {
    const html = markup(
      { error: '검색하지 못했어요', mode: 'list', result: null, results: [] },
      undefined,
      undefined,
      vi.fn(),
    );

    expect(html).toContain('preview-error');
    expect(html).toContain('검색하지 못했어요');
    expect(html).toContain('다시 시도');
    // 0개짜리 목록 제목이 나오면 "결과가 없다"로 읽힌다.
    expect(html).not.toContain('연결된 문장 0개');
  });

  it('오류 상태에서는 목록을 그리지 않는다', () => {
    const html = markup({
      error: '검색하지 못했어요',
      mode: 'list',
      result: null,
      results: [result()],
    });

    expect(html).not.toContain('preview-list-row');
  });
});

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

  it('검색 결과 상세는 제목 아래에 출처, 작성·수정일과 유사도를 표시한다', () => {
    const html = markup({
      mode: 'detail',
      result: result({
        memoCreatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
        memoUpdatedAt: Date.now() - 24 * 60 * 60 * 1000,
      }),
      results: [],
    });

    expect(html).toContain('메모 · 작성 2일 전 · 수정 어제');
    expect(html).toContain('유사도 80%');
  });

  it('Ambient 상세는 전용 승격 문구와 결과 더보기 동선을 보여준다', () => {
    const html = markup(
      {
        mode: 'detail',
        promotionTooltip: '새 메모 탭으로 열기',
        result: result(),
        results: [result()],
        showMoreResults: true,
      },
      undefined,
      vi.fn(),
    );

    expect(html).toContain('새 메모 탭으로 열기');
    expect(html).toContain('결과 더보기');
  });

  it('사이드 패널 접기 버튼은 콜백이 있을 때만 표시된다', () => {
    expect(
      markup({ mode: 'detail', result: result(), results: [] }),
    ).not.toContain('사이드 패널 접기');
    expect(
      markup({ mode: 'detail', result: result(), results: [] }, vi.fn()),
    ).toContain('사이드 패널 접기');
  });

  it('목록 모드는 개수와 출처·날짜를 함께 보여준다', () => {
    const html = markup({
      mode: 'list',
      result: null,
      results: [
        result(),
        result({
          chunkId: 'chunk-2',
          chunkText: '두 번째',
          createdAt: Date.now() - 24 * 60 * 60 * 1000,
          memoCreatedAt: null,
          sourceKind: 'inbox',
          sourceLabel: 'YouTube',
        }),
      ],
    });

    expect(html).toContain('연결된 문장 2개');
    expect(html).toContain('메모 · 작성 7일 전');
    expect(html).toContain('YouTube · 저장 어제');
    expect(html).toContain('두 번째');
  });

  // 목록에서 들어온 상세에서만 되돌아갈 곳이 있다.
  it('목록에서 온 상세에만 뒤로 버튼이 있다', () => {
    expect(
      markup({ mode: 'detail', result: result(), results: [] }),
    ).not.toContain('목록</button>');
    expect(
      markup({
        isAmbientList: true,
        mode: 'detail',
        result: result(),
        results: [result()],
      }),
    ).toContain('목록</button>');
  });

  it('Ambient Mirror 이외의 미리보기에는 목록으로 돌아가는 동선을 만들지 않는다', () => {
    expect(
      markup({ mode: 'detail', result: result(), results: [result()] }),
    ).not.toContain('목록</button>');
  });
});

describe('사이드 패널 폭/모드', () => {
  // 참조 패널은 본문을 보면서 쓰는 것이라 공간이 되면 밀어낸다. 좁으면
  // 오버레이로 떨어지되, 저장된 폭은 건드리지 않고 표시만 줄인다.
  it('가용 폭의 절반을 넘지 않게 줄여 그린다', () => {
    // 창 775 → 가용 717 → 상한 358
    expect(effectiveSidePanelWidth(775, PREVIEW_PANEL_MAX_WIDTH)).toBe(358);
    // 넓으면 저장값 그대로
    expect(effectiveSidePanelWidth(1440, PREVIEW_PANEL_DEFAULT_WIDTH)).toBe(
      PREVIEW_PANEL_DEFAULT_WIDTH,
    );
  });

  it('최소 폭 아래로는 줄이지 않는다', () => {
    expect(effectiveSidePanelWidth(400, PREVIEW_PANEL_MAX_WIDTH)).toBe(
      PREVIEW_PANEL_MIN_WIDTH,
    );
  });

  it('저장된 폭이 커도 창만 넓으면 밀어낸다', () => {
    // 예전에는 저장 폭 600이면 1250px 창이 필요했는데, 폭을 줄여 그리므로
    // 860px부터 밀어낼 수 있다. (경계는 857 — 그 아래로는 본문이 400을 못 남긴다.)
    expect(canPushSidePanel(860, PREVIEW_PANEL_MAX_WIDTH)).toBe(true);
    expect(canPushSidePanel(900, PREVIEW_PANEL_MAX_WIDTH)).toBe(true);
    expect(canPushSidePanel(850, PREVIEW_PANEL_MAX_WIDTH)).toBe(false);
  });

  it('본문이 읽을 만한 폭을 못 남기면 오버레이', () => {
    expect(canPushSidePanel(775, PREVIEW_PANEL_DEFAULT_WIDTH)).toBe(false);
    expect(canPushSidePanel(850, PREVIEW_PANEL_DEFAULT_WIDTH)).toBe(true);
  });

  it('밀어낸 상태에서 패널은 본문보다 넓지 않다', () => {
    for (const windowWidth of [850, 1000, 1250, 1600]) {
      const panel = effectiveSidePanelWidth(windowWidth, PREVIEW_PANEL_MAX_WIDTH);
      const workspace = windowWidth - NAV_RAIL_WIDTH - panel;
      expect(workspace).toBeGreaterThanOrEqual(panel);
    }
  });
});

describe('사이드 패널 전환 부드러움', () => {
  const styles = readFileSync(
    resolve(__dirname, '../styles/subnota-workspace.scss'),
    'utf8',
  );
  const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

  // 트랙 개수가 2↔3으로 바뀌면 grid-template-columns가 보간되지 않고 점프한다.
  it('사이드 패널 트랙은 닫혀 있어도 0px로 존재한다', () => {
    expect(styles).toMatch(
      /grid-template-columns:\s*\n?\s*var\(--nav-track-width\) minmax\(0, 1fr\)\s*\n?\s*var\(--app-side-panel-track, 0px\)/,
    );
    expect(styles).toMatch(
      /\.app-shell\.side-panel-push\s*\{[\s\S]*?--app-side-panel-track:/,
    );
  });

  // 드래그·창 크기 변경 중에 트랜지션이 살아 있으면 매 프레임 보간이 새로
  // 걸려 레이아웃이 뒤늦게 따라온다.
  it('리사이즈 중에는 트랜지션을 끈다', () => {
    expect(styles).toMatch(
      /\.app-shell\.side-panel-resizing\s*\{[\s\S]*?transition:\s*none/,
    );
    expect(appSource).toContain('setSidePanelResizing(true)');
    expect(appSource).toContain('setWindowResizing(true)');
    expect(appSource).toContain(
      "isSidePanelResizing || isWindowResizing ? 'side-panel-resizing' : ''",
    );
  });

  it('밀어낸 패널을 닫을 때는 그리드 전환만 사용한다', () => {
    expect(appSource).toContain(
      "shouldReduceMotion || isSidePanelPushed ? undefined : { x: '100%' }",
    );
  });
});
