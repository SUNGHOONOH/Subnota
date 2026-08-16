// 전체 화면을 덮는 로딩은 앱 시작의 아주 짧은 구간에만 허용한다.
//
// A(brand) 브랜드 목업 → B(shell) 앱 셸 스켈레톤 → C(ready) 실제 작업 공간.
// 게이트를 닫는 조건은 "로컬 작업 공간이 준비됐는가"뿐이다. 서버 동기화는
// 뒤에서 계속 돌며 화면을 가리지 않는다(local-first 불변식).

/**
 * Phase A 상한. 이 시점을 넘겨도 로컬이 안 붙었으면 셸 스켈레톤으로 넘어간다.
 * 브랜드 모션(BootBrandMark)의 길이 1.19초와 맞춰 둔 값이다 — 한쪽만 바꾸면
 * 모션이 잘리거나 끝난 화면을 붙잡고 있게 된다.
 */
export const BOOT_BRAND_PHASE_MS = 1200;

/**
 * 로컬이 준비된 뒤 전체 화면을 얼마나 더 붙잡을지.
 *
 * 콜드 스타트에서는 브랜드 모션을 끝까지 보장한다. 앱을 새로 켜는 일은
 * 드물고, 그 한 번이 제품의 첫인상이다. 로컬이 아무리 빨리 붙어도
 * 모션이 잘리거나 아예 안 보이는 쪽이 더 손해다.
 *
 * 새로고침(⌘R)은 반대다. 스피너를 쓰므로 끝이 없고, 어디서 끊겨도
 * 자연스럽다. 붙잡을 이유가 없으니 준비되는 즉시 넘어간다.
 */
export const resolveBootCloseDelayMs = (
  elapsedMs: number,
  { isAssemble = true }: { isAssemble?: boolean } = {},
) => (isAssemble ? Math.max(0, BOOT_BRAND_PHASE_MS - elapsedMs) : 0);

export type BootMarkVariant = 'assemble' | 'spin';

/**
 * 조립 모션은 "앱을 껐다 켰다"에만 쓴다.
 *
 * 두 가지가 모두 참이어야 한다:
 *   - 앱을 켠 뒤 처음 만든 창인가 (창만 다시 연 것은 재시작이 아니다)
 *   - 그 창을 새로고침하지 않았는가 (⌘R은 끝을 알 수 없다)
 *
 * 나머지는 전부 스피너다. 끝이 없는 루프라 언제 끊겨도 잘려 보이지 않는다.
 */
export const resolveBootMarkVariant = ({
  isColdStartWindow,
  isReloadNavigation,
}: {
  isColdStartWindow: boolean;
  isReloadNavigation: boolean;
}): BootMarkVariant =>
  isColdStartWindow && !isReloadNavigation ? 'assemble' : 'spin';

/** 이 창의 문서가 새로고침으로 다시 불린 것인가. Chromium이 알려 준다. */
export const isReloadNavigation = () => {
  const [entry] = performance.getEntriesByType('navigation');
  return (entry as PerformanceNavigationTiming | undefined)?.type === 'reload';
};

/** 어떤 경우에도 이 시간을 넘겨 전체 화면 로딩을 유지하지 않는다. */
export const BOOT_FULLSCREEN_MAX_MS = 4000;

export type BootPhase = 'brand' | 'shell' | 'ready';

export const resolveBootPhase = ({
  elapsedMs,
  isBooting,
}: {
  elapsedMs: number;
  isBooting: boolean;
}): BootPhase => {
  // 로컬이 빨리 붙으면 브랜드 목업을 인위적으로 붙잡아 두지 않는다.
  if (!isBooting) return 'ready';
  return elapsedMs < BOOT_BRAND_PHASE_MS ? 'brand' : 'shell';
};
