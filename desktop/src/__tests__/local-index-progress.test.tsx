import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import LocalIndexProgress, {
  isEmptyLocalIndexCompletion,
  shouldShowLocalIndexProgress,
} from '../features/search/LocalIndexProgress';
import type { LocalMemoIndexProgress } from '../services/local/localMemoIndexer';

beforeAll(() => {
  vi.stubGlobal('navigator', { language: 'ko-KR', languages: ['ko-KR'] });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const progress = (
  patch: Partial<LocalMemoIndexProgress>,
): LocalMemoIndexProgress => ({
  completedChunks: 0,
  downloadedBytes: 0,
  isInitialIndex: false,
  isVisible: true,
  ownerId: null,
  stage: 'preparing',
  totalBytes: 0,
  totalChunks: 0,
  ...patch,
});

describe('LocalIndexProgress', () => {
  it('첫 모델 다운로드 byte 진행률을 표시한다', () => {
    const html = renderToStaticMarkup(
      <LocalIndexProgress
        progress={progress({
          downloadedBytes: 300_000_000,
          stage: 'downloading',
          totalBytes: 586_000_000,
        })}
      />,
    );

    // "모델"·"색인"·"청크"는 내부 용어다. 사용자 문구에 나오면 안 된다.
    expect(html).toContain('검색 준비 파일 받는 중');
    expect(html).toContain('300 / 586MB');
    expect(html).toContain('max="586000000"');
    expect(html).not.toContain('모델');
    expect(html).not.toContain('로컬');
  });

  it('전체 색인의 완료 청크 수를 표시한다', () => {
    const html = renderToStaticMarkup(
      <LocalIndexProgress
        progress={progress({
          completedChunks: 123,
          stage: 'indexing',
          totalChunks: 618,
        })}
      />,
    );

    expect(html).toContain('메모를 정리하는 중');
    expect(html).toContain('123 / 618');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('문장');
  });

  it('색인할 변경이 없으면 준비 표시를 닫는다', () => {
    expect(
      isEmptyLocalIndexCompletion(
        progress({ stage: 'complete', totalChunks: 0 }),
      ),
    ).toBe(true);
    expect(
      isEmptyLocalIndexCompletion(
        progress({ stage: 'indexing', totalChunks: 1 }),
      ),
    ).toBe(false);
  });

  // blur 정리와 자동 ambient 검색은 사용자가 시킨 적 없는 배경 작업이다.
  // 다른 메모를 클릭했을 뿐인데 토스트가 뜨고 닫으라고 하면 안 된다.
  it('사용자가 시키지 않은 실행은 어느 단계도 표시하지 않는다', () => {
    const silent = (stage: LocalMemoIndexProgress['stage']) =>
      shouldShowLocalIndexProgress(progress({ isVisible: false, stage }));

    expect(silent('indexing')).toBe(false);
    expect(silent('downloading')).toBe(false);
    expect(silent('complete')).toBe(false);
    // 실패도 조용히 넘긴다 — 다음 요청에서 다시 드러난다.
    expect(silent('failed')).toBe(false);
  });

  // 첫 준비(모델 받기 + 전체 색인)는 오래 걸린다. 끝과 복구 시점을 남긴다.
  it('첫 준비는 완료와 실패까지 표시한다', () => {
    const shown = (stage: LocalMemoIndexProgress['stage']) =>
      shouldShowLocalIndexProgress(progress({ isInitialIndex: true, stage }));

    expect(shown('preparing')).toBe(true);
    expect(shown('downloading')).toBe(true);
    expect(shown('indexing')).toBe(true);
    expect(shown('complete')).toBe(true);
    expect(shown('failed')).toBe(true);
  });

  // 🔍·네트워크 버튼이 부르는 짧은 증분 색인.
  it('버튼이 부른 증분 색인은 진행과 실패만 표시한다', () => {
    const shown = (stage: LocalMemoIndexProgress['stage']) =>
      shouldShowLocalIndexProgress(progress({ isInitialIndex: false, stage }));

    // 할 일이 없을 때도 발행돼 깜빡인다.
    expect(shown('preparing')).toBe(false);
    // 성공은 검색 결과가 곧 대신 알려 준다.
    expect(shown('complete')).toBe(false);
    expect(shown('indexing')).toBe(true);
    expect(shown('downloading')).toBe(true);
    // 실패만은 남긴다 — 다시 시도 버튼이 유일한 복구 수단이다.
    expect(shown('failed')).toBe(true);
  });
});

describe('완료·실패 처리', () => {
  // 570MB를 기다린 사용자에게는 "끝났다"가 결과다. 스스로 사라지면
  // 자리를 비웠던 사용자는 준비된 줄도 모른다.
  it('완료는 닫기 버튼과 함께 남는다', () => {
    const markup = renderToStaticMarkup(
      <LocalIndexProgress
        onDismiss={() => undefined}
        progress={progress({
          isInitialIndex: true,
          stage: 'complete',
          totalChunks: 3,
        })}
      />,
    );

    expect(markup).toContain('준비 완료!');
    expect(markup).toContain('local-index-progress-close');
  });

  it('첫 준비의 완료는 표시 대상이다', () => {
    expect(
      shouldShowLocalIndexProgress(
        progress({ isInitialIndex: true, stage: 'complete', totalChunks: 3 }),
      ),
    ).toBe(true);
  });

  // 오류 문구는 대부분 조치로 이어지지 않는다. 할 수 있는 건 재시도뿐이라
  // 문구 대신 버튼만 남긴다.
  it('실패는 오류 문구 없이 다시 시도 버튼만 보여 준다', () => {
    const markup = renderToStaticMarkup(
      <LocalIndexProgress
        onRetry={() => undefined}
        progress={progress({ error: '네트워크 오류', stage: 'failed' })}
      />,
    );

    expect(markup).toContain('다시 시도');
    expect(markup).toContain('준비하지 못했어요');
    expect(markup).not.toContain('네트워크 오류');
  });
});

describe('모델 다운로드 관문 배선', () => {
  const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

  // 색인기가 임베딩을 부르면 관문을 건너뛰고 570MB를 조용히 받아 버린다.
  it('모델이 없으면 첫 색인을 미루고 관문을 띄운다', () => {
    expect(appSource).toContain('setEmbeddingGateOpen(true)');
    expect(appSource).toContain('if (!status?.ready) return;');
  });

  // 신규 사용자는 로그인 시점에 메모가 0개다. 안내를 memos에 묶으면
  // "첫 글자를 입력하는 순간" 570MB 팝업이 뜬다 — 아무도 고르지 않은 시점.
  it('다운로드 안내는 메모 수를 기다리지 않는다', () => {
    const gateEffect = appSource.slice(
      appSource.indexOf('const owner = localIndexOwnerId'),
      appSource.indexOf('// 로그인 뒤의 첫 전체 색인'),
    );

    expect(gateEffect).toContain('setEmbeddingGateOpen(true)');
    expect(gateEffect).not.toContain('memos.length');
  });

  it('실패 상태에서도 검색을 누르면 다시 권한다', () => {
    expect(appSource).toContain('if (!modelStatus?.ready)');
    expect(appSource).toContain('if (isVisible) setEmbeddingGateOpen(true);');
  });

  it('다운로드가 끝나면 미뤄 둔 색인을 이어서 돌린다', () => {
    expect(appSource).toContain('memosRef.current,');
    expect(appSource).toContain('localIndexOwnerIdRef.current,');
    expect(appSource).toContain('inboxItemsRef.current,');
  });

  it('로그인 뒤 자동 첫 색인은 조용히 실행한다', () => {
    const startupEffect = appSource.match(
      /\/\/ 로그인 뒤의 첫 전체 색인[\s\S]*?scheduleLocalMemoIndexReconcile\(memos, localIndexOwnerId\);/,
    )?.[0];

    expect(startupEffect).toBeDefined();
    expect(startupEffect).not.toContain(
      'scheduleLocalMemoIndexReconcile(memos, localIndexOwnerId, true)',
    );
  });

  // 자동 트리거(blur·자동 ambient)는 isVisible을 넘기지 않아 조용히 돈다.
  // 버튼 경로만 true를 실어 보낸다.
  it('버튼이 부른 색인만 표시 대상으로 표시된다', () => {
    expect(appSource).toContain(
      '() => flushLocalMemoIndex(undefined, true),',
    );
    expect(appSource).toContain(
      'void flushLocalMemoIndex(undefined, Boolean(manualTarget))',
    );
    // blur는 인자를 주지 않는다 — 기본값 false.
    expect(appSource).toContain('void flushLocalMemoIndex([memoId]);');
  });
});

describe('진행 토스트 상호작용', () => {
  const styles = readFileSync(
    resolve(__dirname, '../styles/subnota-workspace.scss'),
    'utf8',
  );

  // 토스트 본체는 작업을 가리지 않도록 클릭을 통과시킨다(pointer-events:none).
  // 그 안의 버튼까지 통과되면 다시 시도·닫기를 누를 수 없다.
  it('버튼은 클릭을 받는다', () => {
    expect(styles).toMatch(
      /\.local-index-progress-action,\s*\n\.local-index-progress-close\s*\{[\s\S]*?pointer-events:\s*auto/,
    );
  });

  // 문구 + 버튼 2열. 마지막 auto 열이 없으면 버튼이 격자 밖으로 밀린다.
  it('버튼이 들어갈 열이 있다', () => {
    expect(styles).toMatch(
      /\.local-index-progress\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/,
    );
  });

  // 진행 바를 카드 아래 모서리에 붙이려면 절대 배치 + overflow 클리핑이
  // 같이 있어야 한다. 하나만 남으면 바가 모서리 밖으로 튀어나온다.
  it('진행 바가 카드 모서리 안에서 잘린다', () => {
    expect(styles).toMatch(/\.local-index-progress\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(styles).toMatch(
      /\.local-index-progress progress\s*\{[\s\S]*?position:\s*absolute/,
    );
  });
});
