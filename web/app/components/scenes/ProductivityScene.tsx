'use client';

/* 챕터 4 대표 화면 — 메모와 캘린더를 한 창의 두 패널로 나눠 둔다.
   빠른 기록은 이 챕터의 더보기에서 별도로 보여준다. */

import { AppShell } from '../../subnota-ui/AppShell';
import { MemoPane, NoteHeader, PaneTabs } from '../../subnota-ui/EditorPane';
import { AppWindow, CalendarDays, NotebookText, Topics } from '../../subnota-ui/icons';
import { SceneShowcase } from '../Scene';

const MEMO_TABS = [{ id: 't1', label: '주간 회고' }];
const NEW_TAB_TABS = [{ id: 'new', label: '새 탭' }];
const NEW_TAB_ITEMS = [
  { Icon: NotebookText, label: '노트' },
  { Icon: AppWindow, label: '링크 저장함' },
  { Icon: CalendarDays, label: '캘린더' },
  { Icon: Topics, label: 'Topics' },
];

export default function ProductivityScene() {
  return (
    <SceneShowcase
      label="메모와 캘린더를 한 창의 두 패널로 나눠 함께 보는 화면"
      tint="clay"
    >
      <AppShell collapsed>
        <MemoPane activeTabId="t1" tabs={MEMO_TABS}>
          <NoteHeader title="주간 회고" />
          <div className="simple-editor-content">
            <p>이번 주에 놓친 것 세 가지.</p>
            <p>하나, 회의 준비를 전날로 못 옮겼다.</p>
            <p>둘, 저장만 하고 다시 안 읽은 링크가 늘었다.</p>
          </div>
        </MemoPane>

        <div className="split-pane wide">
          <PaneTabs activeId="new" tabs={NEW_TAB_TABS} />
          <div className="new-tab-picker-stage">
            <section aria-label="새 탭에서 열기" className="new-tab-picker-panel">
              <h2 className="new-tab-picker-title">새 탭에서 열기</h2>
              <div className="new-tab-picker-list">
                {NEW_TAB_ITEMS.map(({ Icon, label }) => (
                  <div className="new-tab-picker-item" key={label}>
                    <Icon size={18} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </AppShell>
    </SceneShowcase>
  );
}
