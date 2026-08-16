'use client';

/* 챕터 4 대표 흐름 — 단축키 하나로 Quick Subnota가 뜨고, 적고, 저장하면
   하던 화면 그대로 돌아온다. 뒤의 작업공간이 끝까지 남아 있는 것이 요점이다. */

import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '../../subnota-ui/AppShell';
import { MemoPane, NoteHeader, PaneTabs } from '../../subnota-ui/EditorPane';
import { CalendarWeek } from '../../subnota-ui/Calendar';
import { MiniComposer } from '../../subnota-ui/Mini';
import { SceneShowcase, useSceneSteps, useTyping } from '../Scene';
import { BASE_EVENTS, CAL_DAYS, CAL_HOURS } from './fixtures';

/* 작업 중 → 단축키 → 패널 등장 → 기록 → 저장하고 복귀 */
const DURATIONS = [1300, 800, 900, 2600, 1800];

const MEMO_TABS = [{ id: 't1', label: '주간 회고' }];
const CAL_TABS = [{ id: 'c1', label: '캘린더' }];
const QUICK_NOTE = '검색 결과를 목록 말고 문장 옆에 놓아 보기';

export default function ProductivityScene() {
  const { step, hostRef } = useSceneSteps(DURATIONS);
  const typing = useTyping(QUICK_NOTE, step === 3);

  const showHotkey = step === 1;
  const showMini = step === 2 || step === 3;

  return (
    <div ref={hostRef}>
      <SceneShowcase
        label="단축키로 빠른 기록 패널을 띄워 적고 저장한 뒤 하던 작업으로 돌아오는 화면"
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
            <PaneTabs activeId="c1" tabs={CAL_TABS} />
            <CalendarWeek
              days={CAL_DAYS}
              events={BASE_EVENTS}
              hours={CAL_HOURS}
              nowHour={11.5}
              title="2026년 8월"
            />
          </div>
        </AppShell>

        <AnimatePresence>
          {showHotkey && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="scene-float scene-float-hotkey"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              initial={{ opacity: 0, scale: 0.94 }}
              key="hotkey"
              transition={{ bounce: 0, duration: 0.3, type: 'spring' }}
            >
              <kbd>⌥</kbd>
              <kbd>Y</kbd>
            </motion.div>
          )}
          {showMini && (
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="scene-float scene-float-mini"
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              key="mini"
              transition={{ bounce: 0, duration: 0.3, type: 'spring' }}
            >
              <MiniComposer
                caret={!typing.done}
                status={typing.done ? '⌘⏎ 저장' : undefined}
                text={typing.typed}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </SceneShowcase>
    </div>
  );
}
