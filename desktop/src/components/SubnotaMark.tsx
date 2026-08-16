/**
 * 정지 상태의 Subnota 마크(물망초). 헤더·인증 화면·설정처럼 모션이 필요 없는
 * 자리에 쓴다.
 *
 * 잎의 위치·각도·크기는 로고 원본 그대로다. 균등한 72°가 아니라 미세하게
 * 어긋난 배치가 이 마크의 성격이라 손대지 않는다. 부팅 화면의 조립 모션
 * (`BootBrandMark`)도 같은 배치를 쓰므로 여기서 한 번만 정의한다.
 */

export const SUBNOTA_MARK_VIEW_BOX = '0 0 100 100';

/** 로고 원본의 잎 배치. [translate x, y, rotate deg, scale] */
export const SUBNOTA_PETAL_PLACEMENTS: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [49.7, 47, -6, 1.04],
  [52.8, 48.9, 68, 0.97],
  [51.7, 52.5, 145, 1.06],
  [48.5, 52.6, 210, 0.98],
  [47.2, 48.9, 292, 1.02],
];

/**
 * 잎 하나의 윤곽. 부팅 모션은 카드에서 이 모양으로 보간해야 해서 같은 문자열이
 * `subnota-workspace.scss`의 `boot-unfold` 100% 프레임에도 있다 — 한쪽만
 * 고치면 조립이 끝나는 순간 형태가 튄다.
 */
export const SUBNOTA_PETAL_PATH =
  'M0,-4 C-10,-11 -15,-30 -11,-41 C-8,-48 8,-48 11,-41 C15,-30 10,-11 0,-4 C0,-4 0,-4 0,-4';

/**
 * 오른쪽 잎 하나만 다른 색이다. 색은 CSS가 갖는다(`--app-color-brand-petal`) —
 * 마크를 쓰는 자리마다 색을 넘기게 하면 어긋나고, 여기서 값을 박으면 다크
 * 모드에서 안 따라온다.
 *
 * 붙이는 곳: 로고(이 파일), 부팅 브랜드 모션, 주변 메모 탐색 모션.
 * 붙이지 않는 곳: 일반 로딩 스피너 — 거기서는 다섯 장이 순서대로 밝아지는
 * 것 자체가 표현이라, 한 장만 색이 다르면 그 잎이 고장 난 것처럼 보인다.
 */
export const SUBNOTA_ACCENT_PETAL = 1;

/** 강조 잎에 붙는 클래스. `.subnota-petal-accent`가 fill을 덮는다. */
export const petalClass = (index: number, accent: boolean) =>
  accent && index === SUBNOTA_ACCENT_PETAL ? 'subnota-petal-accent' : undefined;

const SubnotaMark = ({
  accent = true,
  className,
  size = 16,
}: {
  /** 오른쪽 잎을 강조색으로 칠할지. 로고는 켠다. */
  accent?: boolean;
  className?: string;
  size?: number;
}) => (
  <svg
    aria-hidden="true"
    className={className}
    height={size}
    viewBox={SUBNOTA_MARK_VIEW_BOX}
    width={size}
  >
    {SUBNOTA_PETAL_PLACEMENTS.map(([x, y, rotate, scale], index) => (
      <path
        className={petalClass(index, accent)}
        d={SUBNOTA_PETAL_PATH}
        fill="currentColor"
        key={index}
        transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}
      />
    ))}
  </svg>
);

export default SubnotaMark;
