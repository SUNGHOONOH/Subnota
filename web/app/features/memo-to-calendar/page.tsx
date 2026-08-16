'use client';

import MemoToCalendarScene from '../../components/scenes/MemoToCalendarScene';
import { MONTH_CELLS_PLACED } from '../../components/scenes/fixtures';
import { CalendarMonth } from '../../subnota-ui/Calendar';
import { ScheduleInboxPanel } from '../../subnota-ui/Panels';
import { DateSchedulePopover, ScheduleConfirmBar } from '../../subnota-ui/Schedule';
import { DetailCta, DetailHero, DetailSection, FeatureCard, FeatureGrid, Piece } from '../detail';

export default function MemoToCalendarPage() {
  return (
    <>
      <DetailHero
        chip="메모 → 일정"
        lead="약속은 대개 메모 안에서 먼저 생깁니다. 그런데 캘린더로 옮기는 일은 늘 나중으로 밀리고, 그러다 잊힙니다. Subnota는 그 사이의 한 번 더 여는 동작을 없앱니다."
        title="메모가 바로 일정으로 이어집니다"
      />

      <DetailSection
        body="문장 속 “내일 오후 3시”를 알아보고, 확인 한 번이면 캘린더에 앉습니다. 자동으로 저장하지 않는 이유는 분명합니다 — 적어 둔 모든 날짜가 약속은 아니기 때문입니다. 등록된 일정은 원본 메모와 이어져 있어 나중에 왜 잡았는지 되짚을 수 있습니다."
        label="대표 흐름"
        title="문장 속 날짜가 일정이 됩니다"
      >
        <MemoToCalendarScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">이런 것도 함께 합니다</p>
        <h2>일정으로 가는 길이 여러 개입니다</h2>

        <FeatureGrid>
        <FeatureCard
          body="감지된 날짜는 바로 저장되지 않고 한 줄짜리 확인 바로 먼저 뜹니다. 날짜 칩을 누르면 그 자리에서 다른 날로 바꿀 수 있습니다."
          note="문장을 직접 선택해서 등록할 수도 있습니다 — 날짜 표현이 없는 문장이라도."
          title="등록 전 확인 한 줄"
        >
          <Piece rotate={-2} width={260} x={-84} y={-74} z={2}>
            <ScheduleConfirmBar label="2026.08.16 15:00" />
          </Piece>
          <Piece rotate={2} width={228} x={64} y={30}>
            <DateSchedulePopover
              daysInMonth={31}
              firstWeekday={6}
              meridiem="PM"
              month={8}
              selectedDay={16}
              time="3:00"
              todayDay={15}
              year={2026}
            />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body="날짜가 애매한 문장은 버려지지 않고 저장함에 쌓입니다. 나중에 한꺼번에 훑고, 주간 캘린더로 끌어다 놓으면 그 자리에 초록 미리보기가 뜹니다 — 놓는 순간이 곧 시각 결정입니다."
          title="일정 저장함과 끌어놓기"
        >
          <Piece rotate={-1.5} width={250} x={-96} y={-8} z={2}>
            <ScheduleInboxPanel
              items={[
                { dragging: true, id: 's1', meta: '시간 미정', text: '팀 미팅 참석하기' },
                { id: 's2', meta: '8월 20일', text: '분기 보고서 초안 넘기기' },
                { id: 's3', meta: '시간 미정', text: '가평 펜션 예약 확인' },
              ]}
            />
          </Piece>
          <Piece rotate={2} width={230} x={124} y={22}>
            <div className="piece-card piece-drop">
              <span className="piece-label">주간 캘린더에 놓는 순간</span>
              <div className="cal-schedule-drop-preview piece-drop-preview">
                <strong>팀 미팅</strong>
                <span>오후 3:00 – 4:00</span>
              </div>
            </div>
          </Piece>
        </FeatureCard>

        <FeatureCard
          body="일정을 누르면 그 일정이 생겨난 메모가 미리보기로 열립니다. 반대로 메모에서 일정을 새로 만들 수도 있습니다 — 두 방향이 다 열려 있어야 옮겨 적을 일이 없습니다."
          title="일정과 메모는 양방향입니다"
        >
          <Piece width={430} y={-8}>
            <CalendarMonth badge="8월" cells={MONTH_CELLS_PLACED} title="2026년 8월" />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body="하루치 할 일은 캘린더 옆 목록에서 체크합니다. 완료한 항목은 흐려지고, 그날의 기록으로 남습니다."
          title="그날의 할 일"
        >
          <Piece rotate={-1} width={320}>
            <div className="piece-card">
              <span className="piece-label">8월 15일 금요일</span>
              <div className="schedule-approve-list" style={{ gap: 6, padding: 0 }}>
                {[
                  { meta: '오전 10:00', text: '주간 스탠드업' },
                  { meta: '오후 1:00', text: '디자인 리뷰 문서 읽기' },
                  { meta: '시간 미정', text: '분기 보고서 초안' },
                ].map((item) => (
                  <div className="schedule-approve-row" key={item.text}>
                    <span className="schedule-approve-meta">{item.meta}</span>
                    <span className="schedule-approve-text">{item.text}</span>
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
