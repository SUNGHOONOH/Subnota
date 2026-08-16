import {
  SUBNOTA_MARK_VIEW_BOX,
  SUBNOTA_PETAL_PATH,
  SUBNOTA_PETAL_PLACEMENTS,
} from './SubnotaMark';

/**
 * 작은 물망초 스피너.
 *
 * 잎이 배치된 각도 순서(-6 → 68 → 145 → 210 → 292)대로 밝아지므로 원을
 * 도는 체이스가 된다. 회전하는 도형을 따로 만들지 않고 로고 자체가 스피너다.
 *
 * 부팅 화면의 큰 스피너(.boot-mark-spin)와 달리 여기서는 밝기만 움직인다.
 * 16px에서는 확대·축소가 보이지 않는데, 그걸 넣으려면 SVG transform 속성과
 * 충돌을 피하려고 <g>를 한 겹 더 감싸야 한다. 보이지도 않는 것에 마크업을
 * 늘리지 않는다.
 *
 * 색은 `currentColor`다.
 */
const SubnotaSpinner = ({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) => (
  <svg
    aria-hidden="true"
    className={className ? `subnota-spinner ${className}` : 'subnota-spinner'}
    fill="currentColor"
    height={size}
    viewBox={SUBNOTA_MARK_VIEW_BOX}
    width={size}
  >
    {SUBNOTA_PETAL_PLACEMENTS.map(([x, y, rotate, scale], index) => (
      <path
        d={SUBNOTA_PETAL_PATH}
        key={index}
        style={{ '--petal-index': index } as React.CSSProperties}
        transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}
      />
    ))}
  </svg>
);

export default SubnotaSpinner;
