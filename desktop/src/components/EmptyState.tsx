import type { ReactNode } from 'react';

import SubnotaMark from './SubnotaMark';

/**
 * 비어 있는 화면 하나로 통일. 이전에는 같은 일을 하는 클래스가 7개였고
 * (`.empty-panel`, `.empty-text`, `.preview-empty`, `.global-search-empty`,
 * `.knowledge-graph-empty`, `.cal-todo-empty`, `.mini-composer__recent-empty`)
 * 폰트·패딩·정렬이 제각각이었다.
 *
 * `size`는 담는 그릇이 정한다:
 *   inline — 사이드바 섹션·하루 패널처럼 좁은 곳. 한 줄, 좌측 정렬.
 *   panel  — 격자·패널 본문. 가운데 블록.
 *   canvas — 그래프처럼 이미 빈 캔버스. 영역을 채우고 가운데.
 *
 * `tone`은 왜 비었는지가 정한다:
 *   start   — 아직 아무것도 안 했거나 준비 중. 유일하게 마크를 단다.
 *   result  — 찾았는데 0건(검색·필터).
 *   neutral — 비어 있는 것이 정상이거나 좋은 상태.
 *
 * 마크는 `start`에만, 그것도 inline이 아닐 때만 붙는다. 검색 0건은 타이핑하는
 * 동안 수십 번 뜨는데 거기에 그림을 넣으면 효과가 닳고 방해만 된다(반복되는
 * 일러스트를 피하라는 것이 디자인 시스템들의 공통 권고다). 좁은 곳에서는
 * 빈 상태가 목록보다 커지므로 역시 텍스트만 쓴다.
 *
 * 행동 버튼은 두지 않는다. 여기서 할 수 있는 일은 전부 화면의 원래 자리에
 * 이미 있고, 빈 화면마다 버튼을 달면 CTA 과다가 된다.
 */

export type EmptyStateSize = 'inline' | 'panel' | 'canvas';
export type EmptyStateTone = 'start' | 'result' | 'neutral';

interface EmptyStateProps {
  body?: ReactNode;
  className?: string;
  size?: EmptyStateSize;
  title: ReactNode;
  tone?: EmptyStateTone;
}

const EmptyState = ({
  body,
  className,
  size = 'panel',
  title,
  tone = 'neutral',
}: EmptyStateProps) => {
  const showsMark = tone === 'start' && size !== 'inline';

  return (
    <div
      className={[`empty-state`, size, tone, className]
        .filter(Boolean)
        .join(' ')}
    >
      {showsMark && (
        <SubnotaMark
          className="empty-state-mark"
          size={size === 'canvas' ? 34 : 28}
        />
      )}
      <p className="empty-state-title">{title}</p>
      {body && <p className="empty-state-body">{body}</p>}
    </div>
  );
};

export default EmptyState;
