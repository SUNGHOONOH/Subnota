'use client';

import ProductivityScene from '../../components/scenes/ProductivityScene';
import { CalendarWeekStrip } from '../../subnota-ui/Calendar';
import { MiniComposer } from '../../subnota-ui/Mini';
import { PreviewPanel } from '../../subnota-ui/Panels';
import { DetailCta, DetailHero, DetailSection, FeatureCard, FeatureGrid, Piece } from '../detail';

const SHORTCUTS = [
  { keys: '⌥ Y', label: 'Quick Subnota 열고 닫기' },
  { keys: '⌘ ⇧ F', label: '전체 검색' },
  { keys: '⌘ T', label: '새 탭' },
  { keys: '⌘ \\', label: '패널 나누기' },
  { keys: '⌘ 1 ~ 4', label: '메모 · 캘린더 · 링크 · Topics' },
  { keys: '⌘ ⏎', label: '추천 문장의 원본 열기' },
];

function TrafficLights() {
  return (
    <div aria-hidden="true" className="mock-traffic-lights">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function ProductivityPage() {
  return (
    <>
      <DetailHero
        chip="멈출 수 없는 작업"
        lead="메모를 쓰다 캘린더가 필요하고, 링크를 찾다 Topics가 필요해집니다. Subnota는 그때마다 다른 창을 찾게 하지 않습니다 — 필요한 화면을 같은 작업공간 옆에 바로 엽니다."
        title="흐름을 끊지 않고 더 많이 합니다"
      />

      <DetailSection
        body="노트, 링크 저장함, 캘린더, Topics를 새 탭으로 바로 엽니다. 필요한 화면만 옆에 두고, 창을 오가는 일은 작업이 아니니까요."
        label="대표 흐름"
        title="필요한 화면을 바로 옆에"
      >
        <ProductivityScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">이런 것도 함께 합니다</p>
        <h2>한 창 안에서 끝냅니다</h2>

        <FeatureGrid tone="clay">
          <FeatureCard
            body="메모와 캘린더를 같은 작업공간의 두 패널로 나란히 둡니다. 하나를 고치면 다른 하나가 바로 따라오고, 패널 사이를 오가는 동안에도 쓰던 흐름은 끊기지 않습니다."
            note="패널은 둘까지입니다. 셋으로 나눌 수 있게 만들면 어느 쪽도 제대로 읽을 수 없게 됩니다."
            title="스플릿 뷰"
            wide
          >
            <Piece rotate={-0.5} width={380} x={-200} y={0} z={2}>
              <div className="split-mock-panel">
                <TrafficLights />
                <div className="split-mock-panel-tabs">
                  <span className="active">주간 회고</span>
                  <span>읽을거리</span>
                </div>
                <span className="piece-label">노트</span>
                <p className="piece-line">이번 주에 놓친 것 세 가지.</p>
                <p className="piece-line">회의 준비를 전날로 옮겨 두자.</p>
              </div>
            </Piece>
            <Piece rotate={0.5} width={380} x={200} y={0}>
              <div className="split-mock-panel">
                <TrafficLights />
                <CalendarWeekStrip
                  badge="8월 3주차"
                  hours={['09', '13', '17']}
                  rows={[
                    {
                      blocks: [
                        { at: 2, span: 1, sub: '10:00', title: '스탠드업', tone: 'green' },
                      ],
                      date: '8.11',
                      label: '월',
                    },
                    {
                      blocks: [
                        { at: 2, span: 1, sub: '13:00', title: '디자인 리뷰', tone: 'blue' },
                      ],
                      date: '8.14',
                      label: '목',
                    },
                  ]}
                  title="이번주 블록"
                />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="참고할 것은 탭을 빼앗지 않고 오른쪽 패널에서 열립니다. 탭 줄이 없다는 것이 “이건 지금 보는 문서가 아니다”라는 표시입니다. Esc나 ✕ 로만 닫히고, 바깥을 눌러도 타이핑을 해도 닫히지 않습니다."
            title="미리보기 패널"
          >
            <Piece rotate={-0.5} width={440} y={-5}>
              <div className="preview-piece-large">
                <PreviewPanel
                  body={'회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다.\n\n다음부터는 전날 저녁에 세 개만 적어 두기로 한다.'}
                  metadata="7일 전 · 회의 메모"
                  title="회의 전에 적어 둘 것"
                />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="손을 키보드에서 떼지 않고 대부분을 합니다. 전부 설정에서 바꿀 수 있고, Windows에서는 각 자리에 맞는 키 이름으로 표시됩니다."
            title="전역 단축키"
          >
            <Piece rotate={-1.5} width={330} y={-6}>
              <div className="piece-card">
                <div className="shortcut-list">
                  {SHORTCUTS.map((shortcut) => (
                    <div className="shortcut-row" key={shortcut.keys}>
                      <span>{shortcut.label}</span>
                      <kbd>{shortcut.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="필요한 화면을 새 탭으로 열고, 탭을 눌러 노트·캘린더·링크 저장함·Topics 사이를 오갑니다. 각 화면이 자리를 지키니 다시 찾는 일은 한 번이면 충분합니다."
            title="탭 사이를 오갑니다"
          >
            <Piece rotate={-2} width={360} y={-10}>
              <div className="piece-card piece-card-flush">
                <div className="split-pane-header" style={{ paddingTop: 4 }}>
                  <div className="split-editor-tabs">
                    <span className="split-editor-tab">팀 회의 준비</span>
                    <span className="split-editor-tab active">
                      <span className="split-tab-label">주간 회고</span>
                    </span>
                    <span className="split-editor-tab">읽을거리</span>
                  </div>
                </div>
                <p className="piece-line" style={{ padding: '10px 12px 4px' }}>
                  이번 주에 놓친 것 세 가지.
                </p>
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="Quick Subnota는 메뉴 막대(Windows는 알림 영역)에서 바로 열립니다. 읽던 페이지를 저장하거나 짧은 메모를 남겨도 하던 화면은 그대로 남아 있습니다."
            title="Quick Subnota"
          >
            <Piece rotate={-1} width={380} y={0}>
              <MiniComposer
                recent={[{ source: 'subnota.com', text: '주간 회고 준비 자료' }]}
                text="회의 전에 확인할 것"
              />
            </Piece>
          </FeatureCard>
        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
