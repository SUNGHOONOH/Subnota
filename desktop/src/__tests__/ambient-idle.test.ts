import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachAmbientIdle } from '../lib/ambientIdle';
import { endsAtBoundary } from '../lib/memoChunker';
import {
  AMBIENT_BOUNDARY_DELAY_MS,
  AMBIENT_HEADING_DELAY_MS,
  AMBIENT_IDLE_DELAY_MS,
} from '../lib/constants';

type Listener = () => void;

// ancestors[d]는 깊이 d 노드의 자식 텍스트와 커서 조상이 놓인 위치다.
// 기본값은 평평한 문서(doc > paragraph)이고, 리스트처럼 중첩된 구조를
// 검증할 때만 직접 넘긴다.
type FakeLevel = { children: string[]; index: number };

const createFakeEditor = (
  paragraph: string,
  parentOffset = 0,
  parentType = 'paragraph',
  blocks = [paragraph],
  blockIndex = 0,
  ancestors: FakeLevel[] = [{ children: blocks, index: blockIndex }],
) => {
  const parent = {
    textContent: paragraph,
    type: { name: parentType },
  };
  const listeners = new Map<string, Set<Listener>>();
  return {
    emit(event: 'update' | 'selectionUpdate') {
      listeners.get(event)?.forEach(listener => listener());
    },
    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0;
    },
    on(event: 'update', handler: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(handler);
      return this;
    },
    off(event: 'update', handler: Listener) {
      listeners.get(event)?.delete(handler);
      return this;
    },
    state: {
      selection: {
        $from: {
          depth: ancestors.length,
          index: (depth: number) => ancestors[depth].index,
          node: (depth: number) => ({
            child: (index: number) => ({
              textContent: ancestors[depth].children[index] ?? '',
            }),
          }),
          parent,
          parentOffset,
        },
      },
    },
  };
};

describe('attachAmbientIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('editor update 후 idle 지연이 지나면 커서 문맥으로 onIdle을 호출한다', () => {
    const editor = createFakeEditor('오늘은 데스크톱 통합 작업을 정리하는 중이다');
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(onIdle).toHaveBeenCalledWith('오늘은 데스크톱 통합 작업을 정리하는 중이다');
  });

  // 구분선 위에 커서가 있으면 질의해봐야 색인에도 없는 텍스트라 매칭이 없다.
  // 무의미한 HF 임베딩 호출을 막는다.
  it('커서가 구분선 같은 무의미한 줄에 있으면 발화하지 않는다', () => {
    for (const noise of ['─────────────', '---', '- [ ]']) {
      const editor = createFakeEditor(noise);
      const onIdle = vi.fn();
      attachAmbientIdle(editor, () => onIdle);

      editor.emit('update');
      vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);
      expect(onIdle, noise).not.toHaveBeenCalled();
    }
  });

  it('연속 입력은 디바운스되어 마지막 입력 기준으로 한 번만 발화한다', () => {
    const editor = createFakeEditor('디바운스 확인용 문장을 이어 쓰는 중입니다');
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS - 100);
    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('대기 중 핸들러가 교체되어도(리렌더) 타이머를 잃지 않고 최신 핸들러를 호출한다', () => {
    // 회귀 테스트: 기존 effect는 onAmbientIdle 새 identity마다 cleanup으로
    // 대기 중인 idle 타이머를 제거해 카드가 절대 뜨지 않았다.
    const editor = createFakeEditor('리렌더 중에도 살아남아야 하는 문장.');
    const first = vi.fn();
    const second = vi.fn();
    let current = first;
    attachAmbientIdle(editor, () => current);

    editor.emit('update');
    current = second; // 타이핑이 유발한 리렌더로 핸들러 교체
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cleanup은 대기 중 타이머를 취소하고 리스너를 해제한다', () => {
    const editor = createFakeEditor('정리 확인용 문장입니다.');
    const onIdle = vi.fn();
    const detach = attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    detach();
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);

    expect(onIdle).not.toHaveBeenCalled();
    expect(editor.listenerCount('update')).toBe(0);
  });

  it('핸들러가 없으면 조용히 무시한다', () => {
    const editor = createFakeEditor('핸들러 없음 케이스.');
    attachAmbientIdle(editor, () => undefined);

    editor.emit('update');
    expect(() => vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS)).not.toThrow();
  });

  it('커서 이동(selectionUpdate)만으로는 발화하지 않는다', () => {
    const editor = createFakeEditor('커서 이동만으로는 트리거되지 않는 문장.');
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('selectionUpdate');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);

    expect(onIdle).not.toHaveBeenCalled();
    expect(editor.listenerCount('selectionUpdate')).toBe(0);
  });

  it('한글 IME 조합이 마지막 글자에 걸린 채 멈춰도 idle 후 발화한다', () => {
    // macOS 한글 IME는 입력을 멈추면 마지막 글자가 조합 상태로 남는다.
    // IME 보호는 디바운스(입력마다 타이머 리셋)가 담당하므로, 선택된 지연 시간 동안 무입력
    // 이후에는 조합 여부와 무관하게 pending query를 준비해야 한다.
    const editor = createFakeEditor('한글 입력 후 멈춘 문장입니다');
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);

    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(onIdle).toHaveBeenCalledWith('한글 입력 후 멈춘 문장입니다');
  });

  it('한 번 발화한 뒤에도 다음 이벤트에서 다시 스케줄된다', () => {
    const editor = createFakeEditor('반복 발화 확인용 문장입니다.');
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);
    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);

    expect(onIdle).toHaveBeenCalledTimes(2);
  });

  it('커서 위치 기준 ±1문장 문맥을 추출한다(멀리 있는 문장 제외)', () => {
    const first = '첫 번째 문장은 문맥에서 제외되어야 합니다.';
    const fourth = '네 번째 문장에 커서가 놓여 있습니다.';
    const paragraph = [
      first,
      '두 번째 문장이 이어집니다.',
      '세 번째 문장도 이어집니다.',
      fourth,
      '다섯 번째 문장으로 끝납니다.',
    ].join(' ');
    const editor = createFakeEditor(paragraph, paragraph.indexOf(fourth) + 3);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);

    const chunkText = onIdle.mock.calls[0][0] as string;
    expect(chunkText).toContain(fourth);
    expect(chunkText).not.toContain(first);
  });

  it('heading은 Planning 질의로 1.5초 뒤 발화한다', () => {
    const heading = '데스크톱 임베딩 전환 계획';
    const editor = createFakeEditor(heading, heading.length, 'heading');
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_HEADING_DELAY_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onIdle).toHaveBeenCalledWith(heading);
  });

  it('유효한 문장 경계는 현행 문맥을 2초 뒤 발화한다', () => {
    const paragraph = '문장을 끝내고 멈춘 상태입니다.';
    const editor = createFakeEditor(paragraph, paragraph.length);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_BOUNDARY_DELAY_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onIdle).toHaveBeenCalledWith(paragraph);
  });

  it('커서 앞이 문장 경계면 블록 뒤쪽 텍스트가 있어도 2초 뒤 발화한다', () => {
    const paragraph = '첫 문장을 끝냈습니다. 다음 문장을 이어 쓰는 중입니다';
    const cursorOffset = paragraph.indexOf(' 다음');
    const editor = createFakeEditor(paragraph, cursorOffset);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_BOUNDARY_DELAY_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('빈 블록에서는 직전 블록을 2초 뒤 한 번만 질의한다', () => {
    const previous = 'Enter로 문단을 끝낸 직전 블록입니다.';
    const editor = createFakeEditor('', 0, 'paragraph', [previous, ''], 1);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_BOUNDARY_DELAY_MS);

    expect(onIdle).toHaveBeenCalledWith(previous);

    const consecutiveEnterEditor = createFakeEditor(
      '',
      0,
      'paragraph',
      [previous, '', ''],
      2,
    );
    const consecutiveOnIdle = vi.fn();
    attachAmbientIdle(consecutiveEnterEditor, () => consecutiveOnIdle);
    consecutiveEnterEditor.emit('update');
    vi.advanceTimersByTime(AMBIENT_BOUNDARY_DELAY_MS);
    expect(consecutiveOnIdle).not.toHaveBeenCalled();
  });

  // 실제 메모 청크의 47%가 리스트 항목이다. doc 최상위 인덱스만 보면
  // 리스트 안에서 Enter를 쳤을 때 직전 항목이 아니라 리스트 앞의 블록을
  // 질의하게 된다.
  it('리스트 항목에서 Enter를 치면 리스트 앞 블록이 아니라 직전 항목을 질의한다', () => {
    const beforeList = '리스트 앞에 있는 문단입니다.';
    const previousItem = '- 직전 리스트 항목입니다.';
    // doc > bulletList > listItem > paragraph(빈 새 항목)
    const editor = createFakeEditor('', 0, 'paragraph', [], 0, [
      { children: [beforeList, '<bulletList>'], index: 1 },
      { children: [previousItem, ''], index: 1 },
      { children: [''], index: 0 },
    ]);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_BOUNDARY_DELAY_MS);

    expect(onIdle).toHaveBeenCalledWith(previousItem);
  });

  it('리스트의 첫 항목에서 Enter를 치면 발화하지 않는다', () => {
    const editor = createFakeEditor('', 0, 'paragraph', [], 0, [
      { children: ['<bulletList>'], index: 0 },
      { children: [''], index: 0 },
      { children: [''], index: 0 },
    ]);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_BOUNDARY_DELAY_MS);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('경계 없는 연속 입력 정지는 5초 뒤까지 발화하지 않는다', () => {
    const paragraph = '아직 문장을 이어 쓰는 중이라 경계가 없습니다';
    const editor = createFakeEditor(paragraph, paragraph.length);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledWith(paragraph);
  });

  it('parentOffset이 본문 길이를 넘어도(경계값) 안전하게 발화한다', () => {
    const paragraph = '경계값에서도 안전해야 하는 문장.';
    const editor = createFakeEditor(paragraph, paragraph.length + 40);
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS);

    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(onIdle).toHaveBeenCalledWith(paragraph);
  });
});

describe('endsAtBoundary', () => {
  it.each([
    ['해야 함', true],
    ['했음', true],
    ['갔다', true],
    ['Dr.', false],
    ['e.g.', false],
    ['그는 "좋다." 라고', false],
    ['할 것 같다', false],
  ])('%s → %s', (text, expected) => {
    expect(endsAtBoundary(text)).toBe(expected);
  });
});
