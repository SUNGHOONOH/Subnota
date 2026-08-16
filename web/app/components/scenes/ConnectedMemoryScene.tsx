'use client';

/* 챕터 1 대표 흐름 — 문장을 쓰다 잠시 멈추면, 관련된 과거 문장이 한 줄로
   나타나고, 누르면 원본이 미리보기 패널에 열린다. */

import { AnimatePresence, motion } from 'framer-motion';
import { AppShell } from '../../subnota-ui/AppShell';
import { AmbientGhost, MemoPane, NoteHeader } from '../../subnota-ui/EditorPane';
import { PreviewPanel } from '../../subnota-ui/Panels';
import { Caret, SceneShowcase, useSceneSteps, useTyping } from '../Scene';

const LINE_ONE = '지난번처럼 그 자리에서 떠올리면 늦는다.';
const LINE_TWO = '다음 회의 전에 질문을 정리해야겠다.';

/* 타이핑 → 손을 멈춘 채 기다림 → 관련 문장이 올라옴 → 관심 → 원본 열림.
   타이핑이 끝난 뒤에는 더 치지 않는다. 치는 도중에 뜨면 "쓰다 멈추면 뜬다"가
   아니라 "아무 때나 뜬다"로 읽힌다. */
const DURATIONS = [2800, 1400, 1600, 800, 3400];

const TABS = [
  { id: 't1', label: '팀 회의 준비' },
  { id: 't2', label: '주간 회고' },
];

export default function ConnectedMemoryScene() {
  const { step, hostRef } = useSceneSteps(DURATIONS);

  const typing = useTyping(LINE_TWO, step === 0);
  const showGhost = step >= 2;
  const showPreview = step >= 4;

  return (
    <div ref={hostRef}>
      <SceneShowcase
        label="문장을 쓰는 동안 관련된 과거 문장이 나타나고, 누르면 원본 메모가 열리는 화면"
        tint="blue"
      >
        <AppShell
          collapsed
          sidePanel={
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  className="app-side-panel-slot"
                  exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
                  initial={{ opacity: 0, x: 24 }}
                  key="preview"
                  transition={{ bounce: 0, duration: 0.3, type: 'spring' }}
                >
                  <PreviewPanel
                    body={
                      '회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다. 그 자리에서 떠올린 질문은 대체로 이미 나온 이야기의 반복이었다.\n\n다음부터는 전날 저녁에 세 개만 적어 두기로 한다.'
                    }
                    highlight="회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다."
                    metadata="7일 전 · 회의 메모"
                    similarity="관련 84%"
                    title="회의 전에 적어 둘 것"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          }
        >
          <MemoPane activeTabId="t1" tabs={TABS}>
            <NoteHeader title="팀 회의 준비" />
            <div className="simple-editor-content">
              <p>{LINE_ONE}</p>
              <p>
                {typing.typed}
                {step < 2 && <Caret />}
              </p>
              {showGhost && (
                <motion.span
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 4 }}
                  style={{ display: 'block' }}
                  transition={{ bounce: 0, duration: 0.3, type: 'spring' }}
                >
                  <AmbientGhost
                    hovered={step >= 3}
                    meta="7일 전 ·"
                    text="회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다."
                  />
                </motion.span>
              )}
            </div>
          </MemoPane>
        </AppShell>
      </SceneShowcase>
    </div>
  );
}
