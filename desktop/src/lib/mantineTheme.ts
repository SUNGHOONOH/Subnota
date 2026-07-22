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
    lg: 'var(--legacy-radius-panel)', // 12px
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
    // 메모 사이드바의 커스텀 .segment-control과 같은 계열로:
    // 트랙은 은은한 활성 배경, 선택 인디케이터는 종이색.
    SegmentedControl: SegmentedControl.extend({
      styles: {
        indicator: {
          backgroundColor: 'var(--legacy-bg-canvas)',
        },
        label: {
          color: 'var(--legacy-ink)',
        },
        root: {
          backgroundColor: 'var(--legacy-bg-active-soft)',
        },
      },
    }),
  },
});
