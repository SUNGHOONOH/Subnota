/**
 * 웹 클리핑 결과 알림.
 *
 * 왜 앱 내부가 아닌 OS 알림인가: 클리핑은 브라우저를 보고 있을 때 전역
 * 단축키·메뉴바로 실행된다. 이때 Subnota 창은 뒤에 있거나 아예 닫혀 있어서,
 * 앱 안에 무엇을 그려도 사용자에게 닿지 않는다.
 *
 * 다만 알림이 **유일한 경로여서는 안 된다.** 알림을 껐거나 집중 모드면 조용히
 * 사라지고, 앱은 배달 실패를 알 수도 없다. 그래서 진행·결과는 메뉴바 표시와
 * 트레이 메뉴가 따로 들고 있고(`main.ts`), 여기는 그 위에 얹는 편의다.
 */

import { type InboxSummaryStatus } from '../services/backend/inboxService';
import { loadAppSettings } from './appSettings';

const show = async (
  kind: 'failed' | 'saved',
  body: string,
  onClick?: () => void,
) => {
  if (typeof window === 'undefined') return;
  // 설정에서 끄면 OS 알림만 빠진다. 메뉴바 표시는 그대로 남는다.
  if (!loadAppSettings().clipNotifications) return;
  try {
    await window.electronAPI?.showClipNotification?.(kind, body, onClick);
  } catch {
    // 알림을 못 쓰는 환경에서는 메뉴바 표시가 대신 남는다.
  }
};

/**
 * 저장 결과 한 줄. 제목만 보여 주면 "담겼다"까지는 알지만 요약이 실패한 것은
 * 모른 채 지나간다 — 나중에 카드를 열고서야 알게 된다.
 */
export const clipSavedBody = (
  pageTitle: string,
  summaryStatus?: InboxSummaryStatus,
) => {
  if (summaryStatus === 'pending') return `${pageTitle} · 요약 준비 중`;
  if (summaryStatus === 'partial') return `${pageTitle} · 요약은 일부만`;
  if (summaryStatus === 'failed' || summaryStatus === 'unsupported') {
    return `${pageTitle} · 요약은 만들지 못했어요`;
  }
  return pageTitle;
};

/** 저장 성공. 누르면 수집함에서 바로 확인할 수 있게 한다. */
export const notifyClipSaved = (
  pageTitle: string,
  onOpenInbox: () => void,
  summaryStatus?: InboxSummaryStatus,
) => {
  void show('saved', clipSavedBody(pageTitle, summaryStatus), onOpenInbox);
};

/** 저장 실패. 원인 문구는 캡처 단계에서 이미 구체적으로 만들어 온다. */
export const notifyClipFailed = (reason: string) => {
  void show('failed', reason);
};
