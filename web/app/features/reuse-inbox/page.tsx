'use client';

import ReuseInboxScene from '../../components/scenes/ReuseInboxScene';
import { INBOX_ITEMS } from '../../components/scenes/fixtures';
import { AmbientGhost } from '../../subnota-ui/EditorPane';
import { InboxCard } from '../../subnota-ui/Inbox';
import { MiniComposer } from '../../subnota-ui/Mini';
import { PreviewPanel } from '../../subnota-ui/Panels';
import { DetailCta, DetailHero, DetailSection, FeatureCard, FeatureGrid, Piece } from '../detail';

export default function ReuseInboxPage() {
  return (
    <>
      <DetailHero
        chip="수집과 재사용"
        lead="읽던 페이지에서 단축키를 누르면 그걸로 끝입니다. 폴더를 고르지도, 태그를 달지도, 나중에 정리하겠다고 다짐하지도 않습니다. 제목과 요약과 키워드는 저장한 뒤에 알아서 붙습니다."
        title="저장은 단축키 하나로 끝납니다"
      />

      <DetailSection
        body="브라우저를 떠나지 않고, 창을 하나 더 띄우지도 않고, 단축키 한 번이면 저장됩니다. 요약은 저장이 끝난 뒤에 조용히 따라붙습니다 — 기다릴 필요가 없다는 뜻입니다."
        label="대표 흐름"
        title="누르면 그걸로 끝"
      >
        <ReuseInboxScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">이런 것도 함께 합니다</p>
        <h2>아, 맞다. 그 링크도 필요할 때 알아서 꺼내 드릴게요</h2>

        <FeatureGrid>
        <FeatureCard
          body="브라우저를 떠나지 않고 단축키로 현재 페이지를 저장합니다. 링크를 직접 붙여넣는 길도 늘 열려 있습니다 — 두 방법 모두 로그인한 기기 안에 먼저 저장됩니다."
          note="현재 페이지 저장은 macOS에서 제공합니다. 링크 붙여넣기는 두 플랫폼 모두 같습니다."
          title="브라우저에서 바로"
        >
          <Piece rotate={-1.5} width={380} y={-4}>
            <MiniComposer
              recent={[
                { source: 'YouTube', text: '회의 전에 30분을 쓰면…' },
                { source: 'nngroup', text: '맥락 안에서 검색하기' },
              ]}
              status="현재 페이지를 저장했습니다."
              text=""
            />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body="영상은 길이와 썸네일이, 글은 본문 발췌가 카드 얼굴이 됩니다. 요약을 못 만들어도 저장은 성공입니다 — 나중에 다시 찾을 수만 있으면 됩니다."
          title="영상과 글, 같은 카드로"
        >
          <Piece rotate={-3} width={224} x={-124} y={16} z={1}>
            <InboxCard item={INBOX_ITEMS[0]} />
          </Piece>
          <Piece rotate={2.5} width={224} x={112} y={-18} z={2}>
            <InboxCard hovered item={INBOX_ITEMS[1]} />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body="카드를 누르면 요약 전문이 열립니다. 키워드는 어느 화면에서 보든 같은 중성 칩입니다 — 같은 데이터가 화면마다 다른 색이면 같은 것으로 보이지 않으니까요."
          title="요약과 키워드"
        >
          <Piece rotate={-1} width={360} y={-6}>
            <PreviewPanel
              body={
                '회의를 짧게 만드는 것보다, 회의 전에 무엇을 정리해 두는지가 더 큰 차이를 만든다.\n\n이 팀은 회의 전날 30분을 준비 문서에 쓰기로 했고, 그 결과 회의 시간이 절반으로 줄었다.'
              }
              highlight="회의 전날 30분을 준비 문서에 쓰기로 했고, 그 결과 회의 시간이 절반으로 줄었다."
              metadata="YouTube · 14:22"
              title="회의 전에 30분을 쓰면 회의가 절반이 된다"
            />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body="저장해 두고 잊는 것이 정상입니다. 그래서 찾으러 오라고 하지 않고, 관련된 문장을 쓰는 순간 저장한 링크 쪽에서 먼저 올라옵니다 — 메모와 똑같은 자격으로."
          title="잊어도 됩니다"
        >
          <Piece rotate={-1.5} width={420}>
            <div className="piece-card">
              <p className="piece-line">회의를 짧게 만드는 방법을 찾아보는 중이다.</p>
              <AmbientGhost
                hovered
                meta="저장한 링크 ·"
                text="회의 전에 30분을 쓰면 회의가 절반이 된다"
              />
              <p className="piece-line">준비 문서를 먼저 돌려 보자.</p>
            </div>
          </Piece>
        </FeatureCard>

        <FeatureCard
          body="같은 링크를 다시 저장하면 새 카드가 생기지 않고 원래 카드가 맨 위로 올라옵니다. 좋아요를 누른 카드는 마우스를 올리지 않아도 하트가 보입니다 — 상태는 동작과 달리 늘 보여야 하니까요."
          title="중복 없이, 상태는 보이게"
        >
          <Piece rotate={-2} width={224} x={-70} y={14}>
            <InboxCard item={{ ...INBOX_ITEMS[2], liked: true }} />
          </Piece>
          <Piece rotate={2} width={224} x={92} y={-14} z={2}>
            <InboxCard item={{ ...INBOX_ITEMS[0], liked: true }} />
          </Piece>
        </FeatureCard>
        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
