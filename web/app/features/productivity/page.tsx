'use client';

import ProductivityScene from '../../components/scenes/ProductivityScene';
import { AmbientGhost } from '../../subnota-ui/EditorPane';
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

export default function ProductivityPage() {
  return (
    <>
      <DetailHero
        chip="작업 흐름"
        lead="떠오른 생각을 적으려고 하던 일을 접는 순간, 그 생각의 절반은 이미 사라집니다. Subnota의 창과 단축키는 전부 그 접는 동작을 없애는 쪽으로 맞춰져 있습니다."
        title="흐름을 끊지 않고 더 많이 합니다"
      />

      <DetailSection
        body="단축키 하나로 작은 창이 뜹니다. 적고 저장하면 창은 사라지고 하던 화면이 그대로 남아 있습니다. 로그인도 네트워크도 필요 없습니다 — 기기 안에 먼저 저장되고, 나중에 조용히 맞춰집니다."
        label="대표 흐름"
        title="적는 데 드는 동작을 하나로"
      >
        <ProductivityScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">이런 것도 함께 합니다</p>
        <h2>한 창 안에서 끝냅니다</h2>

        <FeatureGrid>
          <FeatureCard
            body="메모와 캘린더를 나란히 둡니다. 다른 앱도, 다른 창도 아닙니다 — 같은 작업공간의 두 패널이라 하나를 고치면 다른 하나가 바로 따라옵니다."
            note="패널은 둘까지입니다. 셋으로 나눌 수 있게 만들면 어느 쪽도 제대로 읽을 수 없게 됩니다."
            title="스플릿 뷰"
            wide
          >
            <Piece rotate={-1.5} width={330} x={-196} y={6} z={2}>
              <div className="piece-card">
                <span className="piece-label">주간 회고</span>
                <p className="piece-line">이번 주에 놓친 것 세 가지.</p>
                <p className="piece-line">하나, 회의 준비를 전날로 못 옮겼다.</p>
                <p className="piece-line">둘, 저장만 하고 다시 안 읽은 링크가 늘었다.</p>
              </div>
            </Piece>
            <Piece rotate={2} width={420} x={190} y={-8}>
              <CalendarWeekStrip
                badge="8월 3주차"
                hours={['04', '08', '12', '16', '20']}
                rows={[
                  {
                    blocks: [
                      { at: 3, span: 1, sub: '10:00', title: '스탠드업', tone: 'green' },
                    ],
                    date: '8.11',
                    label: '월',
                  },
                  {
                    blocks: [
                      { at: 4, span: 1, sub: '13:00', title: '디자인 리뷰', tone: 'blue' },
                    ],
                    date: '8.14',
                    label: '목',
                  },
                ]}
                title="이번주 블록"
              />
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="참고할 것은 탭을 빼앗지 않고 오른쪽 패널에서 열립니다. 탭 줄이 없다는 것이 “이건 지금 보는 문서가 아니다”라는 표시입니다. Esc나 ✕ 로만 닫히고, 바깥을 눌러도 타이핑을 해도 닫히지 않습니다."
            title="미리보기 패널"
          >
            <Piece rotate={-1} width={340} y={-4}>
              <PreviewPanel
                body={'회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다.\n\n다음부터는 전날 저녁에 세 개만 적어 두기로 한다.'}
                metadata="7일 전 · 회의 메모"
                title="회의 전에 적어 둘 것"
              />
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
            body="탭은 좁아져도 한 줄을 지키고, 사이드바를 접으면 작업공간이 창 끝까지 채워집니다. 왼쪽 가장자리에 마우스를 대면 네비게이션만 잠깐 떠올랐다 사라집니다."
            title="탭과 패널"
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
            body="메뉴 막대(Windows는 알림 영역)에서 바로 열립니다. 창을 찾을 필요도, 앱을 앞으로 가져올 필요도 없습니다. 적고 저장하면 하던 화면이 그대로 남아 있습니다."
            title="어디서든 같은 자리"
            wide
          >
            <Piece rotate={-1.5} width={380} x={-176} y={4} z={2}>
              <MiniComposer caret text="검색 결과를 목록 말고 문장 옆에 놓아 보기" />
            </Piece>
            <Piece rotate={2} width={360} x={200} y={-6}>
              <div className="piece-card">
                <span className="piece-label">돌아오면 그대로</span>
                <p className="piece-line">이번 주에 놓친 것 세 가지.</p>
                <AmbientGhost meta="방금 ·" text="검색 결과를 목록 말고 문장 옆에 놓아 보기" />
              </div>
            </Piece>
          </FeatureCard>
        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
