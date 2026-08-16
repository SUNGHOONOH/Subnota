import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const appSource = read('App.tsx');
const authScreen = read('features/auth/AuthScreen.tsx');
const settings = read('features/settings/SettingsModal.tsx');
const styles = read('styles/subnota-workspace.scss');

describe('비밀번호 재설정 흐름', () => {
  // 코드를 넣을 화면이 로그인 화면에만 있다. 로그인한 채로 두면 메일만 가고
  // 이어서 할 수 있는 것이 없었다.
  it('재설정을 시작하면 로그아웃하고 재설정 화면으로 보낸다', () => {
    expect(appSource).toContain('setPendingResetEmail(email);');
    expect(appSource).toContain('await handleSignOut();');
    expect(appSource).toContain('initialResetEmail={pendingResetEmail}');

    expect(authScreen).toContain('initialResetEmail?: string | null;');
    expect(authScreen).toContain("initialResetEmail ? 'reset' : 'auth',");
    // 메일 주소가 채워져 있어야 코드 확인이 바로 이어진다.
    expect(authScreen).toContain("useState(initialResetEmail ?? '')");
  });

  // 남겨 두면 다음에 로그아웃할 때 엉뚱하게 재설정 화면으로 떨어진다.
  it('로그인에 성공하면 대기 상태를 지운다', () => {
    expect(appSource).toContain('setPendingResetEmail(null);');
  });

  // 되돌릴 수 없고 이 기기에서 로그아웃까지 된다.
  it('설정에서 누르면 무슨 일이 일어나는지 먼저 묻는다', () => {
    expect(settings).toContain('window.confirm(');
    expect(settings).toContain('비밀번호를 재설정하시겠습니까?');
    expect(settings).toContain('이 기기에서 로그아웃합니다');
    // 확인을 누르지 않으면 메일도 보내지 않는다.
    expect(settings).toMatch(/\)\s*\)\s*\{\s*\n\s*return;\s*\n\s*\}/);
  });

  // OAuth 계정에는 바꿀 비밀번호가 없다. 재설정을 보내면 비밀번호가 없던
  // 계정에 두 번째 로그인 수단을 만들어 주는 셈이고, 로그아웃까지 되는데
  // 사용자는 왜 나갔는지 알 수 없다.
  it('구글·카카오 계정에서는 재설정을 막는다', () => {
    expect(settings).toContain("const authProvider = props.provider ?? 'email';");
    expect(settings).toContain("const isPasswordAccount = authProvider === 'email';");
    expect(settings).toContain(
      '!props.isSignedIn || !props.email || !isPasswordAccount',
    );
    // 왜 못 하는지 자리에서 알려 준다(숨기지 않는다).
    expect(settings).toContain('에서 비밀번호를 관리합니다.');
  });

  // 화면 조건 하나에만 기대면 버튼을 손보는 순간 같이 열린다.
  it('핸들러에서도 provider를 다시 본다', () => {
    expect(appSource).toContain(
      "const provider = session?.user?.app_metadata?.provider ?? 'email';",
    );
    expect(appSource).toMatch(
      /if \(provider !== 'email'\) \{[\s\S]*?throw new Error\(/,
    );
  });

  // 회색으로 두면 무엇이 남았는지 아이콘을 하나씩 확인해야 한다.
  it('못 채운 비밀번호 조건은 빨강, 채운 조건은 초록이다', () => {
    expect(styles).toMatch(
      /\.reset-req \{[\s\S]*?color: var\(--app-color-danger\)/,
    );
    expect(styles).toMatch(
      /\.reset-req \{[\s\S]*?&\.met \{[\s\S]*?color: var\(--legacy-success-strong\)/,
    );
  });

  // "로그인으로 돌아가기"가 두 줄로 접혀 버튼 높이만 늘어났다.
  it('인증 화면 버튼이 두 줄로 접히지 않는다', () => {
    expect(styles).toMatch(/\.reset-cancel \{[\s\S]*?white-space: nowrap/);
    expect(styles).toMatch(/\.reset-submit \{[\s\S]*?white-space: nowrap/);
  });
});

describe('Topics 빈 상태', () => {
  const split = read('features/memo/components/MemoSplitWorkspace.tsx');

  // 묶을 것이 없으면 "카테고리 기반 임시 묶음"도 설명할 대상이 없다.
  // 빈 상태 두 개를 쌓는 대신 마크를 단 하나로 합친다.
  it('묶을 주제가 없으면 마크를 단 빈 상태 하나만 남는다', () => {
    const emptyBranch = split.slice(
      split.indexOf('fallbackCategories.length > 0 ? ('),
      split.indexOf('if (editor.view === \'source\')'),
    );

    // tone="start" + 기본 size라야 마크가 붙는다(EmptyState 규칙).
    expect(emptyBranch).toMatch(
      /<EmptyState\s*\n\s*body="[^"]+"\s*\n\s*title="메모가 쌓이면 주제별로 자동으로 묶입니다"\s*\n\s*tone="start"/,
    );
    // 비었을 때는 "임시 묶음" 설명을 띄우지 않는다.
    expect(emptyBranch.indexOf('카테고리 기반 임시 묶음')).toBeLessThan(
      emptyBranch.indexOf('tone="start"'),
    );
  });
});
