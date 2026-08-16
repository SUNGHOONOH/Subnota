import { describe, expect, it } from 'vitest';

import { didScheduleConfirmSelectionChange } from '../lib/scheduleFromSelection';

describe('일정 등록 확인 팝오버의 선택 범위', () => {
  it('확인 바를 연 원래 선택이 유지되면 닫지 않는다', () => {
    expect(didScheduleConfirmSelectionChange(8, 24, 8, 24)).toBe(false);
  });

  it('커서를 찍어 선택이 풀리면 확인 바를 닫는다', () => {
    expect(didScheduleConfirmSelectionChange(8, 24, 24, 24)).toBe(true);
  });

  it('다른 문장을 선택해도 이전 선택의 확인 바를 닫는다', () => {
    expect(didScheduleConfirmSelectionChange(8, 24, 30, 38)).toBe(true);
  });
});
