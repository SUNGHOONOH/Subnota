'use client';

import ConnectedMemoryScene from '../../components/scenes/ConnectedMemoryScene';
import { AmbientGhost } from '../../subnota-ui/EditorPane';
import { KnowledgeGraph, TopicFolders } from '../../subnota-ui/Graph';
import {
  DetailCta,
  DetailHero,
  DetailSection,
  FeatureCard,
  FeatureGrid,
  Piece,
} from '../detail';

const NEARBY_NODES = [
  { id: 'c', kind: 'center' as const, label: '지금 쓰는 문장', r: 15, x: 260, y: 150, color: '#2f3b35' },
  { id: 'n1', kind: 'memo' as const, label: '회의 준비', r: 11, x: 116, y: 74, color: '#4c71b7' },
  { id: 'n2', kind: 'memo' as const, label: '질문 목록', r: 10, x: 104, y: 226, color: '#4c71b7' },
  { id: 'n3', kind: 'memo' as const, label: '지난 회고', r: 10, x: 406, y: 84, color: '#8b7b5a' },
  { id: 'n4', kind: 'inbox' as const, label: '저장한 링크', r: 10, x: 404, y: 224, color: '#6d7185' },
  { id: 'n5', kind: 'memo' as const, label: '준비 문서', r: 8, x: 252, y: 54, color: '#396f55', hideLabel: true },
  { id: 'n6', kind: 'memo' as const, label: '회의 기록', r: 8, x: 252, y: 252, color: '#396f55', hideLabel: true },
];

const NEARBY_EDGES = [
  { from: 'c', to: 'n1', color: '#b8c9e8' },
  { from: 'c', to: 'n2', color: '#b8c9e8' },
  { from: 'c', to: 'n3', color: '#d4c8b0' },
  { from: 'c', to: 'n4', color: '#c9cedb' },
  { from: 'c', to: 'n5', color: '#c3daca' },
  { from: 'c', to: 'n6', color: '#c3daca' },
  { from: 'n1', to: 'n5', color: '#c9d5ec' },
  { from: 'n2', to: 'n6', color: '#c9d5ec' },
  { from: 'n3', to: 'n5', color: '#ddd6ca' },
  { from: 'n4', to: 'n6', color: '#d7dbe4' },
];

const TOPIC_NODES = [
  { id: 'c', kind: 'center' as const, label: '회의와 준비', r: 17, x: 258, y: 150, color: '#396f55' },
  { id: 'q', kind: 'topic' as const, label: '질문 정리', r: 13, x: 100, y: 84, color: '#4c71b7' },
  { id: 'r', kind: 'topic' as const, label: '회고', r: 12, x: 112, y: 240, color: '#8b7b5a' },
  { id: 'd', kind: 'topic' as const, label: '읽을거리', r: 13, x: 410, y: 86, color: '#c56a4b' },
  { id: 't', kind: 'topic' as const, label: '여행 준비', r: 12, x: 414, y: 235, color: '#b38a23' },
  { id: 'm1', kind: 'memo' as const, label: '질문', r: 8, x: 170, y: 48, color: '#4c71b7', hideLabel: true },
  { id: 'm2', kind: 'memo' as const, label: '회의록', r: 8, x: 174, y: 118, color: '#4c71b7', hideLabel: true },
  { id: 'm3', kind: 'memo' as const, label: '회고', r: 8, x: 170, y: 220, color: '#8b7b5a', hideLabel: true },
  { id: 'm4', kind: 'memo' as const, label: '주간 기록', r: 8, x: 174, y: 282, color: '#8b7b5a', hideLabel: true },
  { id: 'm5', kind: 'memo' as const, label: '읽을거리', r: 8, x: 348, y: 48, color: '#c56a4b', hideLabel: true },
  { id: 'm6', kind: 'inbox' as const, label: '저장한 링크', r: 8, x: 352, y: 118, color: '#6d7185', hideLabel: true },
  { id: 'm7', kind: 'memo' as const, label: '여행 메모', r: 8, x: 350, y: 220, color: '#b38a23', hideLabel: true },
  { id: 'm8', kind: 'memo' as const, label: '가평 일정', r: 8, x: 346, y: 282, color: '#b38a23', hideLabel: true },
  { id: 'm9', kind: 'memo' as const, label: '준비 문서', r: 8, x: 258, y: 66, color: '#396f55', hideLabel: true },
  { id: 'm10', kind: 'memo' as const, label: '회의 체크', r: 8, x: 258, y: 242, color: '#396f55', hideLabel: true },
];

const TOPIC_EDGES = [
  { from: 'c', to: 'q', color: '#b8c9e8' },
  { from: 'c', to: 'r', color: '#d4c8b0' },
  { from: 'c', to: 'd', color: '#e4b9a9' },
  { from: 'c', to: 't', color: '#dfcf9b' },
  { from: 'q', to: 'm1', color: '#b8c9e8' },
  { from: 'q', to: 'm2', color: '#b8c9e8' },
  { from: 'r', to: 'm3', color: '#d4c8b0' },
  { from: 'r', to: 'm4', color: '#d4c8b0' },
  { from: 'd', to: 'm5', color: '#e4b9a9' },
  { from: 'd', to: 'm6', color: '#e4b9a9' },
  { from: 't', to: 'm7', color: '#dfcf9b' },
  { from: 't', to: 'm8', color: '#dfcf9b' },
  { from: 'c', to: 'm9', color: '#c3daca' },
  { from: 'c', to: 'm10', color: '#c3daca' },
  { from: 'q', to: 'm9', color: '#d1ddef' },
  { from: 'r', to: 'm10', color: '#d9d0bd' },
  { from: 'd', to: 'm9', color: '#ebcfc5' },
  { from: 't', to: 'm10', color: '#e8dbaa' },
];

export default function ConnectedMemoryPage() {
  return (
    <>
      <DetailHero
        chip="기억의 연결"
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

        <FeatureGrid tone="blue">
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
            body="지금 쓰는 문장과 가까운 메모를 메모 단위로 펼쳐 봅니다. 관련도가 높은 메모가 중심에 붙고, 저장한 링크는 회청색 노드로 구분됩니다."
            title="주변 메모"
          >
            <Piece width={480}>
              <div className="piece-card piece-card-flush" style={{ height: 286 }}>
                <KnowledgeGraph centerId="c" edges={NEARBY_EDGES} nodes={NEARBY_NODES} />
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
                    { count: 12, label: '오늘의 생각' },
                    { count: 8, label: '팀 프로젝트' },
                    { count: 6, label: '읽고 저장한 것' },
                    { count: 4, label: '다음 주 준비' },
                  ]}
                  memos={[
                    { meta: '오늘 · 회의 메모', title: '회의 질문 정리' },
                    { meta: '어제 · 준비 기록', title: '다음 주 발표 초안' },
                    { meta: '지난주 · 저장한 링크', title: '읽어볼 자료 모음' },
                  ]}
                  openIndex={2}
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
                <KnowledgeGraph centerId="c" edges={TOPIC_EDGES} nodes={TOPIC_NODES} />
              </div>
            </Piece>
          </FeatureCard>

        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
