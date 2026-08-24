'use client';

import MemoToCalendarScene from '../../components/scenes/MemoToCalendarScene';
import { CalendarWeekStrip } from '../../subnota-ui/Calendar';
import { PreviewPanel, ScheduleInboxPanel } from '../../subnota-ui/Panels';
import { DetailCta, DetailHero, DetailSection, FeatureCard, FeatureGrid, Piece } from '../detail';
import { useText } from '../../lib/i18n';

const SCHEDULED_WEEK_ROWS = [
  {
    blocks: [{
      at: 2,
      span: 1,
      sub: '15:00',
      title: '팀 미팅',
      tone: 'green' as const,
    }],
    date: '8.17',
    label: '월',
  },
  { blocks: [], date: '8.18', label: '화' },
  { blocks: [], date: '8.19', label: '수' },
];

const REPORT_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const MONTHLY_REPORT_ACTIVITY = [
  0, 0, 1, 0, 0, 0, 0,
  1, 0, 2, 0, 0, 1, 0,
  0, 3, 0, 2, 0, 0, 1,
  0, 0, 1, 0, 3, 0, 2,
  0, 1, 0, 1, 2, 1, 0,
];

export default function MemoToCalendarPage() {
  const text = useText();
  const scheduledWeekRows = SCHEDULED_WEEK_ROWS.map((row) => ({
    ...row,
    label: text(row.label, { 월: 'Mon', 화: 'Tue', 수: 'Wed' }[row.label] ?? row.label),
    blocks: row.blocks.map((block) => ({
      ...block,
      title: text(block.title, 'Team meeting'),
    })),
  }));
  const inboxWeekRows = scheduledWeekRows.map(({ date, label }) => ({
    blocks: [],
    date,
    label,
  }));

  return (
    <>
      <DetailHero
        chip={text('메모가 일정으로', 'Memo to calendar')}
        lead={text('약속은 대개 메모 안에서 먼저 생깁니다. Subnota는 문장 속 날짜를 찾아 바로 일정으로 제안하고, 애매한 약속은 일정 저장함에 남겨 둡니다. 캘린더에서 확인해도, 일정이 시작된 메모를 다시 열어도, 같은 맥락이 이어집니다.', 'Appointments usually begin inside a memo. Subnota finds dates in your sentences and suggests schedules, while ambiguous plans stay in the schedule inbox. Whether you check the calendar or reopen the memo where it began, the context stays connected.')}
        title={text('적은 순간, 일정이 됩니다', 'The moment you write it, it becomes a schedule')}
      />

      <DetailSection>
        <MemoToCalendarScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">{text('이런 것도 함께 합니다', 'Also included')}</p>
        <h2>{text('일정으로 가는 길이 여러 개입니다', 'There is more than one way to make a schedule')}</h2>

        <FeatureGrid tone="green">
        <FeatureCard
          body={text('월간 기록은 그날 쓴 메모와 완료한 일정을 함께 셉니다. 적은 날과 해낸 날이 한 화면에 쌓여, 이번 달의 흐름을 다시 볼 수 있습니다.', 'Monthly records count the memos you wrote and schedules you completed that day. Writing days and done days build up in one view so you can see this month’s flow again.')}
          title={text('적은 날과 해낸 날을 함께 봅니다', 'See writing days and done days together')}
        >
          <Piece width={360} y={-4}>
            <section aria-label={text('2026년 7월 월간 기록', 'July 2026 monthly record')} className="monthly-report-mock">
              <header className="monthly-report-mock-header">
                <span aria-hidden="true" className="monthly-report-mock-nav">‹</span>
                <strong>{text('2026년 7월', 'July 2026')}</strong>
                <span aria-hidden="true" className="monthly-report-mock-nav">›</span>
              </header>
              <div aria-hidden="true" className="monthly-report-mock-heatmap">
                {REPORT_WEEKDAYS.map((weekday) => (
                  <span className="monthly-report-mock-weekday" key={weekday}>{text(weekday, { 일: 'Sun', 월: 'Mon', 화: 'Tue', 수: 'Wed', 목: 'Thu', 금: 'Fri', 토: 'Sat' }[weekday] ?? weekday)}</span>
                ))}
                {MONTHLY_REPORT_ACTIVITY.map((level, index) => (
                  <span
                    className="monthly-report-mock-cell"
                    data-level={level}
                    key={index}
                  />
                ))}
              </div>
              <div className="monthly-report-mock-stats">
                <div>
                  <strong>14<span>{text('일', 'days')}</span></strong>
                    <p>{text('기록한 날', 'Writing days')}</p>
                </div>
                <div>
                  <strong>38<span>{text('개', 'memos')}</span></strong>
                    <p>{text('쌓인 메모', 'Memos written')}</p>
                </div>
                <div>
                  <strong>12<span>{text('개', 'done')}</span></strong>
                    <p>{text('해낸 일', 'Done')}</p>
                </div>
              </div>
            </section>
          </Piece>
        </FeatureCard>

        <FeatureCard
          body={text('날짜가 애매한 문장은 오른쪽 일정 저장함에 쌓입니다. 항목을 주간 캘린더의 시간 칸으로 끌어다 놓으면 그 자리에 초록 미리보기가 뜹니다. 놓는 순간이 곧 시각 결정입니다.', 'Sentences with unclear dates collect in the schedule inbox. Drag an item into a time slot in the weekly calendar and a green preview appears there. The moment you drop it is the moment the time is decided.')}
          title={text('일정 저장함과 끌어놓기', 'Schedule inbox and drag-and-drop')}
        >
          <Piece scale={0.86} width={590} y={-2}>
            <div className="calendar-schedule-flow">
              <CalendarWeekStrip
                badge={text('8월 3주차', 'Week 3 of August')}
              dropPreview={{ day: 2, at: 2, time: '3:00 – 4:00 PM', title: text('팀 미팅', 'Team meeting') }}
                hours={['14', '15', '16', '17']}
                rows={inboxWeekRows}
              />
              <ScheduleInboxPanel
                items={[
                  { dragging: true, id: 's1', meta: text('시간 미정', 'Time TBD'), text: text('팀 미팅 참석하기', 'Attend team meeting') },
                  { id: 's2', meta: text('8월 20일', 'Aug 20'), text: text('분기 보고서 초안 넘기기', 'Send quarterly report draft') },
                ]}
              />
            </div>
          </Piece>
        </FeatureCard>

        <FeatureCard
          body={text('일정을 누르면 그 일정이 생겨난 메모가 미리보기로 열립니다. 반대로 메모에서 일정을 새로 만들 수도 있습니다 — 두 방향이 다 열려 있어야 옮겨 적을 일이 없습니다.', 'Click a schedule to open a preview of the memo where it began. You can also create a schedule from a memo — both directions stay open, so there is nothing to retype.')}
          title={text('일정과 메모는 양방향입니다', 'Schedules and memos work both ways')}
        >
          <Piece scale={0.86} width={590} y={-2}>
            <div className="calendar-preview-flow">
              <CalendarWeekStrip
                badge={text('8월 3주차', 'Week 3 of August')}
                hours={['14', '15', '16', '17']}
                rows={scheduledWeekRows}
              />
              <PreviewPanel
                body={text('회의 전에 확인할 질문 세 가지를 정리해 둔다.', 'Three questions to check before the meeting.')}
                metadata={text('원본 메모', 'Original memo')}
                title={text('팀 회의 준비', 'Team meeting prep')}
              />
            </div>
          </Piece>
        </FeatureCard>

        <FeatureCard
          body={text('선택한 날짜의 할 일은 캘린더 옆에 모입니다. 시간을 정한 일정과 아직 시간 없는 일까지 한 줄로 확인하고, 끝나는 대로 체크합니다.', 'Tasks for the selected day gather beside the calendar. See scheduled and untimed tasks in one list, then check them off as you finish.')}
          title={text('오늘 할 일, 바로 체크합니다', 'Check off today’s work as you go')}
        >
          <Piece rotate={-1} width={360}>
            <div className="calendar-todo-mock">
              <header className="calendar-todo-mock-head">
                <span className="calendar-todo-mock-date">{text('8월 12일 (수)', 'Aug 12 (Wed)')}</span>
              </header>
              <div className="calendar-todo-mock-list">
                {[
                  { completed: true, text: text('아침 운동하기', 'Morning workout'), time: text('오전 7:00', '7:00 AM') },
                  { text: text('점심 약속 장소 예약하기', 'Book a place for lunch'), time: text('오후 12:30', '12:30 PM') },
                  { text: text('저녁 장보기', 'Buy groceries for dinner') },
                ].map((item) => (
                  <div
                    className={
                      item.completed
                        ? 'calendar-todo-mock-item completed'
                        : 'calendar-todo-mock-item'
                    }
                    key={item.text}
                  >
                    <span className="calendar-todo-mock-check">
                      {item.completed ? '✓' : ''}
                    </span>
                    <span className="calendar-todo-mock-title">
                      {item.time && (
                        <span className="calendar-todo-mock-time">{item.time}</span>
                      )}
                      <span className="calendar-todo-mock-text">{item.text}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Piece>
        </FeatureCard>
        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
