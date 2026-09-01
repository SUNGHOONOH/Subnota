import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const characters = read('features/auth/AuthCharacters.tsx');
const screen = read('features/auth/AuthScreen.tsx');
const styles = read('styles/subnota-workspace.scss');

describe('로그인 꽃밭 심기', () => {
  // 뿌리는 언제나 땅이고 누른 높이가 곧 키다. 클릭 지점에 꽃을 통째로
  // 띄우면 공중에 뜬 꽃이 된다.
  it('클릭 높이가 꽃의 키가 된다', () => {
    expect(characters).toContain('const plantFlower = (x: number, y: number)');
    // 뿌리는 클릭 지점이 아니라 언제나 땅이다.
    expect(characters).toContain(
      'const baseY = STAGE_HEIGHT - 8 - Math.random() * 14;',
    );
    expect(characters).toMatch(/fullHeight:\s*Math\.min\([\s\S]*?baseY - y/);
  });

  // 심은 꽃이 위로 길게 자라므로 무대가 더 높아야 잘리지 않는다.
  it('무대 높이가 자란 꽃을 담는다', () => {
    expect(characters).toContain('const STAGE_HEIGHT = 500;');
    expect(characters).toContain('const PLANTED_MAX_HEIGHT = 430;');
  });

  // 배경은 눌러볼 생각이 안 드는 표면이라 커서가 유일한 신호다.
  it('꽃밭 캔버스가 누를 수 있음을 커서로 알린다', () => {
    expect(styles).toMatch(
      /\.auth-character-stage\s*\{[\s\S]*?canvas\s*\{\s*cursor:\s*pointer/,
    );
  });

  // 심는 것은 모션이 아니라 상호작용이라 모션을 줄여도 남긴다.
  it('모션을 줄여도 심을 수 있다', () => {
    expect(characters).toMatch(
      /if \(prefersReducedMotion\) \{\s*\n\s*planted\.bloom = 1;\s*\n\s*renderFrame\(0\);/,
    );
  });

  // 봉오리 → 꽃은 실제 물망초의 색 변화다. 키·잎 각도·색을 bloom 하나로
  // 함께 움직여야 "피어난다"가 한 동작으로 읽힌다.
  it('분홍 봉오리에서 파란 꽃으로 한 값이 함께 움직인다', () => {
    expect(characters).toContain("const BUD_COLOR = '#c98aa8';");
    expect(characters).toContain(
      'mixHex(BUD_COLOR, flower.petalColor, flower.bloom)',
    );
    expect(characters).toContain('lerp(0.42, 1, flower.bloom)');
    expect(characters).toContain('lerp(34, 0, flower.bloom)');
  });
});

describe('로그인 화면 구성', () => {
  // 한 화면에 브랜드는 한 번. 왼쪽 패널과 오른쪽 카드가 각각 마크를 들면
  // 브랜드가 두 번 나온다.
  it('로고 락업이 로그인 카드에만 있다', () => {
    expect(screen).toContain('className="desktop-auth-brand"');
    expect(screen).toContain('<SubnotaMark size={34} />');
    expect(screen).not.toContain('auth-character-logo');
    expect(screen).not.toContain('brand-mark-logo');
    // 왼쪽 패널은 꽃밭만 담는다.
    expect(screen).toMatch(
      /<aside className="auth-character-panel">\s*\n\s*<div className="auth-character-stage">/,
    );
  });

  it('하단 태그라인을 뺐다', () => {
    expect(screen).not.toContain('생각의 결을 잇는 메모');
    expect(styles).not.toContain('.auth-character-tagline');
  });

  // 24px / 12px로 갈려 있어 나란한 두 면이 같은 급으로 안 읽혔다.
  it('두 카드의 곡률과 높이가 같다', () => {
    expect(styles).toMatch(
      /\.desktop-auth-card\s*\{[\s\S]*?border-radius:\s*18px/,
    );
    expect(styles).toMatch(
      /\.auth-character-panel\s*\{[\s\S]*?border-radius:\s*18px/,
    );
    // stretch로 꽃밭이 높이를 정하고 로그인 카드가 따라간다.
    expect(styles).toMatch(
      /\.desktop-auth-columns\s*\{[\s\S]*?align-items:\s*stretch/,
    );
    expect(styles).toMatch(/\.desktop-auth-card\s*\{[\s\S]*?flex:\s*1/);
  });

  // 브랜드색을 파랑으로 바꾸면 이 바탕까지 파래져 파란 꽃과 대비가 사라진다.
  it('꽃밭 바탕이 브랜드색을 따라가지 않는다', () => {
    expect(styles).toContain('rgba(204, 73, 41, 0.16)');
    // 실제 사용 형태로 확인한다 — 블록 단위로 자르면 설명 주석까지 걸린다.
    expect(styles).not.toContain('rgba(var(--app-color-brand-rgb), 0.16)');
  });

  // 회원가입은 비밀번호 확인·강도 막대가 더 붙어 폼이 길다. 꽃밭 높이를
  // 고정하면 그때 로그인 카드만 아래로 넘쳐 아랫변이 어긋난다.
  // flex gap은 높이가 0이어도 남는다. 요소가 사라지는 순간 간격만 툭 없어져
  // 애니메이션 끝에서 한 번 튄다.
  it('접히는 영역이 간격까지 함께 접힌다', () => {
    expect(screen).toContain('const Collapsible = ({');
    expect(screen).toContain('animate={{ height: \'auto\', marginTop: gap, opacity: 1 }}');
    expect(screen).toMatch(/exit=\{\{\s*\n\s*height: 0,\s*\n\s*marginTop: 0,/);

    // 간격이 gap이 아니라 margin이어야 위 애니메이션이 의미가 있다.
    expect(styles).toMatch(/\.auth-minimal-form\s*\{[^}]*gap:\s*0/);
    expect(styles).toMatch(
      /\.auth-minimal-form > \* \+ \*\s*\{[^}]*margin-top:\s*13px/,
    );
  });

  // docs/design.md의 모션 규약.
  it('전환이 공용 스프링과 reduced-motion을 따른다', () => {
    expect(screen).toContain("{ type: 'spring', duration: 0.3, bounce: 0 }");
    expect(screen).toContain('const shouldReduceMotion = useReducedMotion();');
    // AnimatePresence가 조건문 안에 있으면 exit이 조용히 건너뛰어진다.
    expect(screen).toMatch(
      /<AnimatePresence initial=\{false\}>\s*\n\s*\{isOpen && \(/,
    );
  });

  it('꽃밭이 폼 길이를 따라 늘어난다', () => {
    expect(styles).toMatch(
      /\.auth-character-panel\s*\{[\s\S]*?min-height:\s*600px/,
    );
    expect(styles).not.toMatch(
      /\.auth-character-panel\s*\{[\s\S]*?\n\s{4}height:\s*600px/,
    );
  });

  it('Windows의 작은 작업 영역에서는 폼을 자르지 않고 스크롤한다', () => {
    expect(styles).toMatch(
      /html\[data-desktop-platform='windows'\] \.desktop-auth-container\.two-col\s*\{[\s\S]*?overflow-y:\s*auto/,
    );
    expect(styles).toMatch(
      /html\[data-desktop-platform='windows'\] \.desktop-auth-card\s*\{[\s\S]*?padding:\s*24px 28px/,
    );
  });

  it('설정되지 않은 Apple 로그인은 사용자에게 노출하지 않는다', () => {
    expect(screen).not.toContain("startOAuth('apple')");
  });
});
