import { ImageResponse } from 'next/og';

/**
 * 링크 공유 썸네일. Next의 파일 규약이라 layout.tsx에 등록하지 않아도
 * og:image / twitter:image 로 자동으로 붙는다.
 *
 * 로고 색은 desktop/src/styles/_color-tokens.scss 의 app-color-brand-mark,
 * web/app/globals.css 의 brand-mark 와 같은 값이어야 한다.
 */

export const alt = 'Subnota(서브노타) | 잊어도 정리되는 메모 앱';
export const size = { height: 630, width: 1200 };
export const contentType = 'image/png';

const BRAND_MARK = '#4c71b7';
/** 오른쪽 잎 한 장만 말라카이트. app-color-brand-petal 과 같은 값. */
const BRAND_PETAL = '#0b6e4f';
/** 강조 잎의 자리. SubnotaMark.tsx 의 SUBNOTA_ACCENT_PETAL 과 같아야 한다. */
const ACCENT_INDEX = 1;
const PETAL =
  'M0,-4 C-10,-11 -15,-30 -11,-41 C-8,-48 8,-48 11,-41 C15,-30 10,-11 0,-4 Z';
const PLACEMENTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [49.7, 47, -6, 1.04],
  [52.8, 48.9, 68, 0.97],
  [51.7, 52.5, 145, 1.06],
  [48.5, 52.6, 210, 0.98],
  [47.2, 48.9, 292, 1.02],
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#f3f1e9',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <svg fill={BRAND_MARK} height="180" viewBox="-6 -6 112 112" width="180">
          {PLACEMENTS.map(([x, y, rotate, scale], index) => (
            <path
              d={PETAL}
              fill={index === ACCENT_INDEX ? BRAND_PETAL : BRAND_MARK}
              key={index}
              transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}
            />
          ))}
        </svg>
        <div
          style={{
            color: '#2c2520',
            display: 'flex',
            flexDirection: 'column',
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.18,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex' }}>잊어도</div>
          <div style={{ display: 'flex' }}>정리되는 메모 앱</div>
        </div>
        <div style={{ color: '#7d7466', display: 'flex', fontSize: 30 }}>
          Subnota · 서브노타
        </div>
      </div>
    ),
    size,
  );
}
