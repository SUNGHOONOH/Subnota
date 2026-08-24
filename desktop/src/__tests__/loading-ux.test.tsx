import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import WorkspaceBootSkeleton from '../components/WorkspaceBootSkeleton';
import InboxCardSkeleton from '../features/inbox/InboxCardSkeleton';
import SourceDetailPane from '../features/memo/components/SourceDetailPane';
import {
  BOOT_BRAND_PHASE_MS,
  BOOT_FULLSCREEN_MAX_MS,
  resolveBootCloseDelayMs,
  resolveBootMarkVariant,
  resolveBootPhase,
} from '../lib/bootPhase';
import type { InboxSession } from '../services/backend/inboxService';

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '..', relativePath), 'utf8');

const appSource = read('App.tsx');
const splitSource = read('features/memo/components/MemoSplitWorkspace.tsx');
const inboxSource = read('features/inbox/InboxWorkspace.tsx');
const miniSource = read('features/mini/MiniComposer.tsx');
const settingsSource = read('features/settings/SettingsModal.tsx');
const styles = read('styles/subnota-workspace.scss');

const render = (node: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

beforeAll(() => {
  vi.stubGlobal('navigator', { language: 'ko-KR', languages: ['ko-KR'] });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('앱 시작 — 전체 화면 로딩', () => {
  it('브랜드 목업 → 앱 셸 스켈레톤 → 실제 화면 순서로만 넘어간다', () => {
    expect(resolveBootPhase({ elapsedMs: 0, isBooting: true })).toBe('brand');
    expect(
      resolveBootPhase({ elapsedMs: BOOT_BRAND_PHASE_MS - 1, isBooting: true }),
    ).toBe('brand');
    expect(
      resolveBootPhase({ elapsedMs: BOOT_BRAND_PHASE_MS, isBooting: true }),
    ).toBe('shell');
  });

  // 화면을 얼마나 붙잡을지는 resolveBootCloseDelayMs 한 곳에서만 정한다.
  // 단계 판정기가 따로 붙잡으면 규칙이 두 군데로 갈라진다.
  it('부팅이 끝나면 단계 판정기는 경과 시간과 무관하게 ready다', () => {
    expect(resolveBootPhase({ elapsedMs: 0, isBooting: false })).toBe('ready');
    expect(resolveBootPhase({ elapsedMs: 9999, isBooting: false })).toBe('ready');
  });

  it('전체 화면 로딩 상한은 4초를 넘지 않는다', () => {
    expect(BOOT_FULLSCREEN_MAX_MS).toBeLessThanOrEqual(4000);
    expect(BOOT_BRAND_PHASE_MS).toBeLessThan(BOOT_FULLSCREEN_MAX_MS);
    expect(appSource).toContain('BOOT_FULLSCREEN_MAX_MS');
  });

  // 예전에는 첫 서버 동기화(최대 8초)가 끝나야 로딩 화면이 걷혔다.
  // 로컬 퍼스트 앱에서 네트워크가 화면을 잡고 있으면 안 된다.
  it('부팅 게이트는 서버 동기화가 아니라 로컬 준비만 기다린다', () => {
    expect(appSource).toContain('setLocalWorkspaceReady(true)');
    expect(appSource).toContain(
      'if (!isBooting || !isLocalWorkspaceReady) return undefined;',
    );
  });

  // 예전에는 로그인 때 전체 화면을 다시 세우지 않았다. 그 결정을 뒤집었다 —
  // 로그인 화면에서 작업 공간으로 들어오는 순간이 새 계정의 첫 준비가
  // 시작되는 지점이고, 그 시간을 빈 화면으로 두면 앱이 멈춘 것처럼 보인다.
  // 로그인·가입·비밀번호 재설정 세 경로 모두 같은 진입이라 함께 적용한다.
  it('로그인 진입에서 브랜드 로딩을 끝까지 한 번 보여 준다', () => {
    expect(appSource).toContain(
      'const justSignedIn = hasSession && !hadSessionRef.current;',
    );
    expect(appSource).toContain("bootMarkVariantRef.current = 'assemble';");
    // 콜드 스타트는 이미 게이트 안이라 다시 열지 않는다.
    expect(appSource).toContain('if (justSignedIn && !isBooting) {');
  });

  // 정보가 없는 문구를 2.2초마다 갈아 끼우는 것은 기다림을 더 길게 만든다.
  it('브랜드 목업에 메시지 순환을 두지 않는다', () => {
    expect(appSource).not.toContain('BOOT_MESSAGES');
    expect(appSource).not.toContain('bootMessageIndex');
  });

  // 앱을 새로 켜는 일은 드물고 그 한 번이 제품의 첫인상이다.
  // 로컬이 아무리 빨리 붙어도 브랜드 모션은 끝까지 보여 준다.
  it('콜드 스타트는 브랜드 모션을 끝까지 보장한다', () => {
    expect(resolveBootCloseDelayMs(0)).toBe(BOOT_BRAND_PHASE_MS);
    expect(resolveBootCloseDelayMs(800)).toBe(BOOT_BRAND_PHASE_MS - 800);

    // 이미 다 재생됐으면 더 붙잡지 않는다.
    expect(resolveBootCloseDelayMs(BOOT_BRAND_PHASE_MS)).toBe(0);
    expect(resolveBootCloseDelayMs(5000)).toBe(0);
  });

  // 스피너는 끝이 없는 루프라 어디서 끊겨도 잘려 보이지 않는다. 붙잡지 않는다.
  it('스피너 쪽은 준비되는 즉시 넘어간다', () => {
    expect(resolveBootCloseDelayMs(0, { isAssemble: false })).toBe(0);
    expect(resolveBootCloseDelayMs(600, { isAssemble: false })).toBe(0);
  });

  // 조립 모션은 "앱을 껐다 켰다"에만 쓴다. 창만 닫았다 다시 연 것은
  // 프로세스가 살아 있던 것이라 사용자에겐 재시작이 아니다.
  it('조립 모션은 앱을 켠 뒤 첫 창에서만, 새로고침이 아닐 때만 쓴다', () => {
    const variant = (isColdStartWindow: boolean, isReloadNavigation: boolean) =>
      resolveBootMarkVariant({ isColdStartWindow, isReloadNavigation });

    expect(variant(true, false)).toBe('assemble');
    // 앱은 켜져 있고 창만 다시 연 경우.
    expect(variant(false, false)).toBe('spin');
    // 첫 창이어도 ⌘R을 눌렀으면 끝을 알 수 없다.
    expect(variant(true, true)).toBe('spin');
    expect(variant(false, true)).toBe('spin');
  });

  // 부팅 화면은 앱에서 가장 먼저 그려져야 한다. JS 모션 라이브러리를 쓰면
  // 그 번들이 평가될 때까지 브랜드 모션이 멈춰 있다 — 로딩을 줄이려고 만든
  // 화면이 로딩을 늘리는 셈이 된다. Phase A는 CSS만 쓴다.
  it('브랜드 단계는 JS 모션 없이 CSS로만 움직인다', () => {
    const phaseA = appSource.slice(
      appSource.indexOf('// Phase A'),
      appSource.indexOf('if (!session)'),
    );

    expect(phaseA).toContain('<BootBrandMark');
    expect(phaseA).not.toContain('motion.');
  });
});

describe('앱 셸 스켈레톤', () => {
  const markup = render(<WorkspaceBootSkeleton />);

  it('실제 셸 구조(커맨드 바 · 레일 · 사이드바 · 탭 바 · 본문)를 닮는다', () => {
    expect(markup).toContain('boot-skeleton-commandbar');
    expect(markup).toContain('boot-skeleton-rail');
    expect(markup).toContain('boot-skeleton-sidebar-row');
    expect(markup).toContain('boot-skeleton-tabbar');
    expect(markup).toContain('boot-skeleton-doc');
  });

  // 누를 수 없는 것이 눌러야 할 것처럼 보이면 안 된다.
  it('버튼처럼 보이는 조각을 만들지 않는다', () => {
    expect(markup).not.toContain('<button');
  });

  it('큰 안내 문구 대신 보조 기술용 상태만 남긴다', () => {
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('불러오는 중');
  });

  // 실제 메모 목록은 사이드바 높이를 끝까지 채운다. 6줄만 그리면 창이
  // 커질수록 아래가 비어 셸이 아니라 조각처럼 보인다.
  it('사이드바는 창 높이를 채우고 남는 만큼 잘라 낸다', () => {
    expect(markup.split('boot-skeleton-sidebar-row').length - 1).toBeGreaterThanOrEqual(12);
    expect(styles).toMatch(
      /\.boot-skeleton-sidebar \{[\s\S]*?overflow: hidden/,
    );
  });

  // 실제 에디터는 폭 제한 없이 22px 28px 패딩을 쓴다. 스켈레톤만 640px로
  // 좁히면 실제 화면으로 바뀌는 순간 본문이 가로로 튄다.
  it('본문은 실제 에디터와 같은 폭·패딩을 쓴다', () => {
    const doc = styles.slice(
      styles.indexOf('.boot-skeleton-doc {'),
      styles.indexOf('.boot-skeleton-doc {') + 200,
    );

    expect(doc).toContain('padding: 22px 28px');
    expect(doc).toContain('width: 100%');
    expect(doc).not.toContain('max-width');
  });

  // macOS는 네이티브 타이틀 바를 숨기므로 상단 드래그 영역이 사라지면
  // 이 구간에서 창을 옮길 수 없다.
  it('상단 창 이동 영역을 유지한다', () => {
    expect(markup).toContain('loading-screen');
    expect(styles).toMatch(
      /\.loading-screen::before \{[\s\S]*?-webkit-app-region: drag/,
    );
  });
});

describe('수집함(Inbox)', () => {
  it('보여 줄 카드가 없고 불러오는 중일 때만 자리표시자를 쓴다', () => {
    expect(inboxSource).toContain('isLoading && inboxItems.length === 0 && (');
    expect(inboxSource).toContain('<InboxCardSkeleton count={PAGE_SIZE} />');
  });

  // 창이 넓다고 8장을 약속했다가 6장이 도착하면 격자가 줄어든다.
  // 자리표시자 개수는 화면 폭이 아니라 한 페이지에 담기는 수를 따른다.
  it('자리표시자 개수는 한 페이지 크기와 같다', () => {
    const markup = render(<InboxCardSkeleton count={4} />);

    // 카드마다 정확히 하나씩 나오는 표식으로 센다.
    expect(markup.split('inbox-thumbnail').length - 1).toBe(4);
    expect(inboxSource).toContain('const PAGE_SIZE = 6;');
  });

  // 카드가 하나라도 있으면 그 화면을 그대로 두고 뒤에서 갱신한다.
  it('기존 카드가 있으면 자리표시자로 덮지 않는다', () => {
    expect(inboxSource).not.toContain('isLoading && <InboxCardSkeleton');
    expect(inboxSource).not.toContain('{isLoading ? <InboxCardSkeleton');
  });

  it('원격 썸네일과 favicon 요청에 referrer를 보내지 않는다', () => {
    expect(inboxSource.match(/referrerPolicy="no-referrer"/g)).toHaveLength(2);
  });

  it('불러오는 중에는 빈 상태 문구를 함께 띄우지 않는다', () => {
    expect(inboxSource).toContain('{!isLoading && inboxItems.length === 0 && (');
    expect(inboxSource).toContain(
      '{!isLoading && inboxItems.length > 0 && filtered.length === 0 && (',
    );
  });

  it('수집함 메뉴에 수동 새로고침을 두지 않는다', () => {
    expect(inboxSource).not.toContain('새로고침');
    expect(inboxSource).not.toContain('onRefresh');
  });

  it('자리표시자가 실제 카드와 같은 영역을 차지한다', () => {
    const markup = render(<InboxCardSkeleton count={1} />);

    expect(markup).toContain('inbox-card');
    expect(markup).toContain('inbox-thumbnail');
    expect(markup).toContain('inbox-card-title');
    expect(markup).toContain('inbox-card-source');
    expect(markup).toContain('inbox-card-summary');
    // 좋아요·삭제는 hover 전용 절대 배치라 자리를 차지하지 않는다.
    // 마지막 슬롯은 키워드다.
    expect(markup).toContain('inbox-card-keywords');
    expect(markup).not.toContain('inbox-card-actions');
    expect(markup).not.toContain('<button');
  });
});

describe('State B — 주변 메모 검색', () => {
  // 결과 노드 수도 위치도 정해져 있지 않아 카드 스켈레톤을 쓸 수 없다.
  it('그래프 영역 안에서만, 카드 스켈레톤 없이 표시한다', () => {
    expect(splitSource).toContain('<SubnotaScatterMark />');
    expect(splitSource).not.toContain('net-search-skeleton');
    expect(styles).toMatch(/\.net-search-bloom \{[\s\S]*?position: absolute/);
  });

  // 1초 안에 끝나는 검색에서 문구가 깜빡이면 그게 더 산만하다.
  // 모션이 이미 "찾는 중"을 말한다. 문구까지 겹치면 작은 그래프 영역에
  // 신호가 둘이 되어 산만하다.
  it('로딩 문구 없이 모션만 쓴다', () => {
    const bloom = splitSource.slice(
      splitSource.indexOf('className="net-search-bloom"'),
      splitSource.indexOf('className="net-search-bloom"') + 260,
    );

    expect(bloom).toContain('<SubnotaScatterMark />');
    expect(bloom).not.toContain('주변 메모 찾는 중');
    expect(styles).not.toContain('.net-search-bloom-label');
    // 재검색 중의 작은 pip 표시는 문구를 유지한다 — 그래프를 덮지 않으므로
    // 무엇이 도는 중인지 말해 줄 자리가 거기밖에 없다.
    expect(splitSource).toContain('net-search-pip-label');
  });

  // 잎이 바깥으로 나가면서 원이 된다. 두 path의 명령 개수가 어긋나면
  // CSS가 d를 보간하지 못해 모양이 툭 바뀐다.
  it('잎과 원이 같은 명령 구조라 모프된다', () => {
    const round = styles.slice(
      styles.indexOf('@keyframes net-search-round'),
      styles.indexOf('@keyframes net-search-round') + 900,
    );
    const commandCounts = [...round.matchAll(/d:\s*path\(\s*['"]([^'"]+)['"]/g)].map(
      match => (match[1].match(/C/g) ?? []).length,
    );

    expect(commandCounts).toHaveLength(2);
    expect(commandCounts[0]).toBe(commandCounts[1]);
  });

  it('재검색이면 기존 그래프를 지우지 않고 작은 표시만 얹는다', () => {
    expect(splitSource).toContain('net-search-pip');
    // 검색 시작 패치에서 결과를 비우면 그래프가 사라진다.
    const searchStart = splitSource.slice(
      splitSource.indexOf('networkRequestId,\n        view:'),
      splitSource.indexOf('const response = await searchStateB'),
    );
    expect(searchStart).not.toContain('networkResults: []');
  });

  it('검색 실패의 다시 시도 동작은 그대로 둔다', () => {
    expect(splitSource).toContain('isNetworkSearchRetryableMessage');
    expect(splitSource).toContain('void runEditorStateBSearch(pane, editor)');
  });

  it('정상 응답의 빈 결과는 오류 카드 대신 로고 빈 상태로 보인다', () => {
    expect(splitSource).toContain('const isNetworkEmpty =');
    expect(splitSource).toContain('<EmptyState');
    expect(splitSource).toContain('className="net-empty-state"');
    expect(splitSource).toContain('tone="start"');
    expect(splitSource).toContain(
      '연결된 메모나 저장한 링크가 아직은 없네요!',
    );
    expect(splitSource).not.toContain('response.message ?? NETWORK_SEARCH_EMPTY_MESSAGE');
  });
});

describe('Topics', () => {
  it('기존 clusters가 있으면 지우지 않고 제목 옆 표시만 더한다', () => {
    expect(splitSource).toContain(
      '{isTopicsLoading && <TopicsBusyDot language={language} />}',
    );
    expect(splitSource).not.toContain('Topics 계산 결과를 불러오는 중');
  });

  // 서버 계산이 오래 걸려도 로컬 카테고리 폴백은 계속 쓸 수 있어야 한다.
  it('보여 줄 것이 정말 없을 때만 자리표시자를 쓴다', () => {
    expect(splitSource).toContain(
      'if (isTopicsLoading && fallbackCategories.length === 0) {',
    );
  });

  it('갱신 중이라는 신호를 App이 계속 흘려보낸다', () => {
    expect(appSource).toContain('isTopicsLoading={isRefreshing}');
    expect(appSource).not.toContain(
      'isTopicsLoading={isRefreshing && topicClusters.length === 0}',
    );
  });
});

describe('웹 요약 — SourceDetailPane', () => {
  const item = (patch: Partial<InboxSession>): InboxSession => ({
    canonicalUrl: null,
    channelTitle: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    description: null,
    domain: 'example.com',
    duration: null,
    id: 'inbox-1',
    keywords: [],
    liked: false,
    originalUrl: 'https://example.com/a',
    publishedAt: null,
    selectedText: null,
    sourceType: 'url',
    summary: null,
    summaryBasis: null,
    summaryDetail: null,
    summaryOneLiner: null,
    summaryProvider: null,
    summarySearchText: null,
    summaryStatus: 'ready',
    thumbnailUrl: null,
    title: '테스트 링크',
    userNote: null,
    ...patch,
  });

  it('실제로 만드는 중일 때만 본문 자리표시자를 쓴다', () => {
    const markup = render(<SourceDetailPane item={item({ summaryStatus: 'pending' })} />);

    expect(markup).toContain('source-reader-skeleton');
    expect(markup).toContain('요약을 만드는 중');
  });

  // "아직 없다"와 "만드는 중이다"는 다른 상태다. 뭉개면 영영 오지 않을
  // 요약을 기다리게 된다.
  it('데이터가 없을 뿐이면 없다고 말한다', () => {
    const markup = render(<SourceDetailPane item={item({ summaryStatus: 'ready' })} />);

    expect(markup).toContain('요약이 없습니다.');
    expect(markup).not.toContain('source-reader-skeleton');
    expect(markup).not.toContain('준비하고 있습니다');
  });

  it('실패는 자리표시자가 아니라 오류 문구로 알린다', () => {
    const markup = render(
      <SourceDetailPane
        item={item({ summaryStatus: 'failed' })}
        onRetrySummary={() => Promise.resolve()}
      />,
    );

    expect(markup).toContain('source-reader-failed');
    expect(markup).toContain('원본 링크는 그대로 보관되어 있습니다.');
    expect(markup).toContain('요약 다시 시도');
    expect(markup).not.toContain('source-reader-skeleton');
  });

  it('원격 썸네일과 favicon 요청에 referrer를 보내지 않는다', () => {
    const markup = render(
      <SourceDetailPane
        item={item({ thumbnailUrl: 'https://images.example.com/thumb.jpg' })}
      />,
    );

    expect(
      markup.match(/<img[^>]*referrer[Pp]olicy="no-referrer"[^>]*>/g),
    ).toHaveLength(2);
  });
});

describe('Mini 저장', () => {
  it('저장 Promise가 도는 동안만 상태를 보여 준다', () => {
    expect(miniSource).toContain('const [isSaving, setSaving] = useState(false);');
    expect(miniSource).toContain('저장 중…');
    expect(miniSource).toContain('disabled={isSaving}');
  });

  it('중복 저장 요청을 막되 기존 성공·실패 흐름은 그대로 둔다', () => {
    expect(miniSource).toContain('if (isSaving) {');
    expect(miniSource).toContain('notifyMiniSaved');
    expect(miniSource).toContain('로컬 저장에 실패했습니다. 다시 시도해 주세요.');
  });
});

describe('Ambient Mirror — 자동 검색', () => {
  // 자동 검색은 사용자가 시킨 적이 없다. 진행 표시가 뜨면 그 자체가 방해다.
  it('자동 검색 중에는 어떤 로딩 UI도 만들지 않는다', () => {
    const ambientGhost = splitSource.slice(
      splitSource.indexOf('ambient-empty-notice'),
      splitSource.indexOf('ambient-inline-error'),
    );

    expect(ambientGhost).not.toContain('Skeleton');
    expect(ambientGhost).not.toContain('inline-busy');
    expect(ambientGhost).not.toContain('net-search-bloom');
  });

  it('수동 검색의 오류·다시 시도는 유지한다', () => {
    expect(splitSource).toContain('ambient-inline-error');
  });
});

describe('설정 화면', () => {
  it('큰 스피너나 별도 모달 없이 작은 표시만 더한다', () => {
    expect(settingsSource).toContain('className="inline-busy"');
    expect(settingsSource).toContain('상태를 확인하는 중...');
    expect(settingsSource).toContain('모델을 여는 중...');
    expect(settingsSource).toContain('동기화 중...');
  });

  it('상태 문구가 길어져도 버튼 폭이 흔들리지 않는다', () => {
    expect(settingsSource).toContain('className="settings-sync-action"');
    expect(styles).toMatch(/\.settings-sync-action \{[\s\S]*?min-width: 84px/);
  });
});

describe('모션 · 접근성 기준', () => {
  it('reduced motion에서는 shimmer와 pulse가 멈춘다', () => {
    const reduced = styles.slice(styles.lastIndexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reduced).toContain('.subnota-skeleton::after');
    expect(reduced).toContain('.inline-busy');
    expect(reduced).toContain('.subnota-scatter-petal');
    expect(reduced).toContain('.local-index-progress::before');
  });

  // 스켈레톤은 구조가 정해진 콘텐츠에만. 토스트·모달·드롭다운에는 쓰지 않는다.
  it('진행 토스트에는 스켈레톤을 넣지 않는다', () => {
    expect(read('features/search/LocalIndexProgress.tsx')).not.toContain('Skeleton');
    expect(read('features/search/EmbeddingModelGate.tsx')).not.toContain('Skeleton');
    expect(read('features/update/UpdatePopover.tsx')).not.toContain('Skeleton');
  });

  // 모델 안내 모달과 진행 토스트가 같은 작업을 두 번 알리면 안 된다.
  it('모델 다운로드는 안내 모달을 닫고 진행 토스트 하나만 남긴다', () => {
    expect(appSource).toMatch(
      /onDownload=\{\(\) => \{\s*\n\s*setEmbeddingGateOpen\(false\);\s*\n\s*void startModelDownload\(\);/,
    );
  });
});
