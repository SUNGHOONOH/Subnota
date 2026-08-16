import {
  SUBNOTA_MARK_VIEW_BOX,
  SUBNOTA_PETAL_PATH,
  SUBNOTA_PETAL_PLACEMENTS,
  petalClass,
} from './SubnotaMark';

/**
 * 로고가 바깥으로 퍼졌다 돌아오는 모션 — 주변 메모를 찾는 동안 쓴다.
 *
 * 부팅 모션의 반대다. 거기서는 흩어진 것이 모여 로고가 되고(정리),
 * 여기서는 로고가 바깥으로 퍼진다(탐색). 같은 잎으로 반대되는 두 동작을
 * 만드니 로딩이 곧 "지금 무슨 일을 하는 중인가"를 말한다.
 *
 * 잎은 각자 자기가 뻗은 방향으로 나간다(로컬 좌표의 -y가 바깥). 다섯 장이
 * 동시에 나가면서 작아지므로 원형으로 흩어진 점들이 됐다가 다시 꽃이 된다.
 *
 * 끝이 없는 루프다. 검색이 언제 끝날지 알 수 없으니 완성으로 끝나는
 * 조립 모션을 쓰면 안 된다.
 */
const SubnotaScatterMark = ({ size = 44 }: { size?: number }) => (
  <svg
    aria-hidden="true"
    className="subnota-scatter"
    fill="currentColor"
    height={size}
    viewBox={SUBNOTA_MARK_VIEW_BOX}
    width={size}
  >
    {SUBNOTA_PETAL_PLACEMENTS.map(([x, y, rotate, scale], index) => (
      <g key={index} transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}>
        <g
          className="subnota-scatter-petal"
          style={{ '--petal-index': index } as React.CSSProperties}
        >
          <path className={petalClass(index, true)} d={SUBNOTA_PETAL_PATH} />
        </g>
      </g>
    ))}
  </svg>
);

export default SubnotaScatterMark;
