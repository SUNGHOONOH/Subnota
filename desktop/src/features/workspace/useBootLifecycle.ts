import { useEffect, type MutableRefObject } from 'react';

import {
  BOOT_BRAND_PHASE_MS,
  BOOT_FULLSCREEN_MAX_MS,
  resolveBootCloseDelayMs,
} from '../../lib/bootPhase';

interface UseBootLifecycleOptions {
  bootMarkVariantRef: MutableRefObject<'assemble' | 'spin'>;
  bootStartedAtRef: MutableRefObject<number>;
  isBooting: boolean;
  isLocalWorkspaceReady: boolean;
  setBootElapsedMs: (value: number) => void;
  setBooting: (value: boolean) => void;
}

/**
 * Owns the three-phase boot timing only: brand phase, hard upper bound, and
 * local-first workspace handoff. Session/auth work remains in auth bootstrap.
 */
export const useBootLifecycle = ({
  bootMarkVariantRef,
  bootStartedAtRef,
  isBooting,
  isLocalWorkspaceReady,
  setBootElapsedMs,
  setBooting,
}: UseBootLifecycleOptions) => {
  // Phase A(브랜드 목업) → Phase B(앱 셸 스켈레톤), 그리고 어떤 경우에도
  // 전체 화면 로딩을 끝내는 상한. 상한은 안전망일 뿐 정상 경로가 아니다.
  useEffect(() => {
    if (!isBooting) return undefined;
    const startedAt = Date.now();
    setBootElapsedMs(0);
    const toShell = window.setTimeout(
      () => setBootElapsedMs(Date.now() - startedAt),
      BOOT_BRAND_PHASE_MS,
    );
    const cap = window.setTimeout(
      () => setBooting(false),
      BOOT_FULLSCREEN_MAX_MS,
    );
    return () => {
      window.clearTimeout(toShell);
      window.clearTimeout(cap);
    };
  }, [isBooting, setBootElapsedMs, setBooting]);

  // Phase C — 로컬 작업 공간이 준비되면 서버 동기화 완료를 기다리지 않고
  // 실제 화면으로 넘어간다. 다만 브랜드 모션이 이미 보이기 시작했다면
  // 끝까지 재생한다 — 중간에 잘린 모션은 고장으로 보인다.
  // isBooting도 의존성이다. 로그인 직후 게이트를 다시 열 때 로컬은 이미
  // 준비돼 있어서, isLocalWorkspaceReady만 보면 이 효과가 다시 돌지 않아
  // 4초 상한이 닫을 때까지 브랜드 화면이 남는다.
  useEffect(() => {
    if (!isBooting || !isLocalWorkspaceReady) return undefined;
    const delay = resolveBootCloseDelayMs(
      Date.now() - bootStartedAtRef.current,
      { isAssemble: bootMarkVariantRef.current === 'assemble' },
    );
    if (delay === 0) {
      setBooting(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setBooting(false), delay);
    return () => window.clearTimeout(timer);
  }, [
    bootMarkVariantRef,
    bootStartedAtRef,
    isBooting,
    isLocalWorkspaceReady,
    setBooting,
  ]);
};
