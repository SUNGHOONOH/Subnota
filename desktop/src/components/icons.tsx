import type { ComponentType, SVGProps } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  Bars3BottomLeftIcon,
  CalendarDaysIcon,
  LinkIcon,
  CheckCircleIcon,
  CheckIcon,
  CommandLineIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  CloudIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  FolderIcon,
  FolderOpenIcon,
  HeartIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PencilSquareIcon,
  PlusIcon,
  ShareIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
  UserCircleIcon,
  ViewfinderCircleIcon,
  WindowIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  DocumentTextIcon as DocumentTextSolidIcon,
  FolderIcon as FolderSolidIcon,
  MagnifyingGlassIcon as MagnifyingGlassSolidIcon,
  PencilSquareIcon as PencilSquareSolidIcon,
} from '@heroicons/react/24/solid';

// Heroicons size via width/height, but the app calls icons lucide-style with a
// `size` prop. This adapter re-exports Heroicons under the lucide names the app
// already uses and maps `size` -> width/height, so call sites stay unchanged.
type IconProps = Omit<SVGProps<SVGSVGElement>, 'size'> & {
  size?: number | string;
};

const adapt = (Base: ComponentType<SVGProps<SVGSVGElement>>) => {
  const Icon = ({ size, width, height, ...props }: IconProps) => (
    <Base
      width={width ?? size ?? 24}
      height={height ?? size ?? 24}
      aria-hidden="true"
      {...props}
    />
  );
  Icon.displayName = `Icon(${Base.displayName ?? Base.name ?? 'Heroicon'})`;
  return Icon;
};

// Direct matches.
export const AppWindow = adapt(WindowIcon);
export const CalendarDays = adapt(CalendarDaysIcon);
export const ChartBar = adapt(ChartBarIcon);
export const Check = adapt(CheckIcon);
export const Cloud = adapt(CloudIcon);
export const CheckCircle2 = adapt(CheckCircleIcon);
export const CommandLine = adapt(CommandLineIcon);
export const ChevronDown = adapt(ChevronDownIcon);
export const ChevronUp = adapt(ChevronUpIcon);
export const ChevronLeft = adapt(ChevronLeftIcon);
export const ChevronRight = adapt(ChevronRightIcon);
export const ExternalLink = adapt(ArrowTopRightOnSquareIcon);
export const Eye = adapt(EyeIcon);
export const EyeOff = adapt(EyeSlashIcon);
export const Folder = adapt(FolderIcon);
export const FolderOpen = adapt(FolderOpenIcon);
export const Heart = adapt(HeartIcon);
export const Inbox = adapt(InboxIcon);
export const LogOut = adapt(ArrowRightStartOnRectangleIcon);
export const Mail = adapt(EnvelopeIcon);
export const Minus = adapt(MinusIcon);
export const MoreHorizontal = adapt(EllipsisHorizontalIcon);
export const NotebookText = adapt(DocumentTextIcon);
export const Plus = adapt(PlusIcon);
export const RefreshCw = adapt(ArrowPathIcon);
export const Search = adapt(MagnifyingGlassIcon);
export const Settings = adapt(Cog6ToothIcon);
export const Sparkles = adapt(SparklesIcon);
export const Topics = adapt(Squares2X2Icon);
export const Trash2 = adapt(TrashIcon);
export const UserCircle = adapt(UserCircleIcon);
export const FocusNode = adapt(ViewfinderCircleIcon);
export const X = adapt(XMarkIcon);
export const XCircle = adapt(XCircleIcon);

export const Tree = ({ size, width, height, ...props }: IconProps) => (
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
    <path d="M12 3 7.5 9h2.25l-3 4.25h3.5L8.5 17h7l-1.75-3.75h3.5L14.25 9h2.25z" />
    <path d="M12 17v4M9.5 21h5" />
  </svg>
);
Tree.displayName = 'Icon(Tree)';

// Solid variants for selected/active states (outline reads too faint there).
export const NotebookTextSolid = adapt(DocumentTextSolidIcon);
export const StickyNoteSolid = adapt(PencilSquareSolidIcon);
export const SearchSolid = adapt(MagnifyingGlassSolidIcon);
export const FolderSolid = adapt(FolderSolidIcon);

// Heroicons has no thumbtack; hand-drawn push-pin matching the 24px/1.5 stroke
// outline style. `PinSolid` is the filled active state.
const PIN_PATH =
  'M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z';

const makePinIcon = (filled: boolean) => {
  const Icon = ({ size, width, height, ...props }: IconProps) => (
    <svg
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      height={height ?? size ?? 24}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      width={width ?? size ?? 24}
      {...props}
    >
      <path d={PIN_PATH} />
    </svg>
  );
  Icon.displayName = filled ? 'Icon(PinSolid)' : 'Icon(Pin)';
  return Icon;
};

export const Pin = makePinIcon(false);
export const PinSolid = makePinIcon(true);

// Closest available Heroicons (no exact equivalent in the set).
export const CalendarPlus = adapt(CalendarDaysIcon);
/** Two-pane split affordance. ViewColumnsIcon has three columns, which makes
 * the action look like it can create three panes even though the workspace
 * intentionally caps at two. */
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
Columns2.displayName = 'Icon(Columns2)';
export const ClipboardCopy = adapt(ClipboardDocumentIcon);
export const Copy = adapt(DocumentDuplicateIcon);
export const Download = adapt(ArrowDownTrayIcon);
export const Link = adapt(LinkIcon);
export const List = adapt(Bars3BottomLeftIcon);
export const Network = adapt(ShareIcon);
export const StickyNote = adapt(PencilSquareIcon);
export const PanelLeft = adapt(ChevronDoubleRightIcon);
export const PanelLeftClose = adapt(ChevronDoubleLeftIcon);
export const PanelRight = adapt(ChevronDoubleLeftIcon);
export const PanelRightClose = adapt(ChevronDoubleRightIcon);
