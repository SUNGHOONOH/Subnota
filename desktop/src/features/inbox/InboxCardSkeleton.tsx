import { Card, Group, Skeleton } from '@mantine/core';

// 수집함 카드가 하나도 없고 불러오는 중일 때만 쓰는 자리표시자.
// 실제 `.inbox-card`와 같은 Card/그리드 셀을 써서 카드가 도착해도 격자가
// 흔들리지 않게 한다 — 썸네일 / 제목 / 출처 / 요약 / 키워드 순서도 그대로다.
// 좋아요·삭제는 hover에만 뜨는 절대 배치라 자리를 차지하지 않으므로 여기에
// 대응하는 자리표시자가 없다.
//
// 개수는 창 크기가 아니라 **한 페이지에 실제로 담기는 수**(`count`)를 따른다.
// 화면 폭에 맞춰 늘리면 넓은 창에서 8장을 약속했다가 6장이 도착해 줄어든다.
// 격자가 `auto-fill`이라 열 수는 CSS가 알아서 맞추고, 좁아지면 줄만 접힌다.
const InboxCardSkeleton = ({ count }: { count: number }) => (
  <>
    {Array.from({ length: count }, (_, index) => (
      <Card
        aria-hidden="true"
        className="inbox-card inbox-card-skeleton"
        key={index}
        padding="sm"
        radius="sm"
        withBorder
      >
        <Card.Section>
          <div className="inbox-thumbnail">
            <Skeleton className="subnota-skeleton" height="100%" radius={0} />
          </div>
        </Card.Section>
        <div className="inbox-card-content">
          <div className="inbox-card-title">
            <div className="inbox-card-skeleton-lines">
              <Skeleton className="subnota-skeleton" height={13} radius="sm" width="88%" />
              <Skeleton className="subnota-skeleton" height={13} radius="sm" width="54%" />
            </div>
          </div>
          <div className="inbox-card-source">
            <Skeleton className="subnota-skeleton" height={9} radius="sm" width="38%" />
          </div>
          <div className="inbox-card-summary">
            <Skeleton className="subnota-skeleton" height={9} radius="sm" width="94%" />
          </div>
          <Group className="inbox-card-keywords" gap={4}>
            <Skeleton className="subnota-skeleton" height={16} radius="sm" width={46} />
            <Skeleton className="subnota-skeleton" height={16} radius="sm" width={62} />
          </Group>
        </div>
      </Card>
    ))}
  </>
);

export default InboxCardSkeleton;
