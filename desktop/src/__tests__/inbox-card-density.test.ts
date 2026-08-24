import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 링크 저장함 카드는 224px 안에 코랄 버튼 + 코랄 칩 + 빨강 하트 + 검정 알약이
// 함께 있어 색 계열만 넷이었다. 카드 전체를 열기 대상으로 삼아 버튼을 없애고,
// 칩을 웹 요약 패널과 같은 중성으로 맞춘 뒤의 상태를 고정한다.
const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const inboxSource = read('features/inbox/InboxWorkspace.tsx');
const detailSource = read('features/memo/components/SourceDetailPane.tsx');
const styles = read('styles/subnota-workspace.scss');

describe('링크 저장함 카드', () => {
  it('카드 전체가 열기 대상이라 "자세히" 버튼이 없다', () => {
    expect(inboxSource).toContain('className="inbox-card-open"');
    expect(inboxSource).not.toContain('자세히</Button>');
    expect(inboxSource).not.toContain('>자세히<');

    // 내용 위를 덮어야 클릭을 받는다. 좋아요·삭제는 그보다 위여야 한다.
    expect(styles).toMatch(
      /\.inbox-card-open\s*\{[\s\S]*?position:\s*absolute[\s\S]*?z-index:\s*1/,
    );
    expect(styles).toMatch(
      /\.inbox-card-actions\s*\{[\s\S]*?position:\s*absolute[\s\S]*?z-index:\s*2/,
    );
  });

  // 아이콘도 글자도 없는 오버레이라 이름이 없으면 "버튼"으로만 읽힌다.
  it('열기 버튼에 접근 가능한 이름이 있다', () => {
    expect(inboxSource).toMatch(
      /aria-label=\{`\$\{[\s\S]*?t\(\s*'자세히 보기',\s*'View details'\s*\)/,
    );
  });

  // Mantine은 첫 Card.Section에만 음수 margin을 걸어 썸네일을 카드 끝까지
  // 흘린다(`:first-child`). 오버레이를 앞에 두면 썸네일 위에 흰 여백이 생긴다.
  it('열기 버튼이 Card.Section보다 뒤에 온다', () => {
    expect(inboxSource.indexOf('<Card.Section>')).toBeLessThan(
      inboxSource.indexOf('className="inbox-card-open"'),
    );
  });

  // 삭제는 동작이라 숨겨도 되지만 좋아요는 상태다. 목록에서 좋아요한 항목을
  // 구분하려면 눌린 하트는 hover 없이도 보여야 한다.
  it('좋아요는 눌린 것만 hover 없이 보이고, 그때만 붉다', () => {
    expect(inboxSource).toContain(
      "item.liked ? 'inbox-like liked' : 'inbox-like'",
    );
    expect(styles).toMatch(
      /\.inbox-card-actions \.inbox-like\.liked\s*\{[\s\S]*?opacity:\s*1/,
    );
    // 마우스로 좋아요를 누르면 그 버튼에 포커스가 남는다. :focus-within이면
    // 커서가 카드를 벗어나도 버튼이 계속 떠 있다 — :focus-visible이라야 한다.
    expect(styles).toContain(
      '.inbox-workspace .inbox-card:has(:focus-visible) .inbox-card-actions > *',
    );
    expect(styles).not.toContain('.inbox-card:focus-within');
    expect(styles).toMatch(
      /\.inbox-like\.liked\s*\{[\s\S]*?color:\s*var\(--mantine-color-red-6\)/,
    );
    // 누르기 전에는 다른 아이콘과 같은 중성색이어야 구분이 생긴다.
    expect(styles).not.toMatch(
      /\.inbox-workspace \.inbox-like\s*\{\s*\n\s*color:\s*var\(--mantine-color-red-6\)/,
    );
  });

  // 같은 항목의 키워드가 격자에서는 코랄, 웹 요약 패널에서는 중성이었다.
  it('키워드 칩이 웹 요약 패널과 같은 중성 칩이다', () => {
    expect(inboxSource).toContain('variant="default"');
    expect(inboxSource).not.toContain('variant="light"');
    expect(detailSource).toContain('variant="default"');
  });

  // 대각선 그라디언트는 앱에서 여기 하나뿐이었다.
  it('빈 썸네일이 공용 자리표시자 회색을 쓴다', () => {
    expect(styles).toMatch(
      /\.inbox-thumbnail\.empty\s*\{[\s\S]*?background:\s*var\(--app-color-skeleton\)/,
    );
    expect(styles).not.toContain('linear-gradient(135deg, var(--app-color-border)');
  });

  // 슬롯을 고정하면 요약이나 키워드가 없는 항목이 카드 중간에 구멍을 남긴다.
  // 높이는 격자 정렬 때문에 고정하되, 남는 자리는 아래 여백으로 몰아 준다.
  it('고정 슬롯 대신 자연 흐름 + 키워드 하단 정렬을 쓴다', () => {
    expect(styles).toContain('--inbox-card-height: 298px;');
    expect(styles).toMatch(
      /\.inbox-card-keywords\s*\{[\s\S]*?margin-top:\s*auto/,
    );
    expect(styles).not.toMatch(/\.inbox-card-title\s*\{[\s\S]*?flex:\s*0 0 50px/);
    expect(styles).not.toMatch(/\.inbox-card-summary\s*\{[\s\S]*?flex:\s*0 0 34px/);
  });
});
