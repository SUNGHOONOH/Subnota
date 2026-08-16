import type { MantineColorsTuple } from '@mantine/core';

/** 잉크 블루. `_color-tokens.scss`의 `--app-color-brand-*`와 같은 값이다. */
export const desktopBrandColors: MantineColorsTuple = [
  '#eff6ff',
  '#deecff',
  '#bfd8ff',
  '#94b6f5',
  '#6388cd',
  '#325496',
  '#254582',
  '#1b376b',
  '#142b55',
  '#0f2040',
];

export const desktopColorTokens = {
  brand: {
    primary: desktopBrandColors[5],
    hover: desktopBrandColors[6],
    soft: desktopBrandColors[1],
  },
  danger: {
    primary: '#b42318',
    feedback: 'rgba(180, 35, 24, 0.22)',
  },
  success: {
    feedback: 'rgba(47, 125, 87, 0.22)',
  },
  surface: {
    canvas: '#fdfdfb',
    ink: '#141413',
    hairline: '#E6DFD8',
    /* 종이 사이드바. `--app-color-chrome-bg`와 같은 값. */
    chrome: '#f3f1e9',
  },
};
