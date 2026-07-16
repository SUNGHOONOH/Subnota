import { createTheme, Tooltip } from '@mantine/core';
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

  // radius — --tt-radius-*
  defaultRadius: 'md',
  radius: {
    xs: '0.25rem', // 4px
    sm: '0.375rem', // 6px
    md: '0.5rem', // 8px
    lg: '0.75rem', // 12px
    xl: '1rem', // 16px
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
  },
});
