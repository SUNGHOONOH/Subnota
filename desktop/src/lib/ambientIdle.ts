import { AMBIENT_IDLE_DELAY_MS } from './constants';
import { getCursorContextText } from './memoChunker';

type AmbientIdleListener = () => void;

export interface AmbientIdleEditor {
  on(event: 'update', handler: AmbientIdleListener): unknown;
  off(event: 'update', handler: AmbientIdleListener): unknown;
  state: {
    selection: {
      $from: {
        parent: { textContent: string };
        parentOffset: number;
      };
    };
  };
}

// 핸들러는 발화 시점에 getOnIdle()로 읽는다. 리렌더로 콜백 identity가
// 바뀌어도 대기 중인 idle 타이머를 잃지 않기 위한 구조다.
export const attachAmbientIdle = (
  editor: AmbientIdleEditor,
  getOnIdle: () => ((chunkText: string) => void) | undefined,
  delayMs: number = AMBIENT_IDLE_DELAY_MS,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      // IME 보호는 디바운스가 담당한다: 조합 중 키 입력은 매번 update로
      // 타이머를 리셋하므로, 여기 도달 = 2초간 입력 없음. composing 플래그를
      // 검사하면 안 된다 — macOS 한글 IME는 마지막 글자를 조합 상태로
      // 무기한 유지해 트리거가 영구 차단된다.
      const { $from } = editor.state.selection;
      const paragraph = $from.parent.textContent;
      // Query with the cursor sentence ± 1, not the whole paragraph — the
      // backend indexes ~3-sentence chunks, so a paragraph-sized query
      // drags similarity down and floods the "지금 문장" card.
      const chunkText = getCursorContextText(
        paragraph,
        Math.min($from.parentOffset, paragraph.length),
      ).slice(0, 1000);
      getOnIdle()?.(chunkText);
    }, delayMs);
  };

  // 실제 입력(update) 이후에만 pending query를 갱신한다.
  // 커서 이동(selectionUpdate)만으로는 트리거하지 않는다.
  editor.on('update', schedule);

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    editor.off('update', schedule);
  };
};
