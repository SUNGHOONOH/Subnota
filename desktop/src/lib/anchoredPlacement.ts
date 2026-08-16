/**
 * 누른 것 옆에 붙는 창의 자리 계산.
 *
 * 가운데 모달은 어디를 눌렀는지와 창이 뜨는 자리가 아무 관계가 없어 맥락이
 * 끊긴다. 앵커에 붙이면 자라는 방향(transform-origin)이 출처를 말해 준다.
 *
 * 캘린더의 일정 편집 창과 일정 저장함의 수정 창이 같은 규칙을 쓴다 — 하는
 * 일이 같은 창이 서로 다른 자리 규칙을 가지면 안 된다.
 */

/** 앵커 창의 고정 폭. 본문이 길어져도 폭은 흔들리지 않는다. */
export const ANCHORED_MODAL_WIDTH = 300;
/** 높이를 실측하기 전에 쓰는 기본값. */
export const ANCHORED_MODAL_MIN_HEIGHT = 220;

export interface AnchoredPlacement {
  /** 꼬리는 창 기준 좌표다. 창이 뷰포트에 걸려 밀린 만큼 그대로 따라간다. */
  tailTop: number;
  left: number;
  side: 'left' | 'right';
  top: number;
  width: number;
}

/**
 * 오른쪽을 먼저 본다. 안 들어가면 왼쪽, 둘 다 안 되면 `null`을 돌려주고
 * 부르는 쪽이 가운데 모달로 되돌린다 — 화면 밖으로 밀린 창보다는 가운데가 낫다.
 */
export const getAnchoredPlacement = (
  anchorRect: DOMRect | null,
  measuredHeight: number = ANCHORED_MODAL_MIN_HEIGHT,
  viewport: { height: number; width: number } = {
    height: window.innerHeight,
    width: window.innerWidth,
  },
): AnchoredPlacement | null => {
  if (!anchorRect) return null;

  const gap = 10;
  const margin = 12;
  const width = ANCHORED_MODAL_WIDTH;
  const height = Math.min(measuredHeight, viewport.height - margin * 2);

  const fitsRight = anchorRect.right + gap + width + margin <= viewport.width;
  const fitsLeft = anchorRect.left - gap - width - margin >= 0;
  if (!fitsRight && !fitsLeft) return null;

  const side: 'left' | 'right' = fitsRight ? 'right' : 'left';
  const left =
    side === 'right' ? anchorRect.right + gap : anchorRect.left - gap - width;

  const anchorMiddle = anchorRect.top + anchorRect.height / 2;
  const top = Math.min(
    Math.max(anchorMiddle - height / 2, margin),
    Math.max(margin, viewport.height - height - margin),
  );

  return {
    tailTop: Math.min(
      Math.max(anchorMiddle - top, 18),
      Math.max(18, height - 18),
    ),
    left,
    side,
    top,
    width,
  };
};
