import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const styles = read('styles/subnota-workspace.scss');
const settings = read('features/settings/SettingsModal.tsx');
const theme = read('lib/mantineTheme.ts');
const graph = read('features/memo/components/knowledgeGraph.ts');

// 앱 크롬(툴바 버튼·탐색 항목·세그먼트 트랙)의 hover가 코랄 틴트였다.
// 늘 켜져 있는 브랜드 강조처럼 보여서 진짜 강조가 묻힌다.
describe('크롬 hover는 중성 회색', () => {
  it('분할 툴바 버튼이 코랄로 물들지 않는다', () => {
    for (const rule of [
      '.split-action-btn',
      '.split-editor-tab-add',
      '.split-view-picker-item:hover',
    ]) {
      const block = styles.slice(styles.indexOf(`${rule} {`));
      expect(block.slice(0, block.indexOf('\n}'))).not.toContain(
        'bg-active-soft',
      );
    }
  });

  it('세그먼트 트랙이 중성 회색이다', () => {
    expect(theme).toContain("backgroundColor: 'var(--app-color-bg-muted)'");
    expect(theme).not.toContain("'var(--legacy-bg-active-soft)'");
  });

  // 사이드바 바탕이 --app-color-bg-muted다. hover에 --app-color-bg-hover를
  // 쓰면 같은 값이라 아무 변화가 없다 — 회색 위에서는 방향을 뒤집어야 한다.
  it('설정 탐색은 회색 바탕 위에서 방향을 뒤집는다', () => {
    expect(settings).toContain(
      '.settings-reference-nav-button[data-active] {\n  background: var(--app-color-bg-surface);',
    );
    expect(settings).toContain(
      '.settings-reference-nav-button:not([data-active]):hover',
    );
    // 사이드바와 같은 값이면 hover가 보이지 않는다.
    const navHover = settings.slice(
      settings.indexOf('.settings-reference-nav-button:not([data-active]):hover'),
    );
    expect(navHover.slice(0, navHover.indexOf('\n}'))).toContain(
      'var(--app-color-bg-pressed)',
    );
  });

  // 맨 글자로 두면 "위치 변경 폴더 열기"가 한 문장으로 붙어 읽힌다.
  it('설정 행 동작이 pill로 감싸진다', () => {
    const link = settings.slice(
      settings.indexOf('.settings-reference-link {', settings.indexOf('SETTINGS_CSS')),
    );
    const block = link.slice(0, link.indexOf('\n}'));
    expect(block).toContain('border-radius: 999px');
    expect(block).toContain('border: 1px solid var(--app-color-border)');
    expect(block).toContain('height: 24px');
  });
});

// 짧은 라벨 하나를 담는 컨트롤은 알약이다(docs/design.md). 트랙만 둥글고
// 안쪽 칸이 각지면 흰 인디케이터가 둥근 트랙 안에서 튄다 — 둘을 함께 잡는다.
describe('알약 컨트롤', () => {
  const pillPairs = [
    ['.cal-views', '.cal-views button'],
    ['.cal-nav', '.cal-nav-icon,\n.cal-today'],
  ] as const;

  for (const [track, inner] of pillPairs) {
    it(`${track}의 트랙과 안쪽 칸이 함께 둥글다`, () => {
      for (const rule of [track, inner]) {
        const block = styles.slice(styles.indexOf(`${rule} {`));
        expect(block.slice(0, block.indexOf('\n}'))).toContain(
          'border-radius: 999px',
        );
      }
    });
  }

  it('칩과 키 캡이 알약이다', () => {
    const chip = styles.slice(styles.indexOf('.split-topic-chip {'));
    expect(chip.slice(0, chip.indexOf('\n}'))).toContain('border-radius: 999px');

    const cap = settings.slice(
      settings.indexOf('.settings-reference-shortcut-value {', settings.indexOf('SETTINGS_CSS')),
    );
    expect(cap.slice(0, cap.indexOf('\n}'))).toContain('border-radius: 999px');
  });

  // 테마의 xl은 1rem(16px)이라 모서리만 둥근 상자로 남는다. 999를 넘겨야
  // 하고, 한 곳에서 정해야 네 인스턴스가 갈라지지 않는다.
  it('세그먼트는 테마 한 곳에서 알약이 된다', () => {
    expect(theme).toContain('defaultProps: { radius: 999 }');
    // 설정이 radius를 다시 쓰면 거기만 각진 채로 남는다.
    const settingsSegmented = settings.slice(
      settings.indexOf(
        '.settings-reference-segmented .mantine-SegmentedControl-root {',
        settings.indexOf('SETTINGS_CSS'),
      ),
    );
    expect(settingsSegmented.slice(0, settingsSegmented.indexOf('\n}'))).not.toContain(
      'border-radius',
    );
  });
});

describe('주변 메모 그래프 노드', () => {
  const tokens = read('styles/_color-tokens.scss');

  // 로고 잎(말라카이트)과 캘린더 기본색(올리브)의 중간. 한쪽만 쓰면 다른 쪽과
  // 남남이 되거나(로고) 흰 캔버스에서 묻힌다(올리브).
  it('두 초록의 중간값을 쓴다', () => {
    expect(graph).toContain("export const GRAPH_NODE_COLOR = '#396f55';");
    expect(graph).toContain('activeEdge: GRAPH_NODE_COLOR,');
    expect(graph).toContain('defaultNode: GRAPH_NODE_COLOR,');

    // 원본 두 값이 바뀌면 중간값도 다시 계산해야 한다. 여기서 같이 잡는다.
    expect(tokens).toContain('--app-color-brand-petal: #0b6e4f;');
    expect(read('features/calendar/calendarCategories.ts')).toContain(
      "export const DEFAULT_CALENDAR_COLOR = '#66705A';",
    );
  });

  it('예전 형광 초록이 남아 있지 않다', () => {
    const block = graph.slice(
      graph.indexOf('export const GRAPH_NODE_COLOR'),
      graph.indexOf('} as const;'),
    );
    expect(block).not.toContain('#1dad64');
  });
});
