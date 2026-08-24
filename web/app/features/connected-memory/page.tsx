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
import { useText } from '../../lib/i18n';

const NEARBY_NODES = [
  { id: 'c', kind: 'center' as const, label: '지금 쓰는 문장', r: 15, x: 260, y: 150 },
  { id: 'n1', kind: 'memo' as const, label: '회의 준비', r: 10, x: 116, y: 74, similarity: 0.92 },
  { id: 'n2', kind: 'memo' as const, label: '질문 목록', r: 10, x: 104, y: 226, similarity: 0.82 },
  { id: 'n3', kind: 'memo' as const, label: '지난 회고', r: 10, x: 406, y: 84, similarity: 0.68 },
  { id: 'n4', kind: 'inbox' as const, label: '저장한 링크', r: 10, x: 404, y: 224, similarity: 0.57 },
  { id: 'n5', kind: 'memo' as const, label: '준비 문서', r: 8, x: 252, y: 54, similarity: 0.44, hideLabel: true },
];

// 실제 앱의 주변 메모는 선이 없는 유사도 맵이다. 중심에서의 거리와 원 크기가
// 유사도를 표현하고, 저장한 링크만 회청색으로 구분한다.
const NEARBY_EDGES: { from: string; to: string }[] = [];

const TOPIC_NODES = [
  // 레퍼런스의 색상 클러스터와 빈 공간은 유지하되, 랜딩 카드에 맞게 노드만 줄였다.
  { id: 'g0', kind: 'topic' as const, label: '', r: 12, x: 230, y: 63, color: '#32a844', hideLabel: true },
  { id: 'g1', kind: 'topic' as const, label: '', r: 7, x: 202, y: 39, color: '#32a844', hideLabel: true },
  { id: 'g2', kind: 'topic' as const, label: '', r: 8, x: 228, y: 28, color: '#32a844', hideLabel: true },
  { id: 'g3', kind: 'topic' as const, label: '', r: 7, x: 259, y: 42, color: '#32a844', hideLabel: true },
  { id: 'g4', kind: 'topic' as const, label: '', r: 7, x: 270, y: 77, color: '#32a844', hideLabel: true },
  { id: 'g5', kind: 'topic' as const, label: '', r: 6, x: 207, y: 72, color: '#32a844', hideLabel: true },
  { id: 'g6', kind: 'topic' as const, label: '', r: 6, x: 246, y: 88, color: '#32a844', hideLabel: true },
  { id: 'p0', kind: 'topic' as const, label: '', r: 12, x: 360, y: 105, color: '#8b5fbf', hideLabel: true },
  { id: 'p1', kind: 'topic' as const, label: '', r: 7, x: 330, y: 82, color: '#8b5fbf', hideLabel: true },
  { id: 'p2', kind: 'topic' as const, label: '', r: 7, x: 382, y: 73, color: '#8b5fbf', hideLabel: true },
  { id: 'p3', kind: 'topic' as const, label: '', r: 7, x: 405, y: 111, color: '#8b5fbf', hideLabel: true },
  { id: 'p4', kind: 'topic' as const, label: '', r: 6, x: 345, y: 132, color: '#8b5fbf', hideLabel: true },
  { id: 'p5', kind: 'topic' as const, label: '', r: 6, x: 392, y: 139, color: '#8b5fbf', hideLabel: true },
  { id: 'r0', kind: 'topic' as const, label: '', r: 12, x: 254, y: 159, color: '#dd2732', hideLabel: true },
  { id: 'r1', kind: 'topic' as const, label: '', r: 7, x: 218, y: 136, color: '#dd2732', hideLabel: true },
  { id: 'r2', kind: 'topic' as const, label: '', r: 7, x: 227, y: 178, color: '#dd2732', hideLabel: true },
  { id: 'r3', kind: 'topic' as const, label: '', r: 8, x: 278, y: 187, color: '#dd2732', hideLabel: true },
  { id: 'r4', kind: 'topic' as const, label: '', r: 6, x: 244, y: 205, color: '#dd2732', hideLabel: true },
  { id: 'r5', kind: 'topic' as const, label: '', r: 6, x: 294, y: 154, color: '#dd2732', hideLabel: true },
  { id: 'o0', kind: 'topic' as const, label: '', r: 12, x: 259, y: 235, color: '#fb7817', hideLabel: true },
  { id: 'o1', kind: 'topic' as const, label: '', r: 7, x: 222, y: 224, color: '#fb7817', hideLabel: true },
  { id: 'o2', kind: 'topic' as const, label: '', r: 7, x: 286, y: 221, color: '#fb7817', hideLabel: true },
  { id: 'o3', kind: 'topic' as const, label: '', r: 8, x: 259, y: 276, color: '#fb7817', hideLabel: true },
  { id: 'o4', kind: 'topic' as const, label: '', r: 6, x: 205, y: 251, color: '#fb7817', hideLabel: true },
  { id: 'o5', kind: 'topic' as const, label: '', r: 6, x: 300, y: 262, color: '#fb7817', hideLabel: true },
  { id: 'b0', kind: 'topic' as const, label: '', r: 11, x: 125, y: 236, color: '#2e7fba', hideLabel: true },
  { id: 'b1', kind: 'topic' as const, label: '', r: 7, x: 91, y: 214, color: '#2e7fba', hideLabel: true },
  { id: 'b2', kind: 'topic' as const, label: '', r: 8, x: 102, y: 268, color: '#2e7fba', hideLabel: true },
  { id: 'b3', kind: 'topic' as const, label: '', r: 6, x: 151, y: 211, color: '#2e7fba', hideLabel: true },
  { id: 'b4', kind: 'topic' as const, label: '', r: 6, x: 73, y: 250, color: '#2e7fba', hideLabel: true },
  { id: 'y0', kind: 'topic' as const, label: '', r: 12, x: 415, y: 230, color: '#b8c414', hideLabel: true },
  { id: 'y1', kind: 'topic' as const, label: '', r: 7, x: 383, y: 214, color: '#b8c414', hideLabel: true },
  { id: 'y2', kind: 'topic' as const, label: '', r: 7, x: 448, y: 208, color: '#b8c414', hideLabel: true },
  { id: 'y3', kind: 'topic' as const, label: '', r: 8, x: 432, y: 261, color: '#b8c414', hideLabel: true },
  { id: 'y4', kind: 'topic' as const, label: '', r: 6, x: 365, y: 244, color: '#b8c414', hideLabel: true },
  { id: 'y5', kind: 'topic' as const, label: '', r: 6, x: 464, y: 231, color: '#b8c414', hideLabel: true },
];

const TOPIC_EDGES = [
  { from: 'g0', to: 'g1' }, { from: 'g0', to: 'g2' }, { from: 'g0', to: 'g3' },
  { from: 'g0', to: 'g4' }, { from: 'g0', to: 'g5' }, { from: 'g3', to: 'g6' },
  { from: 'g1', to: 'g2' }, { from: 'g2', to: 'g3' }, { from: 'g4', to: 'g6' },
  { from: 'p0', to: 'p1' }, { from: 'p0', to: 'p2' }, { from: 'p0', to: 'p3' },
  { from: 'p0', to: 'p4' }, { from: 'p2', to: 'p5' }, { from: 'p1', to: 'p2' },
  { from: 'p2', to: 'p3' }, { from: 'p3', to: 'p5' },
  { from: 'r0', to: 'r1' }, { from: 'r0', to: 'r2' }, { from: 'r0', to: 'r3' },
  { from: 'r0', to: 'r5' }, { from: 'r1', to: 'r2' }, { from: 'r2', to: 'r3' },
  { from: 'r2', to: 'r4' }, { from: 'r3', to: 'r5' },
  { from: 'o0', to: 'o1' }, { from: 'o0', to: 'o2' }, { from: 'o0', to: 'o3' },
  { from: 'o0', to: 'o4' }, { from: 'o1', to: 'o2' }, { from: 'o2', to: 'o3' },
  { from: 'o3', to: 'o5' }, { from: 'o4', to: 'o5' },
  { from: 'b0', to: 'b1' }, { from: 'b0', to: 'b2' }, { from: 'b0', to: 'b3' },
  { from: 'b1', to: 'b4' }, { from: 'b1', to: 'b2' },
  { from: 'y0', to: 'y1' }, { from: 'y0', to: 'y2' }, { from: 'y0', to: 'y3' },
  { from: 'y0', to: 'y4' }, { from: 'y2', to: 'y5' }, { from: 'y1', to: 'y2' },
  { from: 'y2', to: 'y3' }, { from: 'y3', to: 'y4' },
  { from: 'g4', to: 'p1' }, { from: 'g6', to: 'r1' }, { from: 'p3', to: 'r5' },
  { from: 'p4', to: 'r1' }, { from: 'r3', to: 'o0' }, { from: 'r4', to: 'o1' },
  { from: 'r2', to: 'y1' }, { from: 'o2', to: 'y4' }, { from: 'b3', to: 'r2' },
];

export default function ConnectedMemoryPage() {
  const text = useText();
  const nearbyLabelsEn: Record<string, string> = {
    c: 'The sentence you are writing',
    n1: 'Meeting prep',
    n2: 'Question list',
    n3: 'Past review',
    n4: 'Saved link',
    n5: 'Prep document',
  };
  const nearbyNodes = NEARBY_NODES.map((node) => ({
    ...node,
    label: text(node.label, nearbyLabelsEn[node.id] ?? node.label),
  }));

  return (
    <>
      <DetailHero
        chip={text('기억의 연결', 'Connected memory')}
        lead={text(
          '적어 둔 것을 다시 만나게 하는 일은 정리가 아니라 마주침의 문제입니다. Subnota는 폴더를 만들라고 하지 않고, 지금 쓰는 문장 옆에 관련된 과거 문장을 조용히 놓아 둡니다. 문장 단위 추천은 필요한 한 줄을, 주변 메모와 Topics 지도는 그 문장이 놓인 맥락을 보여 줍니다.',
          'Finding what you wrote again is not an organizing problem. It is a meeting problem. Subnota does not ask you to build folders; it quietly places related past sentences beside the one you are writing. Sentence recommendations surface the line you need, while nearby memos and the Topics map show its context.',
        )}
        title={text('다시 찾지 않아도, 다시 만납니다', 'Meet your past thoughts again, without searching')}
      />

      <DetailSection>
        <ConnectedMemoryScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">{text('이런 것도 함께 합니다', 'Also included')}</p>
        <h2>{text('흐름이 쌓이면 전체가 보입니다', 'See the whole picture as your flow grows')}</h2>

        <FeatureGrid tone="blue">
          <FeatureCard
            body={text('메모 전체가 아니라 문장이 단위입니다. 긴 메모 안에 묻힌 한 줄도 찾아옵니다 — 제목이 달라도, 폴더가 달라도.', 'The sentence is the unit, not the whole memo. It finds the line buried in a long note, even when the title and folder are different.')}
            note={text('메모 단위 검색은 “이 메모가 관련 있다”까지만 말합니다. 문장 단위는 어디가 관련 있는지까지 말합니다.', 'Memo-level search can say “this memo is related.” Sentence-level recommendations show you exactly where.')}
            title={text('문장 단위 추천', 'Sentence-level recommendations')}
          >
            <Piece rotate={-1.5} width={430} y={-6}>
              <div className="piece-card">
                <p className="piece-line">{text('다음 회의 전에 질문을 정리해야겠다.', 'I should organize my questions before the next meeting.')}</p>
                <AmbientGhost
                  meta={text('7일 전 ·', '7 days ago ·')}
                  text={text('회의 질문은 시작 전에 이미 종이 위에 있어야 한다.', 'Meeting questions should already be on paper before it starts.')}
                />
                <p className="piece-line">{text('지난번처럼 그 자리에서 떠올리면 늦는다.', 'It will be too late if I think of them on the spot again.')}</p>
                <AmbientGhost meta={text('3주 전 ·', '3 weeks ago ·')} text={text('준비 문서가 회의를 절반으로 줄였다.', 'A prep document cut the meeting in half.')} />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body={text('지금 쓰는 문장과 가까운 메모를 메모 단위로 펼쳐 봅니다. 관련도가 높은 메모가 중심에 붙고, 저장한 링크는 회청색 노드로 구분됩니다.', 'Open memos related to the sentence you are writing. The closest ones gather around the center, while saved links are marked in blue-gray.')}
            title={text('주변 메모', 'Nearby memos')}
          >
            <Piece width={480}>
              <div className="topic-graph-piece" style={{ height: 286 }}>
                <KnowledgeGraph centerId="c" edges={NEARBY_EDGES} nodes={nearbyNodes} />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body={text('폴더를 만들지 않아도 비슷한 주제끼리 묶입니다. 사이드바를 폴더 모드로 바꾸면 그 묶음이 그대로 폴더가 됩니다 — 이름도 Subnota가 붙습니다.', 'Similar topics group themselves without folders. Switch the sidebar to folder mode and those groups become folders, complete with Subnota names.')}
            title={text('자동 토픽 분류', 'Automatic topic grouping')}
          >
            <Piece rotate={-2} width={216} x={-98} y={12} z={2}>
              <div className="piece-rail">
                <TopicFolders
                  folders={[
                    { count: 12, label: text('오늘의 생각', "Today's thoughts") },
                    { count: 8, label: text('팀 프로젝트', 'Team project') },
                    { count: 6, label: text('읽고 저장한 것', 'Read and saved') },
                    { count: 4, label: text('다음 주 준비', 'Next week prep') },
                  ]}
                  memos={[
                    { meta: text('오늘 · 회의 메모', 'Today · meeting memo'), title: text('회의 질문 정리', 'Meeting questions') },
                    { meta: text('어제 · 준비 기록', 'Yesterday · prep notes'), title: text('다음 주 발표 초안', 'Next week presentation draft') },
                    { meta: text('지난주 · 저장한 링크', 'Last week · saved link'), title: text('읽어볼 자료 모음', 'Reading list') },
                  ]}
                  openIndex={2}
                />
              </div>
            </Piece>
            <Piece rotate={2.5} width={228} x={118} y={-22}>
              <div className="piece-card">
                <span className="piece-label">Topics</span>
                <div className="topic-chip-row">
                  <span>{text('회의와 준비', 'Meetings and prep')}</span>
                  <span>{text('읽을거리', 'Reading')}</span>
                  <span>{text('여행', 'Travel')}</span>
                  <span>{text('회고', 'Reviews')}</span>
                </div>
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body={text('묶인 주제들이 서로 어떻게 이어져 있는지 한 화면에서 봅니다. 오래 안 열어 본 쪽이 어디인지도 여기서 드러납니다.', 'See how your grouped topics connect on one map. You can also spot what you have not opened in a while.')}
            title={text('Topics 지도', 'Topics map')}
          >
            <Piece width={480}>
              <div className="topic-graph-piece" style={{ height: 286 }}>
                <KnowledgeGraph centerId="g0" edges={TOPIC_EDGES} nodes={TOPIC_NODES} variant="topics" />
              </div>
            </Piece>
          </FeatureCard>

        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
