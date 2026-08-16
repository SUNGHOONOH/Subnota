'use client';

import ConnectedMemoryScene from '../../components/scenes/ConnectedMemoryScene';
import { AmbientGhost } from '../../subnota-ui/EditorPane';
import { KnowledgeGraph, TopicFolders } from '../../subnota-ui/Graph';
import { PreviewPanel } from '../../subnota-ui/Panels';
import {
  DetailCta,
  DetailHero,
  DetailSection,
  FeatureCard,
  FeatureGrid,
  Piece,
} from '../detail';

const NEARBY_NODES = [
  { id: 'c', kind: 'center' as const, label: '지금 쓰는 문장', r: 13, x: 260, y: 150 },
  { id: 'n1', label: '회의 전에 적어 둘 것', r: 10, x: 116, y: 82 },
  { id: 'n2', label: '질문 목록 초안', r: 8, x: 130, y: 230 },
  { id: 'n3', label: '지난 회고', r: 7, x: 394, y: 92 },
  { id: 'n4', kind: 'inbox' as const, label: '저장한 링크', r: 8, x: 404, y: 222 },
];

const TOPIC_NODES = [
  { id: 'c', kind: 'center' as const, label: '회의와 준비', r: 15, x: 200, y: 150 },
  { id: 'a', label: '질문 정리', r: 10, x: 70, y: 72 },
  { id: 'b', label: '회고', r: 9, x: 82, y: 234 },
  { id: 'd', label: '읽을거리', r: 11, x: 386, y: 100 },
  { id: 'e', label: '여행 준비', r: 9, x: 420, y: 218 },
  { id: 'f', kind: 'inbox' as const, label: '저장한 링크', r: 8, x: 300, y: 258 },
];

export default function ConnectedMemoryPage() {
  return (
    <>
      <DetailHero
        chip="관련 기억"
        lead="적어 둔 것을 다시 만나게 하는 일은 정리가 아니라 마주침의 문제입니다. Subnota는 폴더를 만들라고 하지 않고, 지금 쓰는 문장 옆에 관련된 과거 문장을 조용히 놓아 둡니다."
        title="기록이 연결되고 다시 나타납니다"
      />

      <DetailSection
        body="문장을 쓰다 잠시 멈추면 관련된 과거 문장이 한 줄로 올라옵니다. 카드도 팝업도 아닌 한 줄이고, 앞에 붙는 “7일 전 ·” 은 이것이 제안이 아니라 참조라는 표시입니다. 누르면 그 문장이 있던 원본이 오른쪽 패널에서 열립니다 — 쓰던 탭은 그대로 둔 채로."
        label="대표 흐름"
        title="쓰는 도중에, 문장 단위로"
      >
        <ConnectedMemoryScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">이런 것도 함께 합니다</p>
        <h2>흐름이 쌓이면 전체 지도가 보입니다</h2>

        <FeatureGrid>
          <FeatureCard
            body="메모 전체가 아니라 문장이 단위입니다. 긴 메모 안에 묻힌 한 줄도 찾아옵니다 — 제목이 달라도, 폴더가 달라도."
            note="메모 단위 검색은 “이 메모가 관련 있다”까지만 말합니다. 문장 단위는 어디가 관련 있는지까지 말합니다."
            title="문장 단위 추천"
          >
            <Piece rotate={-1.5} width={430} y={-6}>
              <div className="piece-card">
                <p className="piece-line">다음 회의 전에 질문을 정리해야겠다.</p>
                <AmbientGhost
                  meta="7일 전 ·"
                  text="회의 질문은 시작 전에 이미 종이 위에 있어야 한다."
                />
                <p className="piece-line">지난번처럼 그 자리에서 떠올리면 늦는다.</p>
                <AmbientGhost meta="3주 전 ·" text="준비 문서가 회의를 절반으로 줄였다." />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="한 줄로 부족할 때, 지금 문장을 가운데 두고 가까운 메모들을 펼쳐 봅니다. 가까울수록 가운데에 붙고, 저장한 링크는 회청색으로 구분됩니다."
            title="주변 메모"
          >
            <Piece width={480}>
              <div className="piece-card piece-card-flush" style={{ height: 286 }}>
                <KnowledgeGraph centerId="c" nodes={NEARBY_NODES} />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="폴더를 만들지 않아도 비슷한 주제끼리 묶입니다. 사이드바를 폴더 모드로 바꾸면 그 묶음이 그대로 폴더가 됩니다 — 이름도 Subnota가 붙입니다."
            title="자동 토픽 분류"
          >
            <Piece rotate={-2} width={216} x={-98} y={12} z={2}>
              <div className="piece-rail">
                <TopicFolders
                  folders={[
                    { count: 6, label: '회의와 준비' },
                    { count: 4, label: '읽을거리' },
                    { count: 3, label: '여행' },
                  ]}
                  memos={['팀 회의 준비', '질문 목록 초안']}
                />
              </div>
            </Piece>
            <Piece rotate={2.5} width={228} x={118} y={-22}>
              <div className="piece-card">
                <span className="piece-label">Topics</span>
                <div className="topic-chip-row">
                  <span>회의와 준비</span>
                  <span>읽을거리</span>
                  <span>여행</span>
                  <span>회고</span>
                </div>
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="묶인 주제들이 서로 어떻게 이어져 있는지 한 화면에서 봅니다. 오래 안 열어 본 쪽이 어디인지도 여기서 드러납니다."
            title="Topics 지도"
          >
            <Piece width={480}>
              <div className="piece-card piece-card-flush" style={{ height: 286 }}>
                <KnowledgeGraph centerId="c" nodes={TOPIC_NODES} />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body="찾으러 가야 기억나는 것은 대개 영영 안 찾습니다. 그래서 Subnota는 검색창을 하나 더 주는 대신, 쓰고 있는 자리로 가져옵니다. 원본은 쓰던 탭을 빼앗지 않고 오른쪽 패널에서 열립니다."
            title="잊고 있던 것이 먼저 옵니다"
            wide
          >
            <Piece rotate={-1.5} width={330} x={-196} y={4}>
              <PreviewPanel
                body={
                  '회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다. 그 자리에서 떠올린 질문은 대체로 이미 나온 이야기의 반복이었다.'
                }
                highlight="회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다."
                metadata="7일 전 · 회의 메모"
                similarity="관련 84%"
                title="회의 전에 적어 둘 것"
              />
            </Piece>
            <Piece rotate={2} width={380} x={196} y={-12}>
              <div className="piece-card">
                <span className="piece-label">쓰던 화면은 그대로</span>
                <p className="piece-line">다음 회의 전에 질문을 정리해야겠다.</p>
                <AmbientGhost
                  hovered
                  meta="7일 전 ·"
                  text="회의 질문은 시작 전에 이미 종이 위에…"
                />
              </div>
            </Piece>
          </FeatureCard>
        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
