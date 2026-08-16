import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const popover = read('features/memo/components/DateSchedulePopover.tsx');
const field = read('features/memo/components/DateScheduleField.tsx');
const styles = read('styles/subnota-workspace.scss');

describe('날짜 선택 달력', () => {
  // 이 달력은 자기를 띄운 일정 팝오버(300px) 안에 들어가야 한다. 예전 340px은
  // 부모를 40px 넘어서서 옆으로 튀어나왔다.
  it('부모 팝오버보다 좁다', () => {
    expect(styles).toMatch(
      /\.date-schedule-popover \{[\s\S]*?width: min\(228px/,
    );
    // 띄우는 쪽 컨테이너도 같은 폭이어야 달력이 가운데 떠 보이지 않는다.
    expect(styles).toMatch(
      /\.date-schedule-field-popover \{[\s\S]*?width: min\(228px/,
    );
    // 달력을 띄우는 컨테이너가 넷이다. 하나라도 340으로 남으면 그 자리에서만
    // 달력이 가운데 뜬 것처럼 보인다. (`.split-view-picker-panel`은 이 달력이
    // 아니라 분할 뷰 선택기라 340 그대로 둔다.)
    for (const rule of [
      '.date-schedule-popover',
      '.date-schedule-field-popover',
      '.date-schedule-floating',
      '.split-date-schedule-floating',
    ]) {
      const block = styles.slice(styles.indexOf(`${rule} {`));
      expect(block.slice(0, block.indexOf('}'))).not.toContain('340px');
    }
  });

  // 날짜 칸이 36px/15px로 앱에서 가장 큰 컨트롤이었다. 설정 행 제목이 13px,
  // 캘린더 일정 글자가 11px다.
  it('날짜 칸이 앱의 다른 컨트롤보다 크지 않다', () => {
    expect(styles).toMatch(
      /\.date-schedule-day \{[\s\S]*?font-size: 12px[\s\S]*?width: 26px/,
    );
  });

  it('포털과 인라인 피커가 같은 컴팩트 폭을 쓴다', () => {
    expect(field).toContain('Math.min(228, window.innerWidth - viewportPadding * 2)');
  });

  it('오전/오후 토글이 줄어들거나 줄바꿈되지 않는다', () => {
    expect(popover).toContain('aria-label="시간"');
    expect(styles).toMatch(
      /\.date-schedule-meridiem button \{[\s\S]*?flex: 0 0 28px;[\s\S]*?white-space: nowrap;/,
    );
  });

  // 바로 옆 주간 그리드가 일·월·화를 쓴다. 한 화면에서 언어가 갈리면 안 된다.
  it('한글로 쓴다', () => {
    expect(popover).toContain(
      "const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];",
    );
    expect(popover).toContain("format(visibleMonth, 'M월', { locale: ko })");
    expect(popover).toContain('오전');
    expect(popover).toContain('오후');
    expect(popover).not.toContain("'MMMM'");
  });

  // 몇 년 뒤로 건너뛰는 일은 드물어도, 없애면 ‹ › 를 스무 번 눌러야 한다.
  // 상자만 벗기고 기능은 남긴다.
  it('연도 선택은 글자처럼 보이되 남아 있다', () => {
    expect(popover).toContain('className="date-schedule-year-select"');
    expect(styles).toMatch(
      /\.date-schedule-year-select \{[\s\S]*?background: transparent;[\s\S]*?border: 0;/,
    );
  });

  // placement는 이미 계산해 두고 위치를 정하는 데만 썼다.
  it('열린 방향에서 자란다', () => {
    expect(field).toContain('scale: 0.94');
    expect(field).toContain("y: placement === 'top' ? 4 : -4,");
    expect(field).toContain('shouldReduceMotion');
    // AnimatePresence가 조건문 안에 있으면 exit이 조용히 건너뛰어진다.
    expect(field).toMatch(/<AnimatePresence>\s*\n\s*\{open && \(/);
    expect(styles).toMatch(
      /\.date-schedule-field-popover\.bottom \{[^}]*transform-origin: top center/,
    );
    expect(styles).toMatch(
      /\.date-schedule-field-popover\.top \{[^}]*transform-origin: bottom center/,
    );
  });
});
