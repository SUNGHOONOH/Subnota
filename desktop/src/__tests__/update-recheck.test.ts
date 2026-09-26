import { describe, expect, it } from 'vitest';

import { shouldRecheckForUpdate } from '../features/update/useAppUpdate';

const HOUR = 60 * 60 * 1000;

// 앱을 며칠씩 켜 두는 사용자도 하루 안에는 새 버전을 알아야 한다.
describe('shouldRecheckForUpdate', () => {
  it('마지막 확인 후 하루가 지나면 다시 확인한다', () => {
    expect(shouldRecheckForUpdate('idle', 0, 24 * HOUR)).toBe(true);
    expect(shouldRecheckForUpdate('idle', 0, 23 * HOUR)).toBe(false);
  });

  // 받는 중·적용 중에 확인하면 진행 상태가 "업데이트 있음"으로 되돌아간다.
  it('이미 찾았거나 진행 중이면 확인하지 않는다', () => {
    for (const status of ['available', 'downloading', 'installing', 'error'] as const) {
      expect(shouldRecheckForUpdate(status, 0, 48 * HOUR)).toBe(false);
    }
  });
});
