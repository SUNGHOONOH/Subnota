'use client';

/* 챕터 4 대표 화면 — 메모와 캘린더를 한 창의 두 패널로 나눠 둔다.
   빠른 기록은 이 챕터의 더보기에서 별도로 보여준다. */

import { AppShell } from '../../subnota-ui/AppShell';
import { MemoPane, NoteHeader, PaneTabs } from '../../subnota-ui/EditorPane';
import { AppWindow, CalendarDays, NotebookText, Topics } from '../../subnota-ui/icons';
import { useText } from '../../lib/i18n';
import { SceneShowcase } from '../Scene';

export default function ProductivityScene() {
  const text = useText();
  const memoTabs = [{ id: 't1', label: text('주간 회고', 'Weekly review') }];
  const newTabTabs = [{ id: 'new', label: text('새 탭', 'New tab') }];
  const newTabItems = [
    { Icon: NotebookText, label: text('노트', 'Memo') },
    { Icon: AppWindow, label: text('링크 저장함', 'Saved links') },
    { Icon: CalendarDays, label: text('캘린더', 'Calendar') },
    { Icon: Topics, label: 'Topics' },
  ];

  return (
    <div className="productivity-scene">
      <SceneShowcase
        label={text('메모와 캘린더를 한 창의 두 패널로 나눠 함께 보는 화면', 'Memo and calendar side by side in one window')}
        tint="clay"
      >
      <AppShell collapsed>
        <MemoPane activeTabId="t1" tabs={memoTabs}>
          <NoteHeader title={text('주간 회고', 'Weekly review')} />
          <div className="simple-editor-content">
            <p>{text('이번 주에 놓친 것 세 가지.', 'Three things I missed this week.')}</p>
            <p>{text('하나, 회의 준비를 전날로 못 옮겼다.', 'One, I did not move meeting prep to the day before.')}</p>
            <p>{text('둘, 저장만 하고 다시 안 읽은 링크가 늘었다.', 'Two, the links I saved but never revisited kept growing.')}</p>
          </div>
        </MemoPane>

        <div className="split-pane wide">
          <PaneTabs activeId="new" tabs={newTabTabs} />
          <div className="new-tab-picker-stage">
            <section aria-label={text('새 탭에서 열기', 'Open in a new tab')} className="new-tab-picker-panel">
              <h2 className="new-tab-picker-title">{text('새 탭에서 열기', 'Open in a new tab')}</h2>
              <div className="new-tab-picker-list">
                {newTabItems.map(({ Icon, label }) => (
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
    </div>
  );
}
