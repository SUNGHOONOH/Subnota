import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { joinNoteContent, splitNoteContent } from '../lib/noteTitle';

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '..', relativePath), 'utf8');

const splitSource = read('features/memo/components/MemoSplitWorkspace.tsx');
const miniSource = read('features/mini/MiniComposer.tsx');
const styles = read('styles/subnota-workspace.scss');

describe('State B — 주변 메모가 없을 때', () => {
  // 백엔드는 콜드 스타트로 20초까지 걸린다. 붙을 메모도 링크도 없는 계정이
  // 그 20초를 기다렸다가 "다시 시도"를 보면, 없는 것을 계속 다시 찾게 된다.
  it('붙을 것이 없으면 요청 없이 빈 상태로 끝낸다', () => {
    const search = splitSource.slice(
      splitSource.indexOf('const runEditorStateBSearch'),
      splitSource.indexOf('await onBeforeNetworkSearch?.();'),
    );

    expect(search).toContain('const hasSearchableNeighbor =');
    expect(search).toContain('if (!hasSearchableNeighbor) {');
    // 빈 상태 판정은 queryChunk가 있어야 성립한다(로딩과 구분되지 않는다).
    expect(search).toContain('networkQueryChunk: {');
    expect(search).toContain('networkResults: [],');
  });
});

describe('State B — 검색이 실패했을 때', () => {
  // 떠 있는 카드로 얹으면 토스트처럼 읽혀 빈 결과와 실패가 서로 다른 곳에 뜬다.
  it('빈 상태와 같은 자리에 마크 + 문구 + 다시 시도로 선다', () => {
    const errorBlock = splitSource.slice(
      splitSource.indexOf('{editor.networkErrorMessage && ('),
      splitSource.indexOf('{editor.networkIsLoading &&'),
    );

    expect(errorBlock).toContain('<EmptyState');
    expect(errorBlock).toContain('tone="start"');
    expect(errorBlock).toContain('title={editor.networkErrorMessage}');
    expect(errorBlock).toContain('isNetworkSearchRetryableMessage');
    expect(errorBlock).toContain('void runEditorStateBSearch(pane, editor)');
    expect(splitSource).not.toContain('net-overlay-stack');
  });

  // .empty-state.canvas는 그래프를 가리지 않으려고 클릭을 통과시킨다.
  // 되살리지 않으면 버튼이 보이기만 하고 눌리지 않는다.
  it('다시 시도 버튼만 클릭을 되살린다', () => {
    expect(styles).toMatch(/\.empty-state\.canvas \{[\s\S]*?pointer-events: none/);
    expect(styles).toMatch(/\.net-error-retry \{[\s\S]*?pointer-events: auto/);
  });
});

describe('Mini Subnota 저장', () => {
  // 노트 제목은 content 첫 줄이다. Mini는 제목 칸이 없어서, 쓴 것을 그대로
  // 저장하면 한 줄짜리 메모가 통째로 제목이 된다.
  it('제목을 비우고 본문부터 저장한다', () => {
    expect(miniSource).toContain("content: joinNoteContent('', content)");

    const saved = joinNoteContent('', '회의에서 나온 아이디어');
    expect(splitNoteContent(saved)).toEqual({
      body: '회의에서 나온 아이디어',
      title: '',
    });
  });

  // 목록·탭·그래프는 전부 "비지 않은 첫 줄"을 제목으로 쓴다. 앞의 빈 줄
  // 때문에 제목이 사라지면 이 수정은 다른 곳을 깨는 것이 된다.
  it('빈 제목 줄이 목록 표시를 비우지 않는다', () => {
    const firstContentLine = joinNoteContent('', '회의에서 나온 아이디어')
      .split('\n')
      .map(line => line.trim())
      .find(Boolean);

    expect(firstContentLine).toBe('회의에서 나온 아이디어');
  });
});
