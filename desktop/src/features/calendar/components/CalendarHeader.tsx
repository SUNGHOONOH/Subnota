import type { UiLanguage } from '../../../lib/appSettings';
import { localize } from '../../../lib/uiLanguage';
import {
  ChartBar,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from '../../../components/icons';
import TooltipIconButton from '../../../components/TooltipIconButton';

export type CalendarView = 'week' | 'month';

interface CalendarHeaderProps {
  hasNewReport: boolean;
  isScheduleInboxOpen: boolean;
  language: UiLanguage;
  onChangeView: (view: CalendarView) => void;
  onNext: () => void;
  onOpenReport?: () => void;
  onPrevious: () => void;
  onToday: () => void;
  onToggleScheduleInbox?: () => void;
  title: string;
  view: CalendarView;
}

const CalendarHeader = ({
  hasNewReport,
  isScheduleInboxOpen,
  language,
  onChangeView,
  onNext,
  onOpenReport,
  onPrevious,
  onToday,
  onToggleScheduleInbox,
  title,
  view,
}: CalendarHeaderProps) => {
  const t = (korean: string, english: string) => localize(language, korean, english);

  return (
    <div className="cal-header">
      <h2 className="cal-title">{title}</h2>

      <div className="cal-toolbar">
        <div aria-label={t('캘린더 보기', 'Calendar view')} className="cal-views" role="group">
          {(['week', 'month'] as CalendarView[]).map(key => (
            <button
              aria-pressed={view === key}
              className={view === key ? 'active' : ''}
              key={key}
              onClick={() => onChangeView(key)}
              type="button"
            >
              {key === 'week' ? t('주', 'Week') : t('월', 'Month')}
            </button>
          ))}
        </div>

        <div aria-label={t('캘린더 이동', 'Calendar navigation')} className="cal-nav" role="group">
          <button
            aria-label={t('이전', 'Previous')}
            className="cal-nav-icon"
            onClick={onPrevious}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button className="cal-today" onClick={onToday} type="button">
            {t('오늘', 'Today')}
          </button>
          <button
            aria-label={t('다음', 'Next')}
            className="cal-nav-icon"
            onClick={onNext}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {/* 아이콘만 있는 버튼이라 이름이 필요하다. 네이티브 title은 1초쯤
          지나서야 뜨고 OS 모양이라, 앱 공용 툴팁으로 통일한다. */}
      {onToggleScheduleInbox && (
        <TooltipIconButton
          aria-label={t('일정 저장함', 'Schedule inbox')}
          aria-pressed={isScheduleInboxOpen}
          className={`cal-inbox-button${isScheduleInboxOpen ? ' active' : ''}`}
          onClick={onToggleScheduleInbox}
          tooltip={
            isScheduleInboxOpen
              ? t('일정 저장함 닫기', 'Close schedule inbox')
              : t('일정 저장함', 'Schedule inbox')
          }
        >
          <Inbox size={18} />
        </TooltipIconButton>
      )}
      {onOpenReport && (
        <TooltipIconButton
          aria-label={t('월간 기록', 'Monthly report')}
          className={`cal-report-button${hasNewReport ? ' has-new' : ''}`}
          onClick={onOpenReport}
          tooltip={
            hasNewReport
              ? t('월간 기록 · 새 기록 있음', 'Monthly report · new report available')
              : t('월간 기록', 'Monthly report')
          }
        >
          <ChartBar size={18} />
          {hasNewReport && <span aria-hidden className="cal-report-dot" />}
        </TooltipIconButton>
      )}
    </div>
  );
};

export default CalendarHeader;
