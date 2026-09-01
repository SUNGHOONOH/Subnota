import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const main = readFileSync(resolve(__dirname, '../main.ts'), 'utf8');
const miniMain = readFileSync(resolve(__dirname, '../mini-subnota.ts'), 'utf8');

const between = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('웹 클리핑은 사용자의 작업 흐름을 건드리지 않는다', () => {
  // 메인 창을 닫았다는 것은 트레이/Quick만으로 쓰겠다는 뜻이다. 링크 하나
  // 담았다고 작업 공간이 통째로 되살아나면 클리핑이 방해가 된다.
  it('닫아 둔 메인 창을 되살리지 않는다', () => {
    const deliver = between(
      main,
      'const deliverToMainWindow',
      'const openSettingsWindow',
    );

    expect(deliver).toContain("createWindow({ show: false })");
    expect(deliver).not.toContain('.show()');
    expect(deliver).not.toContain('.focus()');
    expect(deliver).not.toContain('.restore()');
  });

  it('열려 있는 메인 창으로 포커스를 빼앗지 않는다', () => {
    // 캡처 성공·실패, 웹 클리퍼 딥링크 — 세 경로 모두 배경 전달을 쓴다.
    expect(main).toContain("deliverToMainWindow('inbox-capture', payload)");
    expect(main).toContain(
      "deliverToMainWindow('inbox-capture', { error: message })",
    );
    expect(main).toContain(
      "deliverToMainWindow('inbox-capture', { title: link.title, url: link.url })",
    );
    expect(main).not.toContain("sendToMainWindow('inbox-capture'");
  });

  // 사용자가 "Subnota를 열어 달라"고 한 동작은 그대로 앞으로 와야 한다.
  it('설정 열기와 새 메모는 창을 앞으로 가져온다', () => {
    expect(main).toContain("sendToMainWindow('open-settings')");
    expect(main).toContain("sendToMainWindow('new-memo')");

    const send = between(main, 'const sendToMainWindow', 'const deliverToMainWindow');
    expect(send).toContain('mainWindow.show();');
    expect(send).toContain('mainWindow.focus();');
  });

  // 브라우저를 보는 중에 창이 튀어나오면 그 자체가 방해다.
  it('캡처 중에 Quick 창을 띄우지 않는다', () => {
    const capture = between(
      miniMain,
      'export const captureCurrentBrowserPage',
      '\n};\n',
    );

    expect(capture).not.toContain('reveal: true');
  });

  it('숨긴 창으로도 만들 수 있어야 한다', () => {
    expect(main).toContain('const createWindow = ({ show = true }');
    expect(main).toContain('show: isWindows ? false : show');
    expect(main).toContain('if (show) mainWindow.show();');
  });
});

describe('클리핑 결과는 늘 보이는 자리에 남는다', () => {
  // OS 알림은 알림을 꺼 뒀거나 집중 모드면 닿지 않는다. 메뉴바는 늘 보인다.
  it('진행·실패를 메뉴바 표시로 알린다', () => {
    expect(main).toContain('captureInFlight');
    expect(main).toContain("tray.setTitle(' ⋯')");
    expect(main).toContain("tray.setTitle(' !')");
    expect(miniMain).toContain('options.onCaptureStart?.()');
  });

  // 알림 지원 여부보다 먼저 갱신해야 알림이 없는 환경에서도 남는다.
  it('알림을 못 쓰는 환경에서도 표시가 남는다', () => {
    // `app.on(`는 파일 앞쪽에도 있어 앵커로 못 쓴다. 핸들러 바로 뒤 블록을 쓴다.
    const handler = between(
      main,
      "ipcMain.handle('clip-notification:show'",
      "app.on('web-contents-created'",
    );
    const indicatorAt = handler.indexOf('endCaptureIndicator');
    const guardAt = handler.indexOf('Notification.isSupported()');

    expect(indicatorAt).toBeGreaterThan(-1);
    expect(indicatorAt).toBeLessThan(guardAt);
  });

  // 알림을 놓쳐도 "담은 줄 알았는데 없더라"가 생기면 안 된다.
  it('실패는 확인할 때까지 트레이 메뉴에 남는다', () => {
    expect(main).toContain('lastCaptureFailure');
    expect(main).toContain("mainT('저장하지 못함', 'Could not save')");
    expect(main).toContain('click: acknowledgeCaptureFailure');
  });

  it('로컬 저장이 끝나면 진행 표시를 내린다', () => {
    const record = between(main, 'const recordInboxSave', 'const installTrayItem');
    expect(record).toContain('endCaptureIndicator();');
  });
});

describe('저장 결과 문구와 알림 설정', () => {
  const clip = readFileSync(resolve(__dirname, '../lib/clipNotification.ts'), 'utf8');
  const settings = readFileSync(resolve(__dirname, '../lib/appSettings.ts'), 'utf8');

  // 제목만 보내면 "담겼다"까지만 알고 요약이 실패한 것은 모른 채 지나간다.
  it('알림 본문이 요약 상태를 구분한다', () => {
    expect(clip).toContain('요약 준비 중');
    expect(clip).toContain('요약은 일부만');
    expect(clip).toContain('요약은 만들지 못했어요');
  });

  it('알림은 기본으로 켜져 있다', () => {
    expect(settings).toContain('clipNotifications: true');
  });

  // 끄면 OS 알림만 빠지고 메뉴바·트레이는 그대로여야 한다.
  it('알림을 꺼도 메뉴바 표시는 남는다', () => {
    expect(clip).toContain('loadAppSettings().clipNotifications');
    // 메뉴바 갱신은 렌더러 설정과 무관하게 메인 프로세스가 한다.
    expect(main).not.toContain('clipNotifications');
  });

  // 알림을 놓쳤을 때 "담기긴 했나"를 확인할 자리.
  it('성공도 트레이 메뉴에서 확인할 수 있다', () => {
    expect(main).toContain("mainT('링크가 저장되었습니다', 'Link saved')");
    expect(main).toContain('click: acknowledgeInboxSave');
    expect(main).toContain('setUnreadInbox(false);');
  });

  // 오프라인 큐와 상세 페이지 재시도가 이미 있어 트레이에 또 두지 않는다.
  it('트레이에 재시도를 중복으로 두지 않는다', () => {
    const failureEntry = main.slice(
      main.indexOf('click: acknowledgeCaptureFailure') - 200,
      main.indexOf('click: acknowledgeCaptureFailure') + 300,
    );
    expect(failureEntry).toContain('acknowledgeCaptureFailure');
    expect(failureEntry).not.toContain('다시 시도');
  });
});
