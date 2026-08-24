import { useMemo } from 'react';
import { Modal } from '@mantine/core';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import {
  MIN_MEMOS_FOR_REPORT,
  MonthlyReport,
  hasKnowledgeSection,
  hasTopicSection,
  monthMeta,
} from './monthlyReport';
import { getUiDateLocale, localize, useUiLanguage } from '../../lib/uiLanguage';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: MonthlyReport;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  canGoNext: boolean;
}

// 잔디 5단계(0 = 기록 없음). 값은 그 달 최대치에 대한 상대 비율로 정한다.
// 단계는 투명도가 아니라 색으로 구분한다 — 한 색을 흐리게 깔면 강약이 안 읽히고
// 브랜드색을 데이터에 쓰게 된다. 실제 색은 --app-color-data-* 가 갖는다.
const LEVELS = [1, 2, 3, 4, 5];

const levelOf = (count: number, max: number) => {
  if (count <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));
};

const Delta = ({ value, unit }: { value: number; unit: string }) => {
  const language = useUiLanguage();
  if (value === 0) {
    return <span className="report-delta">{localize(language, '지난달과 같음', 'Same as last month')}</span>;
  }
  const isUp = value > 0;
  return (
    <span className="report-delta">
      <b className={isUp ? 'up' : ''}>
        {isUp ? '▲' : '▼'} {Math.abs(value)}
        {unit}
      </b>{' '}
      {localize(language, '지난달보다', 'from last month')}
    </span>
  );
};

const Stat = ({
  value,
  unit,
  label,
  delta,
}: {
  value: number;
  unit: string;
  label: string;
  delta: number;
}) => (
  <div>
    <div className="report-stat-value">
      {value}
      <i>{unit}</i>
    </div>
    <div className="report-stat-label">{label}</div>
    <Delta unit={unit} value={delta} />
  </div>
);

const MonthlyReportModal = ({
  isOpen,
  onClose,
  report,
  onPrevMonth,
  onNextMonth,
  canGoNext,
}: MonthlyReportModalProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const dateLocale = getUiDateLocale(language);
  const isEmpty = report.memoCount < MIN_MEMOS_FOR_REPORT;
  const { firstWeekday } = monthMeta(report.monthKey);
  const weekStartsOn = useMemo(() => {
    const locale = new Intl.Locale(dateLocale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
    };
    const firstDay = locale.getWeekInfo?.().firstDay;
    return (firstDay === undefined ? (language === 'en' ? 1 : 0) : firstDay % 7) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6;
  }, [dateLocale, language]);
  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, 7 + ((weekStartsOn + index) % 7))),
    );
  }, [dateLocale, weekStartsOn]);
  const [year, month] = report.monthKey.split('-').map(Number);
  const monthLabel = new Intl.DateTimeFormat(dateLocale, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
  const maxDaily = Math.max(1, ...report.dailyCounts);
  const maxTopic = Math.max(1, ...report.topics.map(topic => topic.current));
  const previousEdges = Math.max(0, report.totalEdgeCount - report.newEdgeCount);
  const newEdgeRatio = report.totalEdgeCount
    ? (report.newEdgeCount / report.totalEdgeCount) * 100
    : 0;

  return (
    <Modal centered onClose={onClose} opened={isOpen} shadow="md" size="lg" title={null} withCloseButton>
      <div className="monthly-report">
        <header className="report-header">
          <button aria-label={t('이전 달', 'Previous month')} className="report-nav" onClick={onPrevMonth} type="button">
            <ChevronLeft size={18} />
          </button>
          <h2>{monthLabel}</h2>
          <button
            aria-label={t('다음 달', 'Next month')}
            className="report-nav"
            disabled={!canGoNext}
            onClick={onNextMonth}
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </header>

        {isEmpty ? (
          <p className="report-empty">{t('아직 정리할 기록이 많지 않아요.', 'There are not enough notes to summarize yet.')}</p>
        ) : (
          <>
            <div className="report-heatmap" role="img" aria-label={t(`이 달에 ${report.activeDays}일 기록했습니다`, `You recorded on ${report.activeDays} days this month`)}>
              {weekdays.map(day => (
                <span className="report-heatmap-weekday" key={day}>
                  {day}
                </span>
              ))}
              {Array.from({ length: (firstWeekday - weekStartsOn + 7) % 7 }, (_, index) => (
                <span aria-hidden className="report-cell empty" key={`pad-${index}`} />
              ))}
              {report.dailyCounts.map((count, index) => (
                <span
                  className="report-cell"
                  data-level={LEVELS[levelOf(count, maxDaily)]}
                  key={index}
                  title={t(
                    `${index + 1}일 · ${count}건`,
                    `${new Intl.DateTimeFormat(dateLocale, {
                      day: 'numeric',
                      month: 'short',
                    }).format(new Date(year, month - 1, index + 1))} · ${count} items`,
                  )}
                />
              ))}
            </div>

            <div className="report-legend">
              <span>{t('적음', 'Less')}</span>
              {LEVELS.map(level => (
                <i className="report-legend-cell" data-level={level} key={level} />
              ))}
              <span>{t('많음', 'More')}</span>
            </div>

            <div className="report-stats">
              <Stat delta={report.activeDaysDelta} label={t('기록한 날', 'Active days')} unit={t('일', '')} value={report.activeDays} />
              <Stat delta={report.memoDelta} label={t('쌓인 메모', 'Memos')} unit={t('개', '')} value={report.memoCount} />
              <Stat delta={report.completedDelta} label={t('해낸 일', 'Completed')} unit={t('개', '')} value={report.completedCount} />
            </div>

            {hasTopicSection(report) && (
              <>
                <p className="report-section">{t('대표 주제', 'Top topics')}</p>
                <p className="report-hint">{t('원 크기 = 이번 달 메모 수 · 아래는 지난달 대비', 'Circle size = memos this month · numbers compare with last month')}</p>
                <div className="report-topics">
                  {report.topics.map(topic => {
                    const radius = Math.max(16, 38 * Math.sqrt(topic.current / maxTopic));
                    const delta = topic.current - topic.previous;
                    return (
                      <div className="report-topic" key={topic.label}>
                        <svg aria-hidden height="84" viewBox="0 0 84 84" width="84">
                          <circle cx="42" cy="42" fill="var(--app-color-action-primary)" r={radius} />
                          <text
                            dominantBaseline="central"
                            fill="var(--app-color-action-primary-text)"
                            fontSize="14"
                            fontWeight="800"
                            textAnchor="middle"
                            x="42"
                            y="43"
                          >
                            {topic.current}
                          </text>
                        </svg>
                        <span className="report-topic-label">{topic.label}</span>
                        <span className="report-topic-delta">
                          {delta !== 0 && (
                            <b className={delta > 0 ? 'up' : ''}>
                              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                            </b>
                          )}
                          {topic.isNew && <i className="report-topic-new">NEW</i>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {hasKnowledgeSection(report) && (
              <div className="report-card">
                <p className="report-card-title">{t('넓어진 지식', 'Knowledge growth')}</p>
                {report.newTopics.length > 0 && (
                  <div className="report-card-line">
                    <span className="report-card-key">{t('새 주제', 'New topics')}</span>
                    <span className="report-chips">
                      {report.newTopics.map(label => (
                        <i className="report-chip" key={label}>
                          {label}
                        </i>
                      ))}
                      {report.newTopicOverflow > 0 && (
                        <i className="report-chip-more">{t(`외 ${report.newTopicOverflow}개`, `${report.newTopicOverflow} more`)}</i>
                      )}
                    </span>
                  </div>
                )}
                {report.newEdgeCount > 0 && (
                  <div className="report-card-line">
                    <span className="report-card-key">{t('연결', 'Connections')}</span>
                    <span className="report-bar-wrap">
                      <span className="report-bar">
                        <i className="report-bar-old" style={{ width: `${100 - newEdgeRatio}%` }} />
                        <i className="report-bar-new" style={{ width: `${newEdgeRatio}%` }} />
                      </span>
                      <span className="report-bar-label">
                        <span>{t(`지난달까지 ${previousEdges}개`, `${previousEdges} before this month`)}</span>
                        <span>
                          <b>+{report.newEdgeCount}</b> {t(`늘어 ${report.totalEdgeCount}개`, `to ${report.totalEdgeCount}`)}
                        </span>
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {report.hubMemo && (
              <div className="report-note">
                <i aria-hidden className="report-note-bar" />
                <div>
                  <p className="report-note-title-label">{t('대표 메모', 'Representative memo')}</p>
                  <p className="report-note-title">{report.hubMemo.title}</p>
                  <p className="report-note-sub">
                    {t(
                      `다른 메모 ${report.hubMemo.degree}개와 이어진, 이번 달 가장 중심이 된 노트`,
                      `Connected to ${report.hubMemo.degree} other memos, this month's most central note`,
                    )}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default MonthlyReportModal;
