'use client';

/* 챕터 2 대표 흐름 — 문장 속 날짜가 캘린더로 건너가는 것이 요점이라, 앱 창
   하나를 통째로 보여주는 대신 관계가 드러나는 두 조각만 떼어 놓는다:
   왼쪽에 메모 창, 오른쪽에 그 결과가 앉은 캘린더.

   문장을 끌어 선택하면 뜨는 팝오버 하나만 보여주고, 거기서 [일정 등록]을
   누르면 바로 캘린더에 들어간다. 날짜 피커까지 끼워 넣으면 흐름이 셋으로
   쪼개져 "바로 이어진다"는 요점이 흐려진다. */

import { AnimatePresence, motion } from 'framer-motion';
import {
  NoteHeader,
  PaneTabs,
  SelectionBubble,
} from '../../subnota-ui/EditorPane';
import { CalendarMonth, CalendarWeekStrip } from '../../subnota-ui/Calendar';
import {
  Caret,
  SceneStage,
  SimulatedCursor,
  useSceneSteps,
  useSelection,
  useTyping,
} from '../Scene';
import {
  MONTH_CELLS,
  MONTH_CELLS_PLACED,
  WEEK_ROWS,
  WEEK_ROWS_PLACED,
} from './fixtures';

const SENTENCE = '내일 오후 3시 팀 미팅 참석하기';
/* 날짜 표현을 먼저 감지하지만, 일정 등록은 문장 전체를 대상으로 한다. */
const DATE_END = 8;
/* 선택 글자 수와 무관하게 마우스 이동과 드래그가 같은 시간에 끝난다. */
const DRAG_DURATION_MS = 1500;

/* 타이핑 → 커서가 문장 앞으로 → 끌어서 선택 → 팝오버 → [일정 등록] 클릭 →
   캘린더에 배치 */
const DURATIONS = [2600, 700, 1000, 1200, 600, 2800];

/* 무대(.fragment-memo) 기준 좌표. 메모 레일을 두지 않고 본문을 바로 보여 준다. */
const CURSOR = {
  button: { x: 190, y: 286 },
  rest: { x: 150, y: 320 },
  tokenEnd: { x: 320, y: 246 },
  tokenStart: { x: 22, y: 246 },
};

const STRIP_HOURS = ['09', '11', '13', '15', '17'];
const MEMO_TABS = [{ id: 't1', label: '내일 팀 미팅' }];

export default function MemoToCalendarScene() {
  const { step, hostRef } = useSceneSteps(DURATIONS);
  const typing = useTyping(SENTENCE, step === 0);
  const picked = useSelection(
    SENTENCE.length,
    step === 2,
    DRAG_DURATION_MS / SENTENCE.length,
  );

  const selectedCount =
    step === 2 ? picked : step > 2 && step < 5 ? SENTENCE.length : 0;
  const selectedDateEnd = Math.min(selectedCount, DATE_END);
  const selectedRestLength = Math.max(0, selectedCount - DATE_END);
  const showBubble = step === 3 || step === 4;
  const placed = step >= 5;

  const cursor =
    step === 1
      ? CURSOR.tokenStart
      : step === 2
        ? CURSOR.tokenEnd
        : step === 3 || step === 4
          ? CURSOR.button
          : CURSOR.rest;

  return (
    <div ref={hostRef}>
      <SceneStage
        height={560}
        label="메모 문장을 끌어 선택하면 일정 등록 팝오버가 뜨고, 캘린더에 바로 앉는 화면"
        width={1080}
      >
        <div className="fragment-scene">
          {/* 왼쪽 — 실제 앱 구조 그대로의 메모 창 조각 */}
          <div className="fragment-memo">
            <div className="fragment-window">
              {/* 앱 상단에는 바가 없다. 신호등만 얹힌다. */}
              <div aria-hidden="true" className="fragment-dots">
                <span />
                <span />
                <span />
              </div>
              <div className="fragment-memo-body">
                <div className="fragment-memo-editor">
                  <PaneTabs activeId="t1" tabs={MEMO_TABS} />
                  <NoteHeader title="내일 팀 미팅" />
                  <div className="simple-editor-content" style={{ padding: '14px 20px' }}>
                    <p>회의 준비물 정리하고,</p>
                    <p>
                      {/* 날짜 표현은 감지된 문법을 유지하되, 드래그는 문장 전체를
                          선택해 일정 제목과 시간이 함께 전달되는 흐름이다. */}
                      <span className="date-token">
                        <span className="editor-selection">
                          {typing.typed.slice(0, selectedDateEnd)}
                        </span>
                        {typing.typed.slice(selectedDateEnd, DATE_END)}
                      </span>
                      <span className={selectedRestLength ? 'editor-selection' : undefined}>
                        {typing.typed.slice(DATE_END, DATE_END + selectedRestLength)}
                      </span>
                      {typing.typed.slice(DATE_END + selectedRestLength)}
                      {!typing.done && <Caret />}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 끌어 놓은 자리 바로 아래에 뜨는 팝오버. 앱에서 포털로 뜨는 것이라
                여기서도 창 트리 밖에 둔다. */}
            <AnimatePresence>
              {showBubble && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="fragment-float fragment-float-bubble"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  initial={{ opacity: 0, y: 6 }}
                  key="bubble"
                  transition={{ bounce: 0, duration: 0.3, type: 'spring' }}
                >
                  <SelectionBubble pressing={step === 4} />
                </motion.div>
              )}
            </AnimatePresence>

            <SimulatedCursor
              duration={step === 2 ? DRAG_DURATION_MS / 1000 : 0.45}
              ease={step === 2 ? 'linear' : 'easeOut'}
              pressing={step === 4}
              visible={step >= 1 && step <= 4}
              x={cursor.x}
              y={cursor.y}
            />
          </div>

          {/* 등록 결과가 주간·월간 캘린더로 각각 갈라지는 흐름을 보여 준다. */}
          <svg aria-hidden="true" className="fragment-links" viewBox="0 0 110 520">
            <defs>
              {/* The older landing version used one noisy stroke, rather than a
                  second dashed stroke that could linger during the reset. */}
              <filter id="fragment-pencil" height="130%" width="130%" x="-15%" y="-15%">
                <feTurbulence
                  baseFrequency="0.09"
                  numOctaves="4"
                  result="noise"
                  type="fractalNoise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="2.8"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
            {[{
              body: 'M4,260 C38,260 57,108 105,82',
            }, {
              body: 'M4,260 C38,260 57,407 105,434',
            }].map(({ body }) => (
              <g key={body}>
                <motion.path
                  animate={placed ? { pathLength: 1, opacity: 0.86 } : { pathLength: 0, opacity: 0 }}
                  d={body}
                  filter="url(#fragment-pencil)"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  stroke="#c9962f"
                  strokeLinecap="round"
                  strokeWidth="3.2"
                  transition={placed
                    ? { duration: 0.9, ease: 'easeInOut' }
                    : { duration: 0 }}
                />
              </g>
            ))}
          </svg>

          {/* 오른쪽 — 캘린더 조각 둘 */}
          <div className="fragment-calendar">
            <CalendarWeekStrip
              badge="8월 3주차"
              popItems={placed}
              hours={STRIP_HOURS}
              rows={placed ? WEEK_ROWS_PLACED : WEEK_ROWS}
              title="이번주 블록"
            />
            <CalendarMonth
              badge="8월"
              cells={placed ? MONTH_CELLS_PLACED : MONTH_CELLS}
              popItems={placed}
              title="2026년 8월"
            />
          </div>
        </div>
      </SceneStage>
    </div>
  );
}
