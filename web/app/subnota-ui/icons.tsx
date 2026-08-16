/* 앱과 같은 아이콘을 같은 이름으로 쓴다.
   원본은 desktop/src/components/icons.tsx — Heroicons 24 outline을 lucide 이름으로
   재수출하는 어댑터다. 랜딩이 그리는 화면에 나오는 것만 옮겨 둔다. */

import type { ComponentType, SVGProps } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  ArrowUpRightIcon,
  Bars3BottomLeftIcon,
  CalendarDaysIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  FolderIcon,
  HeartIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShareIcon,
  Squares2X2Icon,
  TrashIcon,
  WindowIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'size'> & {
  size?: number | string;
};

const adapt = (Base: ComponentType<SVGProps<SVGSVGElement>>) => {
  const Icon = ({ size, width, height, ...props }: IconProps) => (
    <Base
      aria-hidden="true"
      height={height ?? size ?? 24}
      width={width ?? size ?? 24}
      {...props}
    />
  );
  Icon.displayName = `Icon(${Base.displayName ?? Base.name ?? 'Heroicon'})`;
  return Icon;
};

export const AppWindow = adapt(WindowIcon);
export const ArrowUpRight = adapt(ArrowUpRightIcon);
export const CalendarDays = adapt(CalendarDaysIcon);
export const ChevronLeft = adapt(ChevronLeftIcon);
export const ChevronRight = adapt(ChevronRightIcon);
export const ExternalLink = adapt(ArrowTopRightOnSquareIcon);
export const Folder = adapt(FolderIcon);
export const Heart = adapt(HeartIcon);
export const Inbox = adapt(InboxIcon);
export const List = adapt(Bars3BottomLeftIcon);
export const MoreHorizontal = adapt(EllipsisHorizontalIcon);
export const Network = adapt(ShareIcon);
export const NotebookText = adapt(DocumentTextIcon);
export const PanelLeft = adapt(ChevronDoubleRightIcon);
export const PanelRightClose = adapt(ChevronDoubleLeftIcon);
export const Plus = adapt(PlusIcon);
export const Search = adapt(MagnifyingGlassIcon);
export const Settings = adapt(Cog6ToothIcon);
export const Topics = adapt(Squares2X2Icon);
export const Trash2 = adapt(TrashIcon);
export const X = adapt(XMarkIcon);

/* 앱의 두 패널 분할 아이콘. Heroicons의 ViewColumns는 3열이라 패널을 셋까지
   만들 수 있는 것처럼 보인다 — 작업공간은 둘에서 멈춘다. */
export const Columns2 = ({ size, width, height, ...props }: IconProps) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={height ?? size ?? 24}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
    width={width ?? size ?? 24}
    {...props}
  >
    <rect height="15" rx="1.25" width="7.5" x="3.25" y="4.5" />
    <rect height="15" rx="1.25" width="7.5" x="13.25" y="4.5" />
  </svg>
);

/* 물망초 마크. 잎의 위치·각도·크기는 로고 원본 그대로다 — 균등한 72°가 아니라
   미세하게 어긋난 배치가 이 마크의 성격이라 손대지 않는다.
   정본은 desktop/src/components/SubnotaMark.tsx. viewBox·path·강조 잎 인덱스가
   그쪽과 같아야 한다. */
const PETAL =
  'M0,-4 C-10,-11 -15,-30 -11,-41 C-8,-48 8,-48 11,-41 C15,-30 10,-11 0,-4 C0,-4 0,-4 0,-4';

const PETAL_PLACEMENTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [49.7, 47, -6, 1.04],
  [52.8, 48.9, 68, 0.97],
  [51.7, 52.5, 145, 1.06],
  [48.5, 52.6, 210, 0.98],
  [47.2, 48.9, 292, 1.02],
];

/** 오른쪽 잎 하나만 다른 색이다(말라카이트). */
const ACCENT_PETAL = 1;

export function SubnotaMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 100 100"
      width={size}
    >
      {PETAL_PLACEMENTS.map(([x, y, rotate, scale], index) => (
        <path
          d={PETAL}
          fill={
            index === ACCENT_PETAL
              ? 'var(--app-color-brand-petal, #0b6e4f)'
              : undefined
          }
          key={index}
          transform={`translate(${x},${y}) rotate(${rotate}) scale(${scale})`}
        />
      ))}
    </svg>
  );
}
