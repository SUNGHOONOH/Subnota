import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notifyClipFailed, notifyClipSaved } from '../lib/clipNotification';

const showClipNotification = vi.fn(async () => true);

beforeEach(() => {
  showClipNotification.mockClear();
  showClipNotification.mockResolvedValue(true);
  vi.stubGlobal('window', { electronAPI: { showClipNotification } });
});
afterEach(() => vi.unstubAllGlobals());

// 클리핑은 브라우저를 보는 중에 일어난다. 앱 안에만 표시하면 사용자에게
// 닿지 않으므로 OS 알림으로 나가야 한다.
describe('notifyClipSaved', () => {
  it('페이지 제목을 본문으로 알린다', async () => {
    notifyClipSaved('SQLite WAL 모드 정리', () => undefined);
    await vi.waitFor(() => expect(showClipNotification).toHaveBeenCalledOnce());

    expect(showClipNotification).toHaveBeenCalledWith(
      'saved',
      'SQLite WAL 모드 정리',
      expect.any(Function),
    );
  });

  it('main-process 알림 클릭을 수집함 열기 동작으로 연결한다', async () => {
    const onOpen = vi.fn();
    notifyClipSaved('제목', onOpen);
    await vi.waitFor(() => expect(showClipNotification).toHaveBeenCalledOnce());

    const onClick = showClipNotification.mock.calls[0][2];
    onClick?.();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe('notifyClipFailed', () => {
  it('실패 원인을 그대로 전달한다', async () => {
    notifyClipFailed('지원하는 브라우저를 찾지 못했습니다.');
    await vi.waitFor(() => expect(showClipNotification).toHaveBeenCalledOnce());

    expect(showClipNotification).toHaveBeenCalledWith(
      'failed',
      '지원하는 브라우저를 찾지 못했습니다.',
      undefined,
    );
  });

  // 실패 알림에는 클릭 동작을 붙이지 않는다 — 열어 봐야 저장된 게 없다.
  it('클릭 동작이 없다', async () => {
    notifyClipFailed('실패');
    await vi.waitFor(() => expect(showClipNotification).toHaveBeenCalledOnce());
    expect(showClipNotification.mock.calls[0][2]).toBeUndefined();
  });
});

describe('캡처 결과 배선', () => {
  const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

  it('성공과 실패 모두 알림으로 이어진다', () => {
    expect(appSource).toContain('notifyClipSaved(');
    expect(appSource).toContain('notifyClipFailed(');
    // 성공 알림 클릭은 창을 띄우고 수집함으로 보낸다.
    expect(appSource).toContain('window.electronAPI?.showMainWindow?.()');
    expect(appSource).toContain("openViewAsTabRef.current('inbox')");
  });
});
