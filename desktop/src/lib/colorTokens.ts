import type { MantineColorsTuple } from '@mantine/core';

export const desktopBrandColors: MantineColorsTuple = [
  '#fdf4f0',
  '#f8e4da',
  '#f3b9a6',
  '#e98a6d',
  '#dc6343',
  '#cc4929',
  '#bf3f22',
  '#9f321b',
  '#7f2817',
  '#5b1c10',
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
  },
};
