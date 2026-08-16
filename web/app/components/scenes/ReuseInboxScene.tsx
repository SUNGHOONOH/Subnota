'use client';

/* 챕터 3 대표 흐름 — 저장하는 과정이 주인공이다.

   브라우저 화면을 흉내 내는 대신 저장이 실제로 일어나는 표면(Quick Subnota)을
   크게 보여준다. 링크를 넣고, 저장을 누르고, 요약이 만들어지고, 카드가 된다.
   마지막 한 스텝만 "나중에 다시 올라온다"에 쓴다 — 저장의 결과이지 주제가
   아니라서다. */

import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '../../subnota-ui/AppShell';
import {
  AmbientGhost,
  MemoPane,
  NoteHeader,
  PaneTabs,
} from '../../subnota-ui/EditorPane';
import { InboxWorkspace } from '../../subnota-ui/Inbox';
import { MiniComposer } from '../../subnota-ui/Mini';
import { SceneShowcase, useSceneSteps, useTyping } from '../Scene';
import { INBOX_ITEMS } from './fixtures';

const LINK = 'youtube.com/watch?v=meeting-prep';

/* 링크 입력 → 저장 누름 → 요약 만드는 중 → 카드 완성 → (짧게) 다시 올라옴 */
const DURATIONS = [2400, 1000, 1800, 2400, 2200];

const INBOX_TABS = [{ id: 'x1', label: '링크' }];
const MEMO_TABS = [{ id: 't1', label: '팀 회의 준비' }];

const STATUS = [
  undefined,
  '저장하는 중…',
  '요약을 만들고 있어요.',
  '수집함에 담았습니다.',
  undefined,
];

export default function ReuseInboxScene() {
  const { step, hostRef } = useSceneSteps(DURATIONS);
  const typing = useTyping(LINK, step === 0, 42);

  const onQuick = step <= 1;
  const recalling = step >= 4;

  return (
    <div ref={hostRef}>
      <SceneShowcase
        label="Quick Subnota로 링크를 저장하면 요약 카드가 되고, 나중에 다시 추천되는 화면"
        tint="amber"
      >
        <AppShell collapsed>
          {recalling ? (
            <MemoPane activeTabId="t1" tabs={MEMO_TABS}>
              <NoteHeader title="팀 회의 준비" />
              <div className="simple-editor-content">
                <p>회의를 짧게 만드는 방법을 찾아보는 중이다.</p>
                <AmbientGhost
                  hovered
                  meta="저장한 링크 ·"
                  text="회의 전에 30분을 쓰면 회의가 절반이 된다"
                />
                <p>준비 문서를 먼저 돌려 보자.</p>
              </div>
            </MemoPane>
          ) : (
            <div className="split-pane focused">
              <PaneTabs activeId="x1" tabs={INBOX_TABS} />
              <InboxWorkspace
                hoveredId={step === 3 ? 'i2' : undefined}
                items={step >= 3 ? INBOX_ITEMS : INBOX_ITEMS.slice(1)}
                skeletonCount={step === 2 ? 1 : 0}
              />
            </div>
          )}
        </AppShell>

        {/* 저장이 일어나는 표면. 이 챕터에서 가장 오래 머무는 자리다. */}
        <AnimatePresence>
          {step <= 3 && (
            <motion.div
              animate={{
                opacity: 1,
                scale: step === 1 ? 0.985 : 1,
                y: 0,
              }}
              className="scene-float scene-float-mini"
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              key="mini"
              transition={{ bounce: 0, duration: 0.3, type: 'spring' }}
            >
              <MiniComposer
                caret={!typing.done && onQuick}
                pressing={step === 1}
                recent={[{ source: 'YouTube', text: '회의 전에 30분을 쓰면…' }]}
                status={STATUS[step]}
                text={typing.typed}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </SceneShowcase>
    </div>
  );
}
