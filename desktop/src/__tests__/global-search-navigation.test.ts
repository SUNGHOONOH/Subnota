import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/search/useGlobalSearchNavigation.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('전역 검색 결과 라우팅', () => {
  it('memo 결과는 선택 후 포커스 pane에서 연다', () => {
    expect(source).toContain('onSelectMemo(memo);');
    expect(source).toContain('onOpenMemoInFocusedSplitPane(memo);');
  });

  it('topic 결과는 topics 탭을 연 뒤 다음 프레임에 폴더를 표시한다', () => {
    expect(source).toContain("onOpenViewAsTab('topics');");
    expect(source).toContain('window.requestAnimationFrame');
    expect(source).toContain("subnota:show-topic-folder");
  });

  it('inbox 결과는 현재 작업을 유지한 채 원본 이벤트를 보낸다', () => {
    expect(source).toContain("subnota:open-inbox-source");
    expect(source).toContain('inboxSessionId: item.id');
  });

  it('calendar 결과는 calendar 탭을 연 뒤 block 이벤트를 보낸다', () => {
    expect(source).toContain("onOpenViewAsTab('calendar');");
    expect(source).toContain("subnota:open-calendar-block");
    expect(source).toContain('blockId: item.id');
  });

  it('예약된 schedule 결과는 suggestion 이벤트를 보낸다', () => {
    expect(source).toContain('hasScheduledDate(suggestion)');
    expect(source).toContain("subnota:open-schedule-suggestion");
  });

  it('미배치 schedule 결과는 Inbox 패널을 열고 item 이벤트를 보낸다', () => {
    expect(source).toContain('onOpenScheduleInboxPanel();');
    expect(source).toContain("subnota:open-schedule-inbox-item");
  });

  it('schedule·calendar 이벤트는 기존의 다음 tick 순서를 유지한다', () => {
    expect(source.match(/window\.setTimeout\(\(\) =>/g)).toHaveLength(3);
    expect(source).toContain('}, 0);');
  });

  it('App은 검색 라우팅 hook의 반환 callback을 연결한다', () => {
    expect(appSource).toContain(
      'const { openGlobalSearchResult } = useGlobalSearchNavigation({',
    );
    expect(appSource).toContain('onOpenMemoInFocusedSplitPane: openMemoInFocusedSplitPane');
  });
});
