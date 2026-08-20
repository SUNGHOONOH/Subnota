'use client';

/* 챕터 대표 화면의 무대.
   - 앱 화면은 고정 논리 크기로 그리고 컨테이너 폭에 맞춰 통째로 축소한다. 앱의
     28px·13px 규격을 유지한 채 어떤 폭에도 들어가는 유일한 방법이고, 덕분에
     화면 안 요소들 사이의 비율은 언제나 실제 앱의 비율이다.
   - 스텝은 화면에 들어와 있을 때만 진행한다. 보이지도 않는 애니메이션을
     돌리는 것은 배터리만 쓴다.
   - prefers-reduced-motion 에서는 마지막 스텝에 고정한다. 정적 이미지 대신
     마지막 프레임을 쓰는 이유는, 그게 흐름이 끝난 뒤의 실제 화면이라서다. */

import { motion } from 'framer-motion';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const STAGE_WIDTH = 1080;
/* 사이드바를 접으면 본문만 남으므로 창이 더 낮아도 비어 보이지 않는다. */
const STAGE_HEIGHT = 520;
/* 창은 배경판의 88% × 80%를 차지한다. 나머지가 색 여백이다. */
const WINDOW_W = 0.88;
const WINDOW_H = 0.8;

export type ShowcaseTint = 'blue' | 'green' | 'amber' | 'clay';

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return reduced;
}

/** 스텝 인덱스를 durations 순서대로 돌린다. 마지막 뒤에는 처음으로 돌아간다. */
export function useSceneSteps(durations: number[]) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.3 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) {
      setStep(durations.length - 1);
      return;
    }
    if (!visible) return;
    const timer = window.setTimeout(
      () => setStep((current) => (current + 1) % durations.length),
      durations[step] ?? 1000,
    );
    return () => window.clearTimeout(timer);
    // durations 는 호출부에서 상수 배열이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, visible, reduced]);

  return { step, hostRef, reduced };
}

/**
 * 한 글자씩 실제로 찍는다. 진행률로 잘라 내면 두세 프레임 만에 문장이
 * 통째로 나타나 "쓰는 중"으로 읽히지 않는다.
 *
 * 되감기는 타이핑이 *시작될 때* 한다. 끝날 때 지우면 다음 스텝으로 넘어가는
 * 순간 문장이 통째로 사라진다 — 실제로 그렇게 보였다. 다 친 글자는 그
 * 챕터가 한 바퀴를 도는 동안 화면에 남아 있어야 한다.
 */
export function useTyping(text: string, active: boolean, speed = 55) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) setCount(0);
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setCount(text.length);
      return;
    }
    if (count >= text.length) return;
    /* 사람이 치는 것처럼 간격을 조금 흔든다. 일정한 간격은 기계로 읽힌다. */
    const timer = window.setTimeout(
      () => setCount((current) => current + 1),
      speed + Math.random() * speed * 0.7,
    );
    return () => window.clearTimeout(timer);
  }, [count, active, reduced, text.length, speed]);

  return {
    done: count >= text.length,
    typed: text.slice(0, count),
  };
}

/**
 * 드래그로 잡히는 구간이 한 글자씩 늘어난다. 통째로 켜면 "선택했다"는 결과만
 * 보이고 "끌었다"는 동작이 안 보인다.
 */
export function useSelection(length: number, active: boolean, speed = 90) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) setCount(0);
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setCount(length);
      return;
    }
    if (count >= length) return;
    const timer = window.setTimeout(() => setCount((c) => c + 1), speed);
    return () => window.clearTimeout(timer);
  }, [count, active, reduced, length, speed]);

  return count;
}

/** 흉내 낸 마우스 포인터. 좌표는 무대 기준이고 스텝마다 옮겨 간다. */
export function SimulatedCursor({
  x,
  y,
  visible,
  pressing = false,
  duration = 0.5,
  ease = 'easeOut',
}: {
  x: number;
  y: number;
  visible: boolean;
  pressing?: boolean;
  duration?: number;
  ease?: 'linear' | 'easeOut';
}) {
  return (
    <motion.svg
      animate={{ opacity: visible ? 1 : 0, scale: pressing ? 0.82 : 1, x, y }}
      aria-hidden="true"
      className="sim-cursor"
      height="22"
      initial={false}
      transition={{ duration, ease }}
      viewBox="0 0 16 22"
      width="16"
    >
      <path
        d="M1 1l13 9.5-5.6.7 3.1 6.4-2.5 1.2-3-6.3-4.2 3.6z"
        fill="#1d1d1f"
        stroke="#fff"
        strokeWidth="1.2"
      />
    </motion.svg>
  );
}

/** 깜빡이는 캐럿. 앱의 캐럿과 같은 굵기·색이다. */
export function Caret() {
  return <span className="editor-caret" />;
}

/**
 * 색 배경판 위에 뜬 앱 창. 배경판의 비율은 창 + 여백에서 역산하므로,
 * 안쪽 화면이 잘리거나 남는 자락이 생기지 않는다.
 */
export function SceneShowcase({
  children,
  label,
  tint = 'blue',
  width = STAGE_WIDTH,
  height = STAGE_HEIGHT,
}: {
  children: ReactNode;
  label: string;
  tint?: ShowcaseTint;
  width?: number;
  height?: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    /* 요소에서 직접 읽는다. ResizeObserver 가 넘겨 주는 contentRect 는 스타일이
       붙기 전 값을 한 번 흘리는 일이 있고, 그 뒤로 폭이 안 변하면 잘못된
       배율이 그대로 굳는다. */
    const measure = () => {
      const measured = viewport.clientWidth;
      if (measured > 0) setScale(measured / width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [width]);

  return (
    <div
      aria-label={label}
      className={`showcase showcase-${tint}`}
      role="img"
      style={{
        aspectRatio: `${width / WINDOW_W} / ${height / WINDOW_H}`,
      }}
    >
      <div className="showcase-window">
        <div className="showcase-viewport" ref={viewportRef}>
          <div
            className="scene-stage"
            style={{ height, transform: `scale(${scale ?? 1})`, width }}
          >
            {/* 앱 상단에는 바가 없다(hiddenInset). 신호등도 화면과 같은
                스케일 안에 두어 창이 줄어들 때 함께 줄어든다. */}
            <div aria-hidden="true" className="showcase-dots">
              <span />
              <span />
              <span />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 창 없이 조각만 놓는 무대. 앱 전체가 아니라 필요한 패널만 떼어 보여줄 때
 * 쓴다 — 일정 흐름처럼 두 화면 사이의 관계가 요점인 자리.
 */
export function SceneStage({
  children,
  label,
  width,
  height,
}: {
  children: ReactNode;
  label: string;
  width: number;
  height: number;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const measured = frame.clientWidth;
      /* 축소만 하고 확대는 하지 않는다. 확대하면 논리 폭이 좁은 조각이
         대표 흐름보다 커지고 앱의 13px 글자가 20px로 그려진다. */
      if (measured > 0) setScale(Math.min(1, measured / width));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [width]);

  return (
    <div
      aria-label={label}
      className="scene-frame"
      ref={frameRef}
      role="img"
      style={
        scale === null
          ? { aspectRatio: `${width} / ${height}` }
          : { height: Math.round(height * scale) }
      }
    >
      <div
        className="scene-stage"
        style={{ height, transform: `scale(${scale ?? 1})`, width }}
      >
        {children}
      </div>
    </div>
  );
}
