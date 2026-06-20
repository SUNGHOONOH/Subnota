import type { ComponentType, SVGProps } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  LinkIcon,
  CheckCircleIcon,
  CheckIcon,
  CommandLineIcon,
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
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
  ViewColumnsIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

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
export const CalendarDays = adapt(CalendarDaysIcon);
export const Check = adapt(CheckIcon);
export const CheckCircle2 = adapt(CheckCircleIcon);
export const CommandLine = adapt(CommandLineIcon);
export const ChevronDown = adapt(ChevronDownIcon);
export const ChevronLeft = adapt(ChevronLeftIcon);
export const ChevronRight = adapt(ChevronRightIcon);
export const ExternalLink = adapt(ArrowTopRightOnSquareIcon);
export const Eye = adapt(EyeIcon);
export const EyeOff = adapt(EyeSlashIcon);
export const Inbox = adapt(InboxIcon);
export const LogOut = adapt(ArrowRightStartOnRectangleIcon);
export const Mail = adapt(EnvelopeIcon);
export const Minus = adapt(MinusIcon);
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

// Closest available Heroicons (no exact equivalent in the set).
export const CalendarPlus = adapt(CalendarDaysIcon);
export const Columns2 = adapt(ViewColumnsIcon);
export const Download = adapt(ArrowDownTrayIcon);
export const Link = adapt(LinkIcon);
export const Network = adapt(ShareIcon);
export const StickyNote = adapt(PencilSquareIcon);
export const PanelLeft = adapt(ChevronDoubleRightIcon);
export const PanelLeftClose = adapt(ChevronDoubleLeftIcon);
