'use client';

/* 손으로 표시한 층 — 형광펜과 손글씨 화살표.
   앱 UI 위에 사람이 펜으로 그어 놓은 것처럼 읽혀야 해서, 여기만 앱 팔레트
   밖의 잉크와 다른 서체를 쓴다. 제품 화면 안으로는 들어가지 않는다. */

import { motion } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

export function Marker({
  children,
  tone = 'amber',
}: {
  children: ReactNode;
  tone?: 'amber' | 'blue' | 'green' | 'clay';
}) {
  return <span className={`marker marker-${tone}`}>{children}</span>;
}

/* 손으로 그은 화살표. 연필 질감은 SourceGraphic 을 노이즈로 흔들어 만든다 —
   필터 id 가 문서 안에서 유일해야 해서 호출부마다 다른 값을 받는다. */
function SketchArrow({
  id,
  path,
  width,
  height,
  viewBox,
  delay,
}: {
  id: string;
  path: string;
  width: number;
  height: number;
  viewBox: string;
  delay: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="hand-note-arrow"
      fill="none"
      height={height}
      viewBox={viewBox}
      width={width}
    >
      <defs>
        <filter height="130%" id={id} width="130%" x="-15%" y="-15%">
          <feTurbulence
            baseFrequency="0.09"
            numOctaves="4"
            result="noise"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="2.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <motion.path
        animate={{ pathLength: 1 }}
        d={path}
        filter={`url(#${id})`}
        initial={{ pathLength: 0 }}
        stroke="#c9962f"
        strokeLinecap="round"
        strokeWidth="2.6"
        transition={{ delay, duration: 0.7, ease: 'easeOut' }}
      />
    </svg>
  );
}

export function HandNote({
  text,
  arrow,
  style,
  arrowId,
  delay = 0.3,
}: {
  text: string;
  /* 화살표 모양. 방향이 다른 자리마다 직접 그린다 — 하나를 회전시켜 돌려 쓰면
     손으로 그은 느낌이 무너진다. `above` 는 화살표가 글자 위로 가는 모양. */
  arrow: {
    path: string;
    width: number;
    height: number;
    viewBox: string;
    above?: boolean;
  };
  style: CSSProperties;
  arrowId: string;
  delay?: number;
}) {
  const pen = (
    <SketchArrow
      delay={delay}
      height={arrow.height}
      id={arrowId}
      path={arrow.path}
      viewBox={arrow.viewBox}
      width={arrow.width}
    />
  );

  return (
    <motion.div
      className="hand-note"
      initial={{ opacity: 0 }}
      style={style}
      transition={{ delay: delay - 0.15, duration: 0.4 }}
      viewport={{ once: true, margin: '-100px' }}
      whileInView={{ opacity: 1 }}
    >
      {arrow.above && pen}
      <span className="hand-note-text">{text}</span>
      {!arrow.above && pen}
    </motion.div>
  );
}

/* 위로 휘어 올라가는 화살표. 글자 위에 놓여 바로 위를 가리킨다. */
export const ARROW_UP = {
  above: true,
  height: 62,
  path: 'M14,58 C18,34 30,14 62,6 M46,4 C54,4 59,5 63,6 M52,18 C58,13 61,9 63,6',
  viewBox: '0 0 80 62',
  width: 80,
};
