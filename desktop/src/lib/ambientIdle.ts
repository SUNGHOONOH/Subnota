import {
  AMBIENT_BOUNDARY_DELAY_MS,
  AMBIENT_HEADING_DELAY_MS,
  AMBIENT_IDLE_DELAY_MS,
} from './constants';
import {
  endsAtBoundary,
  getCursorContextText,
  isMeaningfulChunk,
} from './memoChunker';

type AmbientIdleListener = () => void;

interface AmbientIdleCursor {
  depth: number;
  index: (depth: number) => number;
  node: (depth: number) => { child: (index: number) => { textContent: string } };
  parent: {
    textContent: string;
    type: { name: string };
  };
  parentOffset: number;
}

export interface AmbientIdleEditor {
  on(event: 'update', handler: AmbientIdleListener): unknown;
  off(event: 'update', handler: AmbientIdleListener): unknown;
  state: {
    selection: {
      $from: AmbientIdleCursor;
    };
  };
}

// Enter로 만들어진 빈 블록에서 질의할 "직전 블록"의 텍스트.
//
// doc 최상위 인덱스만 보면 안 된다. 커서가 리스트 항목 안에 있으면
// $from.index(0)은 리스트 *전체*의 위치라, 직전 항목이 아니라 리스트 앞의
// 블록을 질의하게 된다. 실제 메모 청크의 47%가 리스트 항목이라 흔한 경로다.
// 그래서 커서 깊이에서 위로 올라가며 형제가 있는 첫 층을 찾는다.
const previousBlockText = (cursor: AmbientIdleCursor): string => {
  for (let depth = cursor.depth; depth > 0; depth -= 1) {
    const index = cursor.index(depth - 1);
    if (index > 0) {
      return cursor.node(depth - 1).child(index - 1).textContent;
    }
  }
  return '';
};

// 핸들러는 발화 시점에 getOnIdle()로 읽는다. 리렌더로 콜백 identity가
// 바뀌어도 대기 중인 idle 타이머를 잃지 않기 위한 구조다.
export const attachAmbientIdle = (
  editor: AmbientIdleEditor,
  getOnIdle: () => ((chunkText: string) => void) | undefined,
  delayMs: number = AMBIENT_IDLE_DELAY_MS,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const pendingQuery = () => {
    const { $from } = editor.state.selection;
    const paragraph = $from.parent.textContent;
    if ($from.parent.type.name === 'heading') {
      return {
        chunkText: paragraph.slice(0, 1000),
        delayMs: AMBIENT_HEADING_DELAY_MS,
      };
    }

    if (!paragraph.trim()) {
      return {
        chunkText: previousBlockText($from).slice(0, 1000),
        delayMs: AMBIENT_BOUNDARY_DELAY_MS,
      };
    }

    const cursorOffset = Math.min($from.parentOffset, paragraph.length);
    return {
      chunkText: getCursorContextText(
        paragraph,
        cursorOffset,
      ).slice(0, 1000),
      delayMs: endsAtBoundary(paragraph.slice(0, cursorOffset))
        ? AMBIENT_BOUNDARY_DELAY_MS
        : delayMs,
    };
  };

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }
    const { delayMs: pendingDelay } = pendingQuery();
    timer = setTimeout(() => {
      // IME 보호는 디바운스가 담당한다: 조합 중 키 입력은 매번 update로
      // 타이머를 리셋하므로, 여기 도달 = 선택된 지연 시간 동안 입력 없음. composing 플래그를
      // 검사하면 안 된다 — macOS 한글 IME는 마지막 글자를 조합 상태로
      // 무기한 유지해 트리거가 영구 차단된다.
      const { chunkText } = pendingQuery();
      // 커서가 구분선 같은 무의미한 줄 위에 있으면 질의하지 않는다 —
      // 색인에서도 걸러지는 텍스트라 검색해봐야 매칭될 대상이 없다.
      if (!isMeaningfulChunk(chunkText)) {
        return;
      }
      getOnIdle()?.(chunkText);
    }, pendingDelay);
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
