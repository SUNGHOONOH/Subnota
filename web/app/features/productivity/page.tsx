'use client';

import ProductivityScene from '../../components/scenes/ProductivityScene';
import { MiniComposer } from '../../subnota-ui/Mini';
import { PreviewPanel } from '../../subnota-ui/Panels';
import { DetailCta, DetailHero, DetailSection, FeatureCard, FeatureGrid, Piece } from '../detail';
import { useText } from '../../lib/i18n';

const SHORTCUTS = [
  { keys: '⌥ Y', label: { en: 'Open and close Quick Subnota', ko: 'Quick Subnota 열고 닫기' } },
  { keys: '⌘ ⇧ F', label: { en: 'Global search', ko: '전체 검색' } },
  { keys: '⌘ T', label: { en: 'New tab', ko: '새 탭' } },
  { keys: '⌘ \\', label: { en: 'Split panel', ko: '패널 나누기' } },
  { keys: '⌘ 1 ~ 4', label: { en: 'Memo · Calendar · Link · Topics', ko: '메모 · 캘린더 · 링크 · Topics' } },
  { keys: '⌘ ⏎', label: { en: 'Open the source of a recommendation', ko: '추천 문장의 원본 열기' } },
];

export default function ProductivityPage() {
  const text = useText();

  return (
    <>
      <DetailHero
        chip={text('멈출 수 없는 작업', 'Unbroken workflow')}
        lead={text('메모를 쓰다 캘린더가 필요하고, 링크를 찾다 관련 자료가 필요해집니다. 필요한 화면은 새 탭으로 바로 옆에 열어 두세요. 창을 오가는 일은 작업이 아니니까요.', 'You need the calendar while writing a memo, and related material while looking for a link. Keep the screen you need right beside you in a new tab. Moving between windows is not the work.')}
        title={text('필요한 화면을 바로 옆에', 'Keep the screen you need right beside you')}
      />

      <DetailSection>
        <ProductivityScene />
      </DetailSection>

      <section className="detail-section shell productivity-details">
        <p className="detail-section-label">{text('이런 것도 함께 합니다', 'Also included')}</p>
        <h2>{text('한 창 안에서 끝냅니다', 'Finish the work in one window')}</h2>

        <FeatureGrid tone="clay">
          <FeatureCard
            body={text('지금 쓰는 문장과 비슷한 문장이 들어 있는 과거 메모를 오른쪽 패널에서 미리 보여 줍니다. 내용을 확인한 뒤 원문 메모도 바로 열어 볼 수 있습니다.', 'The right panel previews past memos with sentences similar to the one you are writing. Check the context, then open the original memo right away.')}
            className="feature-card-preview"
            title={text('미리보기 패널', 'Preview panel')}
          >
            <Piece rotate={-0.5} width={440} y={-5}>
              <div className="preview-piece-large">
                <PreviewPanel
                  body={text('회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다.\n\n다음부터는 전날 저녁에 세 개만 적어 두기로 한다.', 'Meeting questions should already be on paper before it starts.\n\nFrom now on, I will write down three the evening before.')}
                  highlight={text('회의 질문은 회의 시작 전에 이미 종이 위에 있어야 한다.', 'Meeting questions should already be on paper before it starts.')}
                  metadata={text('7일 전 · 회의 메모', '7 days ago · meeting memo')}
                  title={text('회의 전에 적어 둘 것', 'Write this down before the meeting')}
                />
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body={text('손을 키보드에서 떼지 않고 새 탭·검색·패널 나누기 같은 동작을 바로 실행할 수 있습니다. 자주 쓰는 키는 설정에서 원하는 조합으로 바꿔 두세요.', 'Open a new tab, search, or split a panel without taking your hands off the keyboard. Customize the shortcuts you use most in Settings.')}
            title={text('전역 단축키', 'Global shortcuts')}
          >
            <Piece rotate={-1.5} width={330} y={-6}>
              <div className="piece-card">
                <div className="shortcut-list">
                  {SHORTCUTS.map((shortcut) => (
                    <div className="shortcut-row" key={shortcut.keys}>
                      <span>{text(shortcut.label.ko, shortcut.label.en)}</span>
                      <kbd>{shortcut.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body={text('필요한 화면을 새 탭으로 열고, 탭을 눌러 다양한 기능들을 오가며 사용합니다. 작업하던 자리를 잃지 않으니 다시 찾는 데 시간을 쓰지 않아도 됩니다.', 'Open the screens you need in new tabs and move between them with a click. Your place stays put, so you do not waste time finding it again.')}
            title={text('탭 사이를 오갑니다', 'Move between tabs')}
          >
            <Piece rotate={-2} width={360} y={-10}>
              <div className="piece-card piece-card-flush">
                <div className="split-pane-header" style={{ paddingTop: 4 }}>
                  <div className="split-editor-tabs">
                    <span className="split-editor-tab">{text('팀 회의 준비', 'Team meeting prep')}</span>
                    <span className="split-editor-tab active">
                      <span className="split-tab-label">{text('주간 회고', 'Weekly review')}</span>
                    </span>
                    <span className="split-editor-tab">{text('읽을거리', 'Reading')}</span>
                  </div>
                </div>
                <p className="piece-line" style={{ padding: '10px 12px 4px' }}>
                  {text('이번 주에 놓친 것 세 가지.', 'Three things I missed this week.')}
                </p>
              </div>
            </Piece>
          </FeatureCard>

          <FeatureCard
            body={text('읽던 페이지를 저장하거나 짧은 메모를 남겨야 할 때, 현재 화면을 떠나지 않고 바로 열 수 있습니다. 생각이 지나가기 전에 주워 담고 다시 작업으로 돌아오세요.', 'Save the page you are reading or leave a quick memo without leaving your current screen. Catch the thought before it passes, then return to the work.')}
            title="Quick Subnota"
          >
            <Piece rotate={-1} width={380} y={0}>
              <MiniComposer
                recent={[{ source: 'subnota.com', text: text('주간 회고 준비 자료', 'Weekly review prep material') }]}
                text={text('회의 전에 확인할 것', 'Things to check before the meeting')}
              />
            </Piece>
          </FeatureCard>
        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
