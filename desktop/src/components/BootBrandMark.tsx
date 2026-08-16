/**
 * Phase A 브랜드 모션 — 흩어진 메모가 모여 물망초가 된다.
 *
 * 세 박자로 읽힌다: ① 스켈레톤 메모 카드 5장이 흩어진 채 잠깐 머물고
 * ② 한자리로 모이며 카드가 꽃잎으로 펴지고 ③ 잎마다 색이 하나씩 채워진다.
 * 흩어진 것을 정리한다는 제품의 일과 같은 뜻이라 로딩이 브랜드가 된다.
 *
 * 전부 CSS `@keyframes`다. 부팅 화면은 앱에서 가장 먼저 그려져야 하는데
 * 애니메이션 라이브러리를 기다리면 그 자체가 지연이 된다.
 *
 * 1.19초에 끝난다 — Phase A 상한(BOOT_BRAND_PHASE_MS)에 맞춘 값이다.
 * 로컬이 먼저 준비되면 중간에 잘리는데, 그게 맞다. 다 보여 주려고
 * 사용자를 붙잡아 두지 않는다.
 *
 * 잎의 위치·각도·크기는 로고 원본 그대로다. 균등한 72°가 아니라 미세하게
 * 어긋난 배치가 이 마크의 성격이라 손대지 않는다.
 */
import {
  SUBNOTA_MARK_VIEW_BOX,
  SUBNOTA_PETAL_PLACEMENTS,
  petalClass,
} from './SubnotaMark';

/** 흩어진 출발 자리. 잎의 로컬 좌표라 각자 자기 방향 바깥에서 들어온다. */
const SCATTER: ReadonlyArray<readonly [number, number, number]> = [
  [-9, -38, -25],
  [11, -42, 20],
  [-13, -35, -30],
  [8, -44, 27],
  [-6, -40, -16],
];

/**
 * `assemble` — 앱 시작. 카드가 모여 로고가 되고 멈춘다.
 * `spin`     — 새로고침(⌘R). 잎이 순서대로 켜지는 체이스 스피너.
 *              끝이 없는 루프라 어느 시점에 끊겨도 잘려 보이지 않는다.
 */
const BootBrandMark = ({
  variant = 'assemble',
}: {
  variant?: 'assemble' | 'spin';
}) => (
  <svg
    aria-hidden="true"
    className={variant === 'spin' ? 'boot-mark boot-mark-spin' : 'boot-mark'}
    viewBox={SUBNOTA_MARK_VIEW_BOX}
    width="132"
    height="132"
  >
    {SUBNOTA_PETAL_PLACEMENTS.map(([x, y, rotate, scale], index) => (
      <g key={index} transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
        <g
          className="boot-petal"
          style={
            {
              '--boot-petal-index': index,
              '--boot-scatter-rotate': `${SCATTER[index][2]}deg`,
              '--boot-scatter-x': `${SCATTER[index][0]}px`,
              '--boot-scatter-y': `${SCATTER[index][1]}px`,
            } as React.CSSProperties
          }
        >
          <path
            className={['boot-petal-shape', petalClass(index, variant === 'assemble')]
              .filter(Boolean)
              .join(' ')}
          />
          {/* 스켈레톤 노트 카드: 제목 줄 1 + 본문 줄 3, 마지막 줄은 짧게. */}
          <g className="boot-petal-lines">
            <rect x="-8" y="-30" width="12" height="2.8" rx="1.2" />
            <rect x="-8" y="-25" width="16" height="2" rx="1" />
            <rect x="-8" y="-21" width="16" height="2" rx="1" />
            <rect x="-8" y="-17" width="9" height="2" rx="1" />
          </g>
        </g>
      </g>
    ))}
  </svg>
);

export default BootBrandMark;
