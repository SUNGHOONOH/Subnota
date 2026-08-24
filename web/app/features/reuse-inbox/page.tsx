'use client';

import ReuseInboxScene from '../../components/scenes/ReuseInboxScene';
import { INBOX_ITEMS } from '../../components/scenes/fixtures';
import { useText } from '../../lib/i18n';
import { AmbientGhost } from '../../subnota-ui/EditorPane';
import { InboxCard } from '../../subnota-ui/Inbox';
import { MiniComposer } from '../../subnota-ui/Mini';
import { PreviewPanel } from '../../subnota-ui/Panels';
import { DetailCta, DetailHero, DetailSection, FeatureCard, FeatureGrid, Piece } from '../detail';

export default function ReuseInboxPage() {
  const text = useText();
  const youtubeItem = {
    ...INBOX_ITEMS[1],
    excerpt: text(
      INBOX_ITEMS[1].excerpt ?? '',
      'A short record of a team that cut meeting time in half by preparing the day before.',
    ),
    keywords: ['Meetings', 'Prep', 'Team'],
    summary: text(
      INBOX_ITEMS[1].summary ?? '',
      'A team record about cutting meeting time in half with one prep document.',
    ),
    title: text(INBOX_ITEMS[1].title, 'How 30 minutes before the meeting cuts it in half'),
  };

  return (
    <>
      <DetailHero
        chip={text('일단 줍고, 다시 쓰기', 'Collect and reuse')}
        lead={text(
          '읽던 페이지를 닫거나 다른 창으로 옮길 필요가 없습니다. Quick Subnota로 현재 페이지를 저장하면 링크가 먼저 담기고, 제목·요약·키워드는 뒤따라옵니다. 나중에 관련된 문장을 쓸 때는 저장한 링크도 메모처럼 다시 올라옵니다.',
          'You do not need to close the page or move to another window. Save the page with Quick Subnota: the link is captured first, followed by its title, summary, and keywords. When you write something related later, the saved link surfaces again like a memo.',
        )}
        title={text('읽던 곳에서, 바로 담아 둡니다', 'Save it right where you are reading')}
      />

      <DetailSection>
        <ReuseInboxScene />
      </DetailSection>

      <section className="detail-section shell">
        <p className="detail-section-label">{text('이런 것도 함께 합니다', 'Also included')}</p>
        <h2>{text('아, 맞다. 그 링크도 필요할 때 알아서 꺼내 드릴게요', 'Oh, right. That link too, right when you need it')}</h2>

        <FeatureGrid tone="amber">
        <FeatureCard
          body={text('브라우저를 떠나지 않고 단축키로 현재 페이지를 저장합니다. 저장한 링크는 로그인한 기기 안에 먼저 담기고, 제목과 요약과 키워드가 뒤따라옵니다.', 'Save the current page with a shortcut without leaving the browser. The link lands on your signed-in device first, followed by its title, summary, and keywords.')}
          note={text('현재 페이지 저장은 macOS에서 제공합니다.', 'Saving the current page is available on macOS.')}
          title={text('브라우저에서 바로', 'Right from the browser')}
        >
          <Piece rotate={-1.5} width={380} y={-4}>
            <MiniComposer text="" />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body={text('공개 YouTube 영상을 저장하면 길이와 함께 핵심을 짧게 정리합니다. 영상 요약을 만들지 못해도 링크와 공개 정보는 남아, 다시 이어 볼 수 있습니다.', 'Save a public YouTube video and we keep a short summary of the essentials with its duration. Even when a summary is not available, the link and public details remain so you can pick it up again.')}
          title={text('YouTube 영상도, 핵심만 남깁니다', 'YouTube videos, reduced to the essentials')}
        >
          <Piece rotate={-1} width={224} y={-4}>
            <InboxCard hovered item={youtubeItem} />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body={text('카드를 누르면 요약 전문이 열립니다. 키워드는 어느 화면에서 보든 같은 중성 칩입니다 — 같은 데이터가 화면마다 다른 색이면 같은 것으로 보이지 않으니까요.', 'Open the full summary by selecting a card. Keywords use the same neutral chips everywhere — the same data should not look different just because the screen changed.')}
          title={text('요약과 키워드', 'Summaries and keywords')}
        >
          <Piece rotate={-1} width={360} y={-6}>
            <PreviewPanel
              body={
                text(
                  '회의를 짧게 만드는 것보다, 회의 전에 무엇을 정리해 두는지가 더 큰 차이를 만든다.\n\n이 팀은 회의 전날 30분을 준비 문서에 쓰기로 했고, 그 결과 회의 시간이 절반으로 줄었다.',
                  'What you prepare before a meeting matters more than trying to make the meeting shorter.\n\nThis team spent 30 minutes on a prep document the night before, and cut the meeting time in half.',
                )
              }
              highlight={text('회의 전날 30분을 준비 문서에 쓰기로 했고, 그 결과 회의 시간이 절반으로 줄었다.', 'This team spent 30 minutes on a prep document the night before, and cut the meeting time in half.')}
              metadata="YouTube · 14:22"
              title={text('회의 전에 30분을 쓰면 회의가 절반이 된다', 'How 30 minutes before the meeting cuts it in half')}
            />
          </Piece>
        </FeatureCard>

        <FeatureCard
          body={text('저장해 두고 잊는 것이 정상입니다. 그래서 찾으러 오라고 하지 않고, 관련된 문장을 쓰는 순간 저장한 링크 쪽에서 먼저 올라옵니다 — 메모와 똑같은 자격으로.', 'It is normal to save something and forget it. We do not ask you to go looking; when you write a related sentence, the saved link surfaces first — with the same standing as a memo.')}
          title={text('잊어도 됩니다', 'It is okay to forget')}
        >
          <Piece rotate={-1.5} width={420}>
            <div className="piece-card">
              <p className="piece-line">{text('회의를 짧게 만드는 방법을 찾아보는 중이다.', 'I am looking for ways to make meetings shorter.')}</p>
              <AmbientGhost
                hovered
                meta={text('저장한 링크 ·', 'Saved link ·')}
                text={text('회의 전에 30분을 쓰면 회의가 절반이 된다', 'How 30 minutes before the meeting cuts it in half')}
              />
              <p className="piece-line">{text('준비 문서를 먼저 돌려 보자.', 'Let’s circulate the prep document first.')}</p>
            </div>
          </Piece>
        </FeatureCard>

        </FeatureGrid>
      </section>

      <DetailCta />
    </>
  );
}
