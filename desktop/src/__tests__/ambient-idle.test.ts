import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachAmbientIdle } from '../lib/ambientIdle';
import { AMBIENT_IDLE_DELAY_MS } from '../lib/constants';

type Listener = () => void;

const createFakeEditor = (paragraph: string, parentOffset = 0) => {
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
          parent: { textContent: paragraph },
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
    const editor = createFakeEditor('오늘은 데스크톱 통합 작업을 정리했다.');
    const onIdle = vi.fn();
    attachAmbientIdle(editor, () => onIdle);

    editor.emit('update');
    vi.advanceTimersByTime(AMBIENT_IDLE_DELAY_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(onIdle).toHaveBeenCalledWith('오늘은 데스크톱 통합 작업을 정리했다.');
  });

  it('연속 입력은 디바운스되어 마지막 입력 기준으로 한 번만 발화한다', () => {
    const editor = createFakeEditor('디바운스 확인용 문장입니다.');
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
    // IME 보호는 디바운스(입력마다 타이머 리셋)가 담당하므로, 2초 무입력
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
