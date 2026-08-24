import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import EmptyState from '../components/EmptyState';

const read = (relativePath: string) =>
  readFileSync(resolve(__dirname, '..', relativePath), 'utf8');

const styles = read('styles/subnota-workspace.scss');
const render = (node: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

describe('EmptyState — 마크는 언제 붙는가', () => {
  // 검색 0건은 타이핑하는 동안 수십 번 뜬다. 거기에 그림을 넣으면 효과가
  // 닳고 방해만 된다 — 반복되는 일러스트를 피하라는 것이 공통 권고다.
  it('처음이라 비었을 때만 마크를 단다', () => {
    const start = render(<EmptyState title="t" tone="start" />);
    const result = render(<EmptyState title="t" tone="result" />);
    const neutral = render(<EmptyState title="t" tone="neutral" />);

    expect(start).toContain('empty-state-mark');
    expect(result).not.toContain('empty-state-mark');
    expect(neutral).not.toContain('empty-state-mark');
  });

  // 좁은 곳에서 마크까지 넣으면 빈 상태가 목록보다 커진다.
  it('좁은 자리(inline)에는 tone이 start여도 마크를 넣지 않는다', () => {
    expect(render(<EmptyState size="inline" title="t" tone="start" />)).not.toContain(
      'empty-state-mark',
    );
  });

  // 로고 색과 UI 액센트는 다른 토큰이다. 마크는 로고 쪽을 따른다.
  it('마크는 로고 색을 옅게 쓴다', () => {
    expect(styles).toMatch(
      /\.empty-state-mark \{[\s\S]*?color: var\(--app-color-brand-mark\)[\s\S]*?opacity: 0\.3/,
    );
  });

  // 캔버스는 이미 빈 액자다. 액자를 하나 더 그리지 않는다.
  it('캔버스는 영역을 채우되 클릭을 막지 않는다', () => {
    expect(styles).toMatch(
      /\.empty-state\.canvas \{[\s\S]*?pointer-events: none[\s\S]*?position: absolute/,
    );
  });

  // 행동은 화면의 원래 자리에 이미 있다. 빈 화면마다 버튼을 달지 않는다.
  it('행동 버튼을 만들지 않는다', () => {
    expect(read('components/EmptyState.tsx')).not.toContain('<button');
    expect(render(<EmptyState body="b" title="t" tone="start" />)).not.toContain(
      '<button',
    );
  });
});

describe('빈 상태 통합 — 7개 클래스가 하나로', () => {
  // 같은 일을 하는 클래스가 7개였고 폰트·패딩·정렬이 제각각이었다.
  it('옛 클래스는 스타일시트에서 사라졌다', () => {
    for (const legacy of [
      '.empty-panel {',
      '.preview-empty {',
      '.knowledge-graph-empty {',
      '.cal-todo-empty {',
      '.schedule-approve-empty {',
      '.empty-text {',
    ]) {
      expect(styles).not.toContain(legacy);
    }
    expect(read('features/mini/MiniComposer.scss')).not.toContain('__recent-empty');
  });

  it('점선 테두리를 쓰지 않는다', () => {
    const block = styles.slice(styles.indexOf('.empty-state {'));
    expect(block).not.toContain('dashed');
  });

  it('모든 빈 상태가 공용 컴포넌트를 쓴다', () => {
    const sites = [
      'features/inbox/InboxWorkspace.tsx',
      'features/memo/MemoWorkspace.tsx',
      'features/memo/components/MemoSplitWorkspace.tsx',
      'features/memo/components/KnowledgeGraphView.tsx',
      'features/calendar/components/DayTodoPanel.tsx',
      'features/schedule/ScheduleInboxWorkspace.tsx',
      'features/search/GlobalSearchOverlay.tsx',
      'features/preview/PreviewPanel.tsx',
      'features/mini/MiniComposer.tsx',
    ];
    for (const site of sites) {
      expect(read(site)).toContain('<EmptyState');
    }
  });
});

describe('문구 — 내부 용어와 부정문 걷어내기', () => {
  it('수집함은 첫 사용과 검색 0건을 다르게 말한다', () => {
    const inbox = read('features/inbox/InboxWorkspace.tsx');

    expect(inbox).toContain('저장한 링크가 여기 모입니다');
    expect(inbox).toContain('tone="start"');
    expect(inbox).toContain('와 맞는 링크가 없습니다');
    expect(inbox).toContain('tone="result"');
  });

  // "그래프"·"야간 토픽 배치"는 내부 사정이다.
  it('그래프와 Topics에서 내부 용어를 쓰지 않는다', () => {
    const graph = read('features/memo/components/KnowledgeGraphView.tsx');
    const split = read('features/memo/components/MemoSplitWorkspace.tsx');

    expect(graph).toContain('연결된 메모가 아직 없습니다');
    expect(graph).not.toContain('표시할 그래프가 없습니다');
    expect(split).not.toContain('야간 토픽 배치가 실행되면');
    expect(split).toContain('메모가 쌓이면 주제별로 자동으로 묶입니다');
  });

  // 그래프에는 마크가 붙지만, 노드가 없으면 프레임 높이가 0으로 접힌다.
  it('빈 그래프도 높이를 갖는다', () => {
    expect(read('features/memo/components/KnowledgeGraphView.tsx')).toContain(
      'is-empty',
    );
    expect(styles).toMatch(
      /\.knowledge-graph-frame\.is-empty \{[\s\S]*?min-height/,
    );
  });

  // 그래프 노드는 남아 있는데 원본이 사라진 경우다. 불러오다 실패한 것이
  // 아니라 다시 시도할 대상이 없다. 진짜 오류(.preview-error + onRetry)는
  // 별도 경로로 이미 있으니 여기에 재시도를 흉내 내지 않는다.
  it('사라진 링크를 오류로 말하지 않는다', () => {
    const preview = read('features/preview/PreviewPanel.tsx');
    // 같은 조회가 제목 헬퍼에도 있어 앵커가 겹친다. renderDetail 본문에서
    // 저장한 링크 분기만 잘라낸다.
    const danglingBranch = preview.slice(
      preview.indexOf('const renderDetail'),
      preview.lastIndexOf('const memo = result.memoId'),
    );

    // 사라진 링크를 알리는 그 자리만 본다 — 같은 분기의 `SourceDetailPane`은
    // 요약 재시도를 정상적으로 갖고 있어서 분기 전체로 재면 걸린다.
    const noticeAt = danglingBranch.indexOf('삭제된 링크입니다');
    const notice = danglingBranch.slice(
      danglingBranch.lastIndexOf('<EmptyState', noticeAt),
      noticeAt + 40,
    );

    expect(notice).toContain('삭제된 링크입니다');
    // 재시도할 대상이 없으니 버튼도 핸들러도 없다.
    expect(notice).not.toContain('<button');
    expect(notice).not.toContain('onRetry');
    // 진짜 오류 경로(.preview-error + onRetry)는 그대로 살아 있어야 한다.
    expect(preview).toContain('preview-error');
    expect(preview).toContain('onRetry');
  });

  // 비어 있는 것이 정상인 곳에 결핍의 말투를 쓰지 않는다.
  it('정상적으로 빈 곳은 상태를 서술한다', () => {
    expect(read('features/calendar/components/DayTodoPanel.tsx')).toContain(
      '비어 있는 하루입니다',
    );
    expect(read('features/schedule/ScheduleInboxWorkspace.tsx')).toContain(
      '정할 일정이 없습니다',
    );
  });

  // 빈 상태가 아닌 본문이 빈 상태 클래스를 쓰고 있었다. 지금은 캘린더 모달과
  // 같은 힌트 줄이다 — 비어 있다는 안내가 아니라 채워진 값의 출처 설명이다.
  it('선택한 일정의 원문은 빈 상태가 아니다', () => {
    const scheduleSource = read('features/schedule/ScheduleInboxWorkspace.tsx');

    expect(scheduleSource).toMatch(
      /className="cal-modal-hint">[\s\S]*?t\(\s*'원문'[\s\S]*?editingInbox\.source_text/,
    );
    expect(scheduleSource).not.toMatch(
      /<EmptyState[^>]*>[\s\S]{0,200}editingInbox\.source_text/,
    );
  });
});
