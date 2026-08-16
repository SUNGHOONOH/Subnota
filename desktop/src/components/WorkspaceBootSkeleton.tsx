import { Skeleton, VisuallyHidden } from '@mantine/core';
import { localize, useUiLanguage } from '../lib/uiLanguage';

// Phase B — 로컬 작업 공간이 아직 안 붙었을 때만 보이는 앱 셸 스켈레톤.
//
// 실제 셸(커맨드 바 · 네비 레일 · 사이드바 · 탭 바 · 본문)과 같은 자리에 같은
// 크기 토큰으로 회색 자리를 깔아, 실제 화면으로 바뀔 때 레이아웃이 튀지 않게
// 한다. 버튼처럼 보이는 조각은 만들지 않는다 — 누를 수 없는 것이 눌러야 할
// 것처럼 보이면 안 된다. 비활성 표면이라 포인터 이벤트도 받지 않는다.

const RAIL_DOTS = [0, 1, 2, 3, 4];

// 실제 메모 목록은 사이드바 높이를 끝까지 채운다. 창 높이를 재는 대신
// 넉넉히 그려 두고 남는 만큼 잘라 낸다(`.boot-skeleton-sidebar`가
// `overflow: hidden`) — 앱 셸 스켈레톤이 대체로 쓰는 방식이고, 창 크기마다
// 개수를 다시 계산하는 리스너 없이 어떤 높이에서도 채워진다.
const SIDEBAR_ROWS = Array.from({ length: 14 }, (_, index) => index);

// 본문은 반대다. 메모 상단은 원래 몇 줄뿐이라 여기서 화면을 채우면
// 실제 화면으로 바뀔 때 오히려 내용이 사라진 것처럼 보인다.
const BODY_LINES = ['92%', '86%', '95%', '74%'];

// Mantine <Skeleton>을 그대로 쓰고, `subnota-skeleton`이 색과 shimmer만 앱
// 토큰으로 바꾼다(기본 pulse → 옅은 좌→우 shimmer).
const Bar = ({ height, width }: { height: number; width?: string }) => (
  <Skeleton className="subnota-skeleton" height={height} radius="sm" width={width} />
);

const WorkspaceBootSkeleton = () => {
  const language = useUiLanguage();

  return (
  <main className="loading-screen boot-shell">
    <VisuallyHidden role="status">
      {localize(language, '작업 공간을 준비하는 중', 'Preparing your workspace')}
    </VisuallyHidden>
    <div aria-hidden="true" className="boot-skeleton">
      <div className="boot-skeleton-commandbar">
        <Bar height={10} width="132px" />
        <Bar height={10} width="88px" />
      </div>
      <div className="boot-skeleton-body">
        <div className="boot-skeleton-rail">
          {RAIL_DOTS.map(index => (
            <Skeleton
              circle
              className="subnota-skeleton"
              height={20}
              key={index}
            />
          ))}
        </div>
        <div className="boot-skeleton-sidebar">
          <Bar height={11} width="46%" />
          {SIDEBAR_ROWS.map(index => (
            <div className="boot-skeleton-sidebar-row" key={index}>
              <Bar height={10} width="82%" />
              <Bar height={8} width="42%" />
            </div>
          ))}
        </div>
        <div className="boot-skeleton-main">
          <div className="boot-skeleton-tabbar">
            <Bar height={12} width="104px" />
            <Bar height={12} width="76px" />
          </div>
          <div className="boot-skeleton-doc">
            <Bar height={20} width="58%" />
            {BODY_LINES.map((width, index) => (
              <Bar height={10} key={index} width={width} />
            ))}
          </div>
        </div>
      </div>
    </div>
  </main>
  );
};

export default WorkspaceBootSkeleton;
