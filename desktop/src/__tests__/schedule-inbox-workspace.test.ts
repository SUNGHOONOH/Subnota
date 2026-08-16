import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  hasScheduledDate,
  mergePendingScheduleInbox,
  partitionScheduleInbox,
  requiresSchedulePicker,
} from '../features/schedule/scheduleInboxUtils';
import type { ScheduleInboxRow } from '../types';

const source = readFileSync(
  resolve(__dirname, '../features/schedule/ScheduleInboxWorkspace.tsx'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const placementSource = readFileSync(
  resolve(__dirname, '../lib/anchoredPlacement.ts'),
  'utf8',
);
const calendarSource = readFileSync(
  resolve(__dirname, '../features/calendar/CalendarWorkspace.tsx'),
  'utf8',
);
const styles = readFileSync(
  resolve(__dirname, '../styles/subnota-workspace.scss'),
  'utf8',
);

const item = (
  patch: Partial<ScheduleInboxRow> = {},
): ScheduleInboxRow => ({
  all_day: false,
  confidence: 'candidate',
  created_at: '2026-07-28T09:00:00.000Z',
  id: 'schedule-1',
  memo_id: 'memo-1',
  scheduled_at: '2026-07-29T10:00:00.000Z',
  source_text: '다음 주 회의 일정을 잡는다.',
  status: 'pending',
  time_text: '오전 10시',
  title: '팀 회의',
  ...patch,
});

describe('ScheduleInboxWorkspace', () => {
  it('uses placement/delete labels and keeps every card draggable', () => {
    expect(source).toContain('캘린더에 배치');
    expect(source).toContain('draggable');
    expect(source).toContain('삭제');
    expect(source).not.toContain('>승인<');
    expect(source).not.toContain('>거절<');
    expect(source).not.toContain('disabled=');
    expect(source).not.toContain('예시 일정 넣기');
    expect(appSource).not.toContain('seedScheduleExamples');
    expect(appSource).not.toContain('sample-schedule-');
  });

  // 카드마다 버튼 3개가 늘 떠 있어 360px 패널이 버튼 9개로 채워졌다.
  // 배치·삭제만 hover에 남기고 수정은 행 클릭으로 옮겼다.
  it('배치·삭제만 hover 아이콘으로 두고 수정은 행 클릭에 맡긴다', () => {
    expect(source).toContain('className="schedule-approve-row"');
    expect(source).toContain('className="schedule-approve-open"');
    // 드래그는 감싼 요소가 아니라 이 버튼이 직접 받는다 — 버튼 위에서 시작한
    // 드래그가 조상으로 올라가기를 기대하지 않는다(캘린더 .cal-event와 동일).
    expect(source).toMatch(
      /className="schedule-approve-open"\s*\n\s*draggable\s*\n[\s\S]*?onDragStart=\{event => handleDragStart\(event, item\)\}/,
    );
    expect(source).toContain('title="클릭해 시간·제목 수정 · 주간 캘린더로 드래그해 배치"');
    // 아이콘 버튼은 이름이 없으면 무엇인지 알 수 없다.
    expect(source).toContain('aria-label="캘린더에 배치"');
    expect(source).toContain('aria-label="삭제"');
    // ✎는 행이 이미 하는 일이라 중복이다. 아이콘이 3개가 되면 제목 폭이 줄어든다.
    expect(source).not.toContain('>수정<');
    expect(source).not.toContain('approve-btn');
    expect(source).not.toContain('edit-btn');
    expect(source).not.toContain('reject-btn');

    expect(styles).toMatch(
      /\.schedule-approve-row-actions\s*\{[\s\S]*?opacity:\s*0/,
    );
    // 키보드로도 배치·삭제에 닿아야 한다. :focus-within은 안 된다 — 마우스로
    // 누른 버튼에 포커스가 남아 커서가 행을 벗어나도 계속 떠 있는다.
    expect(styles).toContain(
      '.schedule-approve-row:has(:focus-visible) .schedule-approve-row-actions',
    );
    expect(styles).not.toContain('.schedule-approve-row:focus-within');
  });

  // 패널 바탕과 행 바탕이 같은 흰색이라, 그림자를 얹으면 상자 속 상자가 된다.
  it('행에 그림자를 얹지 않고 hover 링으로 누를 수 있음을 알린다', () => {
    // `.schedule-inbox-layout.compact .schedule-approve-row`가 앞에 먼저
    // 나오므로 줄 시작을 기준으로 잘라야 본문 규칙을 집는다.
    const row = styles.slice(
      styles.indexOf('\n.schedule-approve-row {'),
      styles.indexOf('.schedule-approve-open {'),
    );

    expect(row).not.toMatch(/box-shadow:\s*0 1px 2px/);
    expect(row).toMatch(
      /\.schedule-approve-row:hover\s*\{[\s\S]*?box-shadow:\s*0 0 0 1px var\(--legacy-border-strong\)/,
    );
  });

  // "3일 전"과 "11월 3일"이 한 행에 같이 있었다. 저장함에서 생성 시각은
  // 쓸 일이 없고, 본문 1줄 clamp는 읽히지도 않으면서 자리만 먹었다.
  it('생성일과 잘린 본문을 행에서 뺀다', () => {
    expect(source).not.toContain('formatCreatedAgo');
    expect(source).not.toContain('formatDistanceToNow');
    expect(source).not.toContain('schedule-approve-body');
    // 원문 전체는 수정 시트에 그대로 남는다.
    expect(source).toContain('{editingInbox.source_text}');
  });

  // 두 창이 하는 일이 같은데 제목 32px/18px, 입력칸 44px/33px, 닫기가
  // 텍스트/아이콘으로 갈려 있었다. 캘린더 모달 규격으로 맞춘다.
  it('수정 시트가 새 일정 모달과 같은 규격을 쓴다', () => {
    // 앵커가 있으면 `cal-modal anchored {side}`, 없으면 `cal-modal`이다.
    expect(source).toContain("'cal-modal'");
    expect(source).toContain('className="cal-modal-head"');
    expect(source).toContain('className="cal-modal-rows"');
    expect(source).toContain('className="cal-modal-foot"');
    expect(source).toContain('className="cal-btn primary"');

    // 제목 입력이 헤더를 대신한다 — 제목줄·라벨·입력칸으로 같은 말을 세 번
    // 하던 자리다. 캘린더 모달과 같은 클래스를 쓴다.
    expect(source).toContain('className="cal-modal-title"');
    expect(source).toContain('label={null}');
    expect(source).not.toContain('<h2>');
    expect(source).not.toContain('className="cal-field"');

    // h2에 크기 지정이 없어 브라우저 기본 2em(32px)이 나오던 시트.
    expect(source).not.toContain('compact-sheet');
    expect(source).not.toContain('sheet-title-row');
    expect(source).not.toContain('className="eyebrow"');
    // 수정은 이 창이 하는 일이라 버튼이 다시 말하지 않는다.
    expect(source).not.toContain('수정해서 등록');
  });

  // 시간 미정이면 ✓를 눌러도 바로 배치되지 않고 날짜 선택이 뜬다.
  // 그 신호를 색이 맡으므로 hover 표시에는 색을 쓰지 않는다.
  it('시간 미정은 메타 줄 색으로 알린다', () => {
    expect(source).toContain("requiresSchedulePicker(item) ? ' needs' : ''");
    expect(styles).toMatch(
      /\.schedule-approve-meta\.needs\s*\{[\s\S]*?color:\s*var\(--legacy-muted\)/,
    );
  });

  // .app-side-panel-slot이 `position: fixed; z-index: 45`라 스택 컨텍스트를
  // 만든다. 모달을 그 안에 두면 z-index 50이 슬롯 내부 순서일 뿐이어서
  // 캘린더 이벤트가 모달 위에 그려진다.
  it('수정 시트를 body로 포털해 사이드 패널 스택 컨텍스트를 벗어난다', () => {
    expect(source).toContain("import { createPortal } from 'react-dom';");
    expect(source).toContain("'modal-backdrop detail-backdrop'");
    expect(source).toContain('document.body,');
    expect(styles).toMatch(/\.app-side-panel-slot\s*\{[\s\S]*?z-index:\s*45/);
  });

  // 회귀 방지. 포털을 AnimatePresence "안"에 두면 AnimatePresence의 자식이
  // ReactPortal이 되는데, framer-motion은 자식을 cloneElement로 감싸 존재를
  // 추적하므로 포털은 그 대상이 될 수 없다 — 창이 아예 뜨지 않는다.
  // 포털이 바깥, AnimatePresence가 안쪽이어야 한다.
  it('포털이 AnimatePresence 바깥에 있다', () => {
    expect(source).toMatch(/createPortal\(\s*\n\s*<AnimatePresence>/);
    expect(source).not.toMatch(/<AnimatePresence>[\s\S]{0,200}?createPortal\(/);
  });

  // 저장을 명시적으로 받는 창이라 닫는 것도 명시적이어야 한다. 실수로 스친
  // 클릭에 쓰던 내용이 사라지면 안 된다.
  it('바깥 클릭으로는 닫히지 않는다', () => {
    for (const file of [source, calendarSource]) {
      expect(file).toContain('modal-backdrop');
      expect(file).not.toContain('if (event.currentTarget !== event.target)');
      expect(file).not.toContain('onMouseDown={');
    }
  });

  // 바깥 클릭이 없으니 Esc가 키보드 사용자의 유일한 퇴로다. 이것까지 없으면
  // 취소 버튼에 도달할 때까지 창에 갇힌다.
  it('Esc로는 닫을 수 있다', () => {
    expect(source).toContain("if (event.key === 'Escape') setEditingInbox(null);");
    expect(calendarSource).toContain(
      "if (event.key !== 'Escape' || isCategoryMenuOpen) return;",
    );
  });

  // 주간 뷰에서 일정을 누르면 그 옆에 붙는다. 가운데 모달은 어디를 눌렀는지와
  // 창이 뜨는 자리가 아무 관계가 없어 맥락이 끊긴다.
  it('누른 일정 옆에 붙고, 자리가 없으면 반대편으로 뒤집는다', () => {
    // 클릭 지점이 앵커를 넘긴다.
    expect(calendarSource).toContain(
      'openEditor(date, block, event.currentTarget)',
    );
    expect(calendarSource).toContain(
      'openSuggestionEditor(suggestion, event.currentTarget)',
    );
    // 오른쪽 우선, 안 되면 왼쪽, 둘 다 안 되면 앵커를 포기한다. 계산은
    // 캘린더와 일정 저장함이 같은 모듈을 쓴다 — 하는 일이 같은 창이 서로
    // 다른 자리 규칙을 가지면 안 된다.
    expect(placementSource).toContain('const fitsRight =');
    expect(placementSource).toContain('const fitsLeft =');
    expect(placementSource).toContain(
      'if (!fitsRight && !fitsLeft) return null;',
    );
    expect(calendarSource).toContain('getAnchoredPlacement(anchorRect');
    expect(source).toContain('getAnchoredPlacement(anchorRect');
    // 일정 저장함도 누른 행을 앵커로 넘긴다.
    expect(source).toContain('openInboxEditor(item, event.currentTarget)');
    // 자라는 방향이 출처를 말한다.
    expect(styles).toMatch(
      /\.cal-modal\.anchored\.right \{[^}]*transform-origin: left center/,
    );
    expect(styles).toMatch(
      /\.cal-modal\.anchored\.left \{[^}]*transform-origin: right center/,
    );
  });

  // 월간도 같은 코드를 쓴다 — 앵커를 안 넘겨서 가운데로 떨어지고 있었다.
  it('월간 일정도 앵커를 넘긴다', () => {
    expect(calendarSource).toContain(
      'openEditor(start, block, event.currentTarget)',
    );
    expect(calendarSource).toContain(
      'openSuggestionEditor(suggestion, event.currentTarget)',
    );
  });

  // 배경을 어둡게 하면 어떤 일정을 눌렀는지 안 보여 옆에 붙인 의미가 없다.
  // 다만 클릭은 계속 받아 내야 아래 그리드가 잘못 반응하지 않는다.
  it('앵커 상태의 배경은 투명하되 클릭은 받아 낸다', () => {
    expect(styles).toMatch(
      /\.modal-backdrop\.anchored \{[^}]*background: transparent/,
    );
    expect(calendarSource).toContain(
      "className={`modal-backdrop${anchoredPlacement ? ' anchored' : ''}`}",
    );
  });

  // 전역 검색이 쓰는 값과 같다. 새 모션 언어를 만들지 않는다.
  it('모달이 전역 검색과 같은 등장 값을 쓴다', () => {
    for (const file of [source, calendarSource]) {
      // 캘린더는 앵커가 있을 때 옆에서 자라므로 가운데 값은 else 가지에 있다.
      expect(file).toContain('{ opacity: 0, scale: 0.99, y: -8 }');
      expect(file).toContain('{ opacity: 0, scale: 0.99, y: -6 }');
      expect(file).toContain('shouldReduceMotion');
    }
    // AnimatePresence가 조건문 안에 있으면 exit이 조용히 건너뛰어진다.
    expect(source).toMatch(/<AnimatePresence>\s*\n\s*\{editingInbox &&/);
    expect(calendarSource).toMatch(/<AnimatePresence>\s*\n\s*\{isEditorOpen &&/);
  });

  // 흐름에 두면 행이 500px 넘게 늘어나 아래 목록을 전부 밀어낸다.
  it('날짜 선택은 행을 늘리지 않고 위에 뜬다', () => {
    // `[^}]*`로 규칙 블록 안에 가둔다. `[\s\S]*?`는 블록 경계를 넘어가
    // 한참 뒤의 다른 규칙을 집는다.
    expect(styles).toMatch(
      /\.schedule-approve-picker\s*\{[^}]*position:\s*absolute/,
    );
    expect(styles).toMatch(/\.schedule-approve-picker\s*\{[^}]*z-index:\s*20/);
    expect(styles).not.toMatch(
      /\.schedule-approve-picker\s*\{[^}]*margin-top:\s*12px/,
    );
  });

  it('opens the picker for missing or invalid dates, but not valid timed items', () => {
    expect(requiresSchedulePicker(item())).toBe(false);
    expect(requiresSchedulePicker(item({ scheduled_at: 'invalid' }))).toBe(true);
    expect(requiresSchedulePicker(item({ time_text: null }))).toBe(true);
  });

  it('shows dated candidates on the calendar and keeps undated candidates in the inbox', () => {
    const timed = item({ id: 'timed' });
    const dateOnly = item({ all_day: true, id: 'date-only', time_text: null });
    const undated = item({ id: 'undated', scheduled_at: 'invalid', time_text: null });
    const partitioned = partitionScheduleInbox([timed, dateOnly, undated]);

    expect(hasScheduledDate(timed)).toBe(true);
    expect(partitioned.calendarSuggestions.map(candidate => candidate.id)).toEqual([
      'timed',
      'date-only',
    ]);
    expect(partitioned.inboxItems.map(candidate => candidate.id)).toEqual([
      'undated',
    ]);
    expect(appSource).toContain('inboxItems={incompleteScheduleInbox}');
    expect(appSource).toContain(
      'scheduleSuggestions={calendarScheduleSuggestions}',
    );
  });

  it('keeps unsynced local candidates visible beside the server list', () => {
    const remote = item({ id: 'remote' });
    const pendingLocal = { ...item({ id: 'local-pending' }), local_sync_status: 'pending' as const };
    const syncedLocal = { ...item({ id: 'local-synced' }), local_sync_status: 'synced' as const };

    expect(
      mergePendingScheduleInbox([remote], [pendingLocal, syncedLocal]).map(
        candidate => candidate.id,
      ),
    ).toEqual(['remote', 'local-pending']);
  });

  it('분 입력을 30분 단위로 제한하지 않는다', () => {
    // 스냅은 드래그에만 적용하고, 명시적으로 입력한 시각은 그대로 저장한다.
    expect(calendarSource).not.toContain('minuteStep');
    expect(source).not.toContain('minuteStep');
  });

  it('renders calendar suggestions as dashed ghosts with an edit-before-register flow', () => {
    expect(calendarSource).toContain('cal-suggestion-event');
    expect(calendarSource).toContain('시간 미정');
    expect(calendarSource).toContain("'일정 제안'");
    // 삭제는 헤더의 아이콘 버튼이 아니라 저장 반대편의 조용한 글자 버튼이다.
    expect(calendarSource).toContain('className="cal-modal-delete-text"');
    expect(calendarSource).toContain('className="cal-btn primary"');
    expect(styles).toMatch(
      /\.cal-suggestion-event\s*\{[\s\S]*?border:\s*1px dashed/,
    );
    expect(styles).toMatch(
      /\.cal-suggestion-event:hover \.cal-suggestion-cta[\s\S]*?opacity:\s*1/,
    );
  });

  it('prevents overlapping drops instead of rendering them in adjacent lanes', () => {
    expect(calendarSource).toContain('findAvailableDropStart(');
    expect(calendarSource).toContain("'빈 시간이 없습니다'");
    expect(calendarSource).toContain("'겹치는 일정이 있어 이동하지 않습니다'");
    expect(calendarSource).toContain('stackRowHeight');
    expect(calendarSource).toContain('Math.max(1, stackRowHeight - 1)');
    expect(calendarSource).toContain("width: 'calc(100% - 4px)'");
    expect(styles).toMatch(/\.cal-schedule-drop-preview\.unavailable\s*\{/);
  });

  it('shows compact month items and collapses overflow into a date selection', () => {
    expect(calendarSource).toContain('MONTH_MAX_VISIBLE_ITEM_LIMIT');
    expect(calendarSource).toContain('ResizeObserver');
    expect(calendarSource).toContain('cal-month-item');
    expect(calendarSource).toContain('cal-month-suggestion');
    expect(calendarSource).toContain('cal-month-more');
    expect(calendarSource).toContain('+{hiddenCount}개');
    expect(calendarSource).toMatch(
      /cal-month-meta[\s\S]*?cal-month-more[\s\S]*?cal-daynum/,
    );
    expect(calendarSource).toMatch(
      /className="cal-month-more"[\s\S]*?selectDay\(date\)/,
    );
    expect(calendarSource).toContain('title={block.title}');
    expect(styles).toMatch(
      /@container cal-month-cell \(max-width: 132px\)[\s\S]*?\.cal-month-item-time\s*\{[\s\S]*?display: none;/,
    );
    expect(styles).toMatch(/\.cal-month-items\s*\{/);
    expect(appSource).not.toContain('calendarSample(');
    expect(appSource).not.toContain('SAMPLE_CALENDAR_BLOCK_PREFIX');
  });

  it('keeps the monthly todo summary while opening its detail as an overlay', () => {
    expect(calendarSource).toContain('const [isMonthTodoOverlayOpen');
    expect(calendarSource).toContain('className="cal-month-todo-overlay"');
    expect(calendarSource).toContain('key="month-todo-overlay"');
    expect(calendarSource).toContain("aria-label={`${format(selectedDay, 'M월 d일')} 할 일 상세`}");
    expect(calendarSource).toContain('onToggleDetail={() => setMonthTodoOverlayOpen(false)}');
    expect(calendarSource).toContain("if (event.key === 'Escape')");
    expect(styles).toMatch(
      /\.cal-month-todo-overlay\s*\{[\s\S]*?bottom:\s*calc\(clamp\(180px, 24%, 220px\) \+ 12px\)[\s\S]*?position:\s*absolute[\s\S]*?z-index:\s*12/,
    );
    expect(styles).toMatch(
      /\.cal-month-todo-overlay \.cal-todo-panel\s*\{[\s\S]*?padding:\s*14px/,
    );
  });

  it('opens from the calendar icon in the global right-side slot', () => {
    expect(calendarSource).toContain('cal-inbox-button');
    expect(appSource).toContain('app-side-panel-slot');
    expect(appSource).toContain('schedule-inbox-panel');
    expect(appSource).not.toContain('aria-label="일정 inbox"');
  });

  it('previews both inbox placement and calendar moves as a green drop block', () => {
    expect(calendarSource).toContain('cal-schedule-drop-preview');
    expect(calendarSource).toContain('const draggedBlockRef = useRef<CalendarBlockRow | null>(null);');
    expect(calendarSource).toContain('setCalendarDropPreview({');
    expect(calendarSource).toContain('durationMs,');
    expect(calendarSource).toContain('formatPreviewDuration(calendarDropPreview.durationMs)');
    expect(calendarSource).toContain('drop-target${calendarDropPreview.isAvailable');
    expect(styles).toMatch(
      /\.cal-schedule-drop-preview\s*\{[\s\S]*?background:\s*rgba\(74, 153, 92, 0\.11\)[\s\S]*?border:\s*1px dashed rgba\(61, 139, 87, 0\.7\)/,
    );
    expect(styles).toMatch(
      /\.cal-day-col\.drop-target\s*\{[\s\S]*?rgba\(74, 153, 92, 0\.05\)/,
    );
    expect(styles).toMatch(
      /\.app-side-panel-slot\s*\{[\s\S]*?position:\s*fixed[\s\S]*?z-index:\s*45/,
    );
  });

  it('lets an all-day event become a timed event when dropped in the week grid', () => {
    expect(calendarSource).toMatch(
      /className=\{`cal-allday-event[\s\S]*?draggable[\s\S]*?onDragStart=\{event => startDrag\(event, block\)\}/,
    );
    expect(calendarSource).toMatch(
      /const dropOnColumn[\s\S]*?onSaveBlock\(\{[\s\S]*?allDay: false,[\s\S]*?endDate: new Date\(next\.getTime\(\) \+ durationMs\)\.toISOString\(\)/,
    );
  });

  it('removes an item after a calendar drop through the shared placement flow', () => {
    expect(appSource).toMatch(
      /const dropScheduleInboxItem[\s\S]*?placeScheduleInboxItem\(item, \{ allDay: false, startDate \}\)/,
    );
    expect(appSource).toMatch(
      /const placeScheduleInboxItem[\s\S]*?setScheduleInbox\(previous => previous\.filter\(inbox => inbox\.id !== item\.id\)\);[\s\S]*?const deleteScheduleInboxItem/,
    );
    expect(appSource).toMatch(
      /upsertLocalScheduleInboxAction[\s\S]*?removeLocalScheduleInboxItem[\s\S]*?setScheduleInbox[\s\S]*?updateScheduleInboxStatus/,
    );
    expect(appSource).toMatch(
      /const deleteScheduleInboxItem[\s\S]*?updateScheduleInboxStatus\(currentSession, item\.id, 'dismissed'\)/,
    );
  });
});
