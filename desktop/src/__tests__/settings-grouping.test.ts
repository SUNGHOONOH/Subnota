import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 설정 탭이 전폭 구분선으로만 나뉜 하나의 긴 목록이었다. 이제 관련 항목만
// 묶음 카드에 담고, 묶음 이름은 카드 밖에 둔다.
const source = readFileSync(
  resolve(__dirname, '../features/settings/SettingsModal.tsx'),
  'utf8',
);
// 첫 블록(REFERENCE_CSS)은 transform: none으로 덮어써진다. 실제 레이아웃을
// 정하는 것은 SETTINGS_CSS 쪽이라 거기서만 확인한다.
const css = source.slice(source.indexOf('const SETTINGS_CSS'));

describe('설정 묶음 카드', () => {
  it('모달 우측 상단에 독립적인 닫기 버튼이 있다', () => {
    expect(source).toMatch(
      /<button\s+aria-label=\{t\('설정 닫기', 'Close settings'\)\}[\s\S]*?className="settings-reference-close"[\s\S]*?type="button"/,
    );
    expect(css).toMatch(
      /\.settings-reference-close\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*10/,
    );
    expect(css).toMatch(
      /\.settings-reference-close\s*\{[^}]*width:\s*var\(--settings-control-height, 28px\)/,
    );
    expect(css).toMatch(/\.settings-reference-close\s*\{[^}]*font-size:\s*22px/);
    expect(source).toContain('<span aria-hidden="true">×</span>');
  });

  it('Section이 이름 + 카드를 그린다', () => {
    expect(source).toContain('className="settings-reference-group"');
    expect(source).toContain('<div className="settings-reference-card">{children}</div>');
    expect(css).toMatch(
      /\.settings-reference-card\s*\{[^}]*border-radius:\s*10px/,
    );
  });

  // 행이 직접 구분선을 그리면 마지막 행 아래에도 선이 남아 카드 모서리와
  // 겹친다. 자식 사이에만 넣는다.
  it('구분선은 카드가 자식 사이에만 넣는다', () => {
    expect(css).toMatch(
      /\.settings-reference-card > \* \+ \*\s*\{[^}]*border-top/,
    );
    expect(source).not.toContain('settings-reference-section-divider');
    expect(source).not.toContain('<Divider');
  });

  // 묶음 이름이 카드 안 행 제목(13px)보다 크거나 진하면 항목처럼 읽힌다.
  it('묶음 이름이 행 제목보다 작고 흐리다', () => {
    expect(css).toMatch(
      /\.settings-reference-section-title\s*\{[^}]*font-size:\s*12px/,
    );
    expect(css).toMatch(
      /\.settings-reference-section-title\s*\{[^}]*color:\s*var\(--app-color-muted-design\)/,
    );
    expect(css).toMatch(
      /\.settings-reference-row-label\s*\{[^}]*font-size:\s*13px/,
    );
  });

  // 카드 안이라 가로 여백이 필요하다. 예전에는 `13px 0`이라 카드에 넣으면
  // 글자가 테두리에 붙는다.
  it('행과 펼침 영역에 카드 안쪽 여백이 있다', () => {
    expect(css).toMatch(/\.settings-reference-row\s*\{[^}]*padding:\s*13px 14px/);
    expect(css).toMatch(
      /\.settings-reference-expanded\s*\{[^}]*padding:\s*13px 14px/,
    );
  });

  // 카드 안에 테두리 있는 상자를 또 넣으면 카드 속 카드가 된다.
  it('복원 확인 상자가 자체 테두리를 두지 않는다', () => {
    expect(css).toMatch(
      /\.settings-reference-confirmation\s*\{[^}]*border:\s*0/,
    );
  });
});

describe('탭별 묶음 나누기', () => {
  const generalTab = source.slice(
    source.indexOf("{active === 'general' &&"),
    source.indexOf("{active === 'appearance' &&"),
  );

  // 알림·업데이트·연관 문장 검색은 시작과도 창과도 관계가 없었는데
  // "시작 및 창" 한 묶음에 같이 있었다.
  it('일반 탭이 세 묶음으로 나뉜다', () => {
    expect(generalTab).toContain("<Section title={t('시작 및 창', 'Startup & window')}>" );
    expect(generalTab).toContain("<Section title={t('알림 및 업데이트', 'Notifications & updates')}>" );
    expect(generalTab).toContain("<Section title={t('메모 작성', 'Writing')}>" );

    // 시작 및 창에는 자동 실행 · 창 닫기 · 작업 공간 복원만 남는다.
    const startGroup = generalTab.slice(
      generalTab.indexOf("<Section title={t('시작 및 창', 'Startup & window')}>"),
      generalTab.indexOf("<Section title={t('알림 및 업데이트', 'Notifications & updates')}>"),
    );
    expect(startGroup).toContain("label={t('로그인 시 자동 실행', 'Launch at login')}");
    expect(startGroup).toContain("label={t('창 닫기 동작', 'When closing the window')}");
    expect(startGroup).toContain("label={t('마지막 작업 공간 복원', 'Restore last workspace')}");
    expect(startGroup).not.toContain("label={t('업데이트 자동 확인'");
    expect(startGroup).not.toContain("label={t('연관 문장 자동 검색'");
  });

  // 이 버튼들은 앱 단축키와 전역 단축키를 모두 저장한다. "빠른 실행" 묶음
  // 안에 있으면 그 묶음만 저장하는 것처럼 읽힌다.
  it('단축키 저장 버튼이 묶음 카드 밖에 있다', () => {
    const hotkeysTab = source.slice(
      source.indexOf("{active === 'hotkeys' &&"),
      source.indexOf("{active === 'account' &&"),
    );

    expect(hotkeysTab).toMatch(
      /<\/Section>[\s\S]{0,200}<Group className="settings-reference-actions"/,
    );
    // 저장 버튼이 마지막 Section 안으로 다시 들어가면 안 된다.
    const afterLastSection = hotkeysTab.slice(hotkeysTab.lastIndexOf('</Section>'));
    expect(afterLastSection).toContain('단축키 저장');
  });

  // 나머지 탭은 이미 Section으로 나뉘어 있었다. 카드가 생기면서 그 구분이
  // 비로소 화면에 드러난다 — 묶음이 사라지지 않았는지만 확인한다.
  it('모든 탭이 최소 한 묶음을 유지한다', () => {
    for (const title of [
      '편집기 타이포그래피',
      '동기화 상태',
      '로컬 저장소',
      '검색 모델',
      '전체 백업',
      'JSON 내보내기',
      '빠른 실행',
      '로그인',
      '세션',
      'Subnota',
    ]) {
      // description이 있는 묶음은 여러 줄로 쓰여 있어 title만 확인한다.
      expect(source).toContain(
        title === 'Subnota' ? 'title="Subnota"' : `title={t('${title}'`,
      );
    }
  });
});
