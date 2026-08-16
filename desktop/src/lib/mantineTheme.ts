import {
  Card,
  createTheme,
  Input,
  Menu,
  SegmentedControl,
  Tooltip,
} from '@mantine/core';
import { desktopBrandColors, desktopColorTokens } from './colorTokens';

// Subnota의 디자인 토큰(src/styles/_variables.scss의 --tt-* / --legacy-*)을
// Mantine 테마에 매핑한다. 폰트/그림자는 기존 CSS 변수를 그대로 가리켜
// 라이트/다크 전환과 향후 토큰 변경이 자동으로 따라오게 한다.

export const mantineTheme = createTheme({
  primaryColor: 'brand',
  // 라이트=brand-500, 다크=brand-400 — 기존 --tt-cursor-color 관례와 일치
  primaryShade: { light: 5, dark: 4 },
  colors: { brand: desktopBrandColors },

  // 워밍 캔버스/잉크 — --white / --black
  white: desktopColorTokens.surface.canvas,
  black: desktopColorTokens.surface.ink,

  // 폰트는 기존 CSS 변수를 그대로 참조 (단일 소스 유지)
  fontFamily: 'var(--legacy-font-ui)',
  fontFamilyMonospace: 'var(--legacy-font-mono)',
  headings: { fontFamily: 'var(--legacy-font-ui)' },

  // radius — legacy 토큰을 직접 참조해 단일 소스를 유지한다.
  // 수치는 기존과 동일(4/6/8/12px)하므로 시각 변화 없음.
  defaultRadius: 'md',
  radius: {
    xs: 'var(--legacy-radius-xs)', // 4px
    sm: 'var(--legacy-radius-row)', // 6px
    md: 'var(--legacy-radius-card)', // 8px
    lg: 'var(--legacy-radius-panel)', // 14px
    xl: '1rem', // 16px (legacy 스케일 밖 — Mantine 전용)
  },

  // 그림자 — --tt-shadow-elevated-md (다크 모드 값까지 CSS 변수가 처리)
  shadows: {
    md: 'var(--tt-shadow-elevated-md)',
    lg: 'var(--tt-shadow-elevated-md)',
  },

  components: {
    // 툴팁은 작고 촘촘하게 (폰트 xs + 좁은 패딩)
    Tooltip: Tooltip.extend({
      styles: {
        tooltip: {
          fontSize: 'var(--mantine-font-size-xs)',
          padding: '2px 8px',
        },
      },
    }),

    // Mantine 컴포넌트가 legacy 페이퍼 룩을 입도록 표면 토큰을 연결한다.
    // 화면 코드는 그대로 두고 테마에서만 통일한다(수집함 ↔ 메모 화면 룩 정합).
    Card: Card.extend({
      styles: {
        root: {
          backgroundColor: 'var(--legacy-bg-canvas)',
          borderColor: 'var(--legacy-border)',
          color: 'var(--legacy-ink)',
        },
      },
    }),
    Input: Input.extend({
      styles: {
        input: {
          backgroundColor: 'var(--legacy-bg-canvas)',
          borderColor: 'var(--legacy-border)',
          color: 'var(--legacy-ink)',
        },
      },
    }),
    Menu: Menu.extend({
      styles: {
        dropdown: {
          backgroundColor: 'var(--legacy-bg-canvas)',
          borderColor: 'var(--legacy-border)',
        },
        item: {
          color: 'var(--legacy-ink)',
        },
      },
    }),
    // 앱의 세그먼트 계열은 트랙에 은은한 배경을 사용하고,
    // 선택 인디케이터는 종이색으로 띄운다. 트랙은 중성 회색이다 —
    // 코랄 틴트를 쓰면 늘 켜져 있는 브랜드 강조처럼 보인다.
    SegmentedControl: SegmentedControl.extend({
      // 999를 넘겨야 진짜 알약이 된다. 테마의 radius.xl은 1rem(16px)이라
      // 모서리만 둥근 상자로 남는다. Mantine이 이 값으로 트랙과 인디케이터를
      // 함께 계산하므로, 여기 한 줄이면 네 곳(메모 사이드바·링크 저장함·
      // 설정·웹 요약)이 같이 바뀐다.
      defaultProps: { radius: 999 },
      styles: {
        indicator: {
          backgroundColor: 'var(--legacy-bg-canvas)',
        },
        label: {
          color: 'var(--legacy-ink)',
        },
        root: {
          backgroundColor: 'var(--app-color-bg-muted)',
        },
      },
    }),
  },
});
