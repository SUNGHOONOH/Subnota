'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/* 움직임을 줄여 달라고 한 사람에게는 framer가 만드는 진입·전환도 함께 멎어야
   한다. 씬마다 조건을 다는 대신 한 곳에서 끈다. */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
