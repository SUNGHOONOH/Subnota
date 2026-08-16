import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Group, Pagination } from '@mantine/core';
import { format } from 'date-fns';

import { Check, X } from '@/components/icons';
import { ScheduleInboxRow } from '../../types';
import DateSchedulePopover from '../memo/components/DateSchedulePopover';
import DateScheduleField from '../memo/components/DateScheduleField';
import { validDate } from '../memo/components/dateScheduleTime';
import { toValidDate } from '../../lib/viewCrashGuards';
import {
  ANCHORED_MODAL_MIN_HEIGHT,
  getAnchoredPlacement,
} from '../../lib/anchoredPlacement';
import { SCHEDULE_INBOX_DRAG_TYPE } from '../calendar/calendarUtils';
import {
  hasScheduledTime,
  requiresSchedulePicker,
} from './scheduleInboxUtils';
import EmptyState from '../../components/EmptyState';
import { getUiDateLocale, localize, useUiLanguage } from '../../lib/uiLanguage';

interface ScheduleInboxWorkspaceProps {
  compact?: boolean;
  inboxItems: ScheduleInboxRow[];
  onDeleteInbox: (item: ScheduleInboxRow) => void;
  onPlaceInbox: (item: ScheduleInboxRow) => void;
}

// A candidate "has a time" only when it is not all-day and the extractor found a
// time phrase. Otherwise approving it opens the mini calendar to pick one.
const PAGE_SIZE = 6;

const formatScheduleDate = (item: ScheduleInboxRow, language: 'en' | 'ko') => {
  const date = toValidDate(item.scheduled_at);
  if (!date) {
    return localize(language, '날짜 확인 필요', 'Date needs review');
  }
  const locale = getUiDateLocale(language);
  if (!hasScheduledTime(item)) {
    return `${new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }).format(date)} · ${localize(language, '시간 미정', 'Time not set')}`;
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    weekday: 'short',
  }).format(date);
};

const ScheduleInboxWorkspace = ({
  compact = false,
  inboxItems,
  onDeleteInbox,
  onPlaceInbox,
}: ScheduleInboxWorkspaceProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const [editingInbox, setEditingInbox] = useState<ScheduleInboxRow | null>(null);
  const [editingTime, setEditingTime] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [approvingItem, setApprovingItem] = useState<ScheduleInboxRow | null>(
    null,
  );
  // 누른 행의 사각형. 캘린더의 일정 편집 창과 같은 규칙으로 그 옆에 붙는다 —
  // 가운데 모달은 어디를 눌렀는지와 창이 뜨는 자리가 무관해 맥락이 끊긴다.
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [anchoredHeight, setAnchoredHeight] = useState(
    ANCHORED_MODAL_MIN_HEIGHT,
  );
  const anchoredRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(inboxItems.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pagedItems = inboxItems.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const openInboxEditor = useCallback(
    (item: ScheduleInboxRow, anchor?: HTMLElement | null) => {
      const scheduledAt = toValidDate(item.scheduled_at) ?? new Date();

      setAnchorRect(anchor?.getBoundingClientRect() ?? null);
      setAnchoredHeight(ANCHORED_MODAL_MIN_HEIGHT);
      setEditingInbox(item);
      setEditingTitle(item.title);
      setEditingTime(format(scheduledAt, "yyyy-MM-dd'T'HH:mm"));
    },
    [],
  );

  const anchoredPlacement = useMemo(
    () => getAnchoredPlacement(anchorRect, anchoredHeight),
    [anchorRect, anchoredHeight],
  );

  // 본문이 길어지면 창도 길어진다. 높이를 모른 채 세로 가운데를 맞추면
  // 앵커에서 어긋나므로 실측해서 배치에 반영한다.
  useEffect(() => {
    const node = anchoredRef.current;
    if (!editingInbox || !anchorRect || !node) return undefined;

    const observer = new ResizeObserver(() => {
      setAnchoredHeight(node.offsetHeight || ANCHORED_MODAL_MIN_HEIGHT);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [anchorRect, editingInbox]);

  useEffect(() => {
    const handleOpenScheduleItem = (event: Event) => {
      const { itemId } = (
        event as CustomEvent<{ itemId?: string }>
      ).detail ?? { itemId: undefined };
      const index = inboxItems.findIndex(item => item.id === itemId);
      if (index < 0) return;
      setPage(Math.floor(index / PAGE_SIZE) + 1);
      openInboxEditor(inboxItems[index]);
    };

    window.addEventListener(
      'subnota:open-schedule-inbox-item',
      handleOpenScheduleItem,
    );
    return () =>
      window.removeEventListener(
        'subnota:open-schedule-inbox-item',
        handleOpenScheduleItem,
      );
  }, [inboxItems, openInboxEditor]);

  // 바깥 클릭으로는 닫지 않으므로, 키보드만 쓰는 사용자에게 Esc가 유일한
  // 퇴로다. 이것까지 없으면 취소 버튼에 도달할 때까지 창에 갇힌다.
  useEffect(() => {
    if (!editingInbox) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditingInbox(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingInbox]);

  const acceptEditedInbox = () => {
    if (!editingInbox) {
      return;
    }

    const scheduledAt = new Date(editingTime);
    if (!validDate(scheduledAt)) {
      return;
    }

    onPlaceInbox({
      ...editingInbox,
      scheduled_at: scheduledAt.toISOString(),
      title: editingTitle.trim() || editingInbox.title,
    });
    setEditingInbox(null);
  };

  // 날짜·시간이 유효하면 바로 배치한다. 날짜가 없거나 시간이 미정이면
  // 버튼을 막지 않고 팝오버에서 사용자가 직접 고친 뒤 배치한다.
  const handlePlace = (item: ScheduleInboxRow) => {
    if (!requiresSchedulePicker(item)) {
      onPlaceInbox(item);
    } else {
      setApprovingItem(item);
    }
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLElement>,
    item: ScheduleInboxRow,
  ) => {
    event.dataTransfer.setData(SCHEDULE_INBOX_DRAG_TYPE, item.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`schedule-inbox-layout${compact ? ' compact' : ''}`}
    >
      {/* 사이드 패널에는 이미 "일정 저장함" 헤더가 있어 중복이다.
          브리핑 탭에서는 이 줄이 유일한 제목이라 그대로 둔다. */}
      {!compact && (
        <div className="schedule-approve-header">
          <strong>{t('저장할 일정', 'Scheduled items')}</strong>
          <span className="count">{inboxItems.length}</span>
          <span className="hint">{t('날짜를 정해야 하는 일정 후보예요', 'Schedule suggestions that need a date')}</span>
        </div>
      )}

      <div className="schedule-approve-list">
        {inboxItems.length === 0 && (
          <EmptyState
            body={t('메모에서 날짜 표현을 찾으면 여기로 옵니다.', 'Date expressions found in memos appear here.')}
            title={t('정할 일정이 없습니다', 'No schedules to place')}
          />
        )}
        {/* 배치하거나 지우면 아래 행들이 순간이동했다. layout="position"이
            그 자리를 메우는 과정을 보여 준다 — "position"인 이유는 크기까지
            보간하면 행 안의 글자가 늘어났다 줄었다 하기 때문이다.
            AnimatePresence는 map 바깥에 둔다(docs/design.md). */}
        <AnimatePresence initial={false}>
        {pagedItems.map(item => (
          <motion.article
            className="schedule-approve-row"
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.96 }
            }
            key={item.id}
            layout={shouldReduceMotion ? false : 'position'}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.18, ease: 'easeOut' }
            }
          >
            {/* 행 전체가 수정으로 이어진다. 배치·삭제만 hover 아이콘으로 남긴다
                — 그 둘은 행 클릭으로 대신할 수 없는 동작이라서다. 수정은 행이
                이미 하는 일이라 ✎를 더하면 중복이고, 좁은 패널에서 제목 폭만
                줄어든다. 옆 미리보기 패널의 .preview-list-row와 같은 규칙.

                draggable을 감싼 요소가 아니라 이 버튼에 직접 건다. 캘린더의
                .cal-event(CalendarWorkspace.tsx)와 같은 방식이고, 버튼 위에서
                시작한 드래그가 조상으로 올라가기를 기대하지 않아도 된다. */}
            <button
              className="schedule-approve-open"
              draggable
              onClick={event => openInboxEditor(item, event.currentTarget)}
              onDragStart={event => handleDragStart(event, item)}
              title={t('클릭해 시간·제목 수정 · 주간 캘린더로 드래그해 배치', 'Click to edit time and title · drag to the weekly calendar to place')}
              type="button"
            >
              <span
                className={`schedule-approve-meta${
                  requiresSchedulePicker(item) ? ' needs' : ''
                }`}
              >
                {formatScheduleDate(item, language)}
              </span>
              <strong className="schedule-approve-text">{item.title}</strong>
            </button>
            <div className="schedule-approve-row-actions">
              <button
                aria-label={t('캘린더에 배치', 'Place on calendar')}
                onClick={() => handlePlace(item)}
                title={t('캘린더에 배치', 'Place on calendar')}
                type="button"
              >
                <Check size={14} />
              </button>
              <button
                aria-label={t('삭제', 'Delete')}
                className="danger"
                onClick={() => onDeleteInbox(item)}
                title={t('삭제', 'Delete')}
                type="button"
              >
                <X size={14} />
              </button>
            </div>
            {approvingItem?.id === item.id && (
              <div className="schedule-approve-picker">
                <DateSchedulePopover
                  confirmLabel={t('캘린더에 배치', 'Place on calendar')}
                  initialDate={toValidDate(item.scheduled_at)}
                  onApplyDate={(date, allDay) => {
                    onPlaceInbox({
                      ...item,
                      scheduled_at: date.toISOString(),
                      all_day: allDay,
                    });
                    setApprovingItem(null);
                  }}
                  onClose={() => setApprovingItem(null)}
                />
              </div>
            )}
          </motion.article>
        ))}
        </AnimatePresence>
      </div>

      {pageCount > 1 && (
        <Group justify="center" mt="md">
          <Pagination onChange={setPage} size="sm" total={pageCount} value={current} />
        </Group>
      )}

      {/* body로 포털한다. 이 컴포넌트는 .app-side-panel-slot 안에서 렌더되는데
          그 슬롯이 `position: fixed; z-index: 45`라 스택 컨텍스트를 만든다.
          그 안에 두면 backdrop의 z-index 50이 슬롯 내부 순서일 뿐이어서,
          패널 전체가 z-45 한 겹으로 합쳐져 캘린더 이벤트가 모달 위에 그려진다.
          DateScheduleField가 팝오버를 포털하는 이유와 같다.

          포털이 AnimatePresence "바깥"이어야 한다. 반대로 감싸면
          AnimatePresence의 자식이 ReactPortal이 되는데, framer-motion은 자식을
          cloneElement로 감싸 존재를 추적하므로 포털은 그 대상이 될 수 없다 —
          창이 아예 그려지지 않는다. 포털은 항상 떠 있고, 그 안에서
          AnimatePresence가 내용의 등장·퇴장을 맡는다. */}
      {createPortal(
        <AnimatePresence>
          {editingInbox && (
            <motion.div
              key="schedule-inbox-editor"
              animate={{ opacity: 1 }}
              /* 앵커에 붙을 때는 배경을 어둡게 덮지 않는다 — 옆에 붙는 창은
                 목록을 계속 보면서 고치라고 있는 것이라 가리면 뜻이 없다.
                 대신 클릭은 그대로 받아 낸다. */
              className={
                anchoredPlacement
                  ? 'modal-backdrop detail-backdrop anchored'
                  : 'modal-backdrop detail-backdrop'
              }
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              /* 바깥 클릭으로 닫지 않는다. 저장을 명시적으로 받는 창이라
                 닫는 것도 명시적이어야 한다 — 나가는 길은 취소와 Esc뿐이다. */
              role="presentation"
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.14, ease: 'easeOut' }
              }
            >
              {/* 캘린더의 일정 모달과 같은 템플릿이다. 하는 일이 같은 창이
                  따로 생기지 않도록 클래스까지 공유한다 — 여기는 색·메모·삭제가
                  없어 같은 규격이 자연스럽게 짧아질 뿐이다. */}
              {/* 앵커가 있으면 누른 행 옆에서, 없으면 가운데에서 자란다.
                  자라는 방향(transform-origin)이 어디를 눌렀는지 말해 준다 —
                  페이드만으로는 출처를 알 수 없다. 캘린더의 일정 편집 창과
                  같은 클래스·같은 계산(getAnchoredPlacement)을 쓴다. */}
              <motion.section
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                className={
                  anchoredPlacement
                    ? `cal-modal anchored ${anchoredPlacement.side}`
                    : 'cal-modal'
                }
                exit={
                  anchoredPlacement
                    ? { opacity: 0, scale: 0.96 }
                    : { opacity: 0, scale: 0.99, y: -6 }
                }
                initial={
                  anchoredPlacement
                    ? {
                        opacity: 0,
                        scale: 0.94,
                        x: anchoredPlacement.side === 'right' ? -6 : 6,
                      }
                    : { opacity: 0, scale: 0.99, y: -8 }
                }
                ref={anchoredRef}
                style={
                  anchoredPlacement
                    ? {
                        left: anchoredPlacement.left,
                        position: 'fixed',
                        top: anchoredPlacement.top,
                        width: anchoredPlacement.width,
                        ['--cal-modal-tail-top' as string]:
                          `${anchoredPlacement.tailTop}px`,
                      }
                    : undefined
                }
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.18, ease: 'easeOut' }
                }
              >
              <header className="cal-modal-head">
                <input
                  aria-label={t('일정 제목', 'Event title')}
                  autoFocus
                  className="cal-modal-title"
                  onChange={event => setEditingTitle(event.target.value)}
                  placeholder={t('일정 수정', 'Edit event')}
                  value={editingTitle}
                />
              </header>
              <div className="cal-modal-rows">
                <div className="cal-modal-row">
                  <DateScheduleField
                    allDay={false}
                    date={new Date(editingTime)}
                    label={null}
                    onChange={date =>
                      setEditingTime(format(date, "yyyy-MM-dd'T'HH:mm"))
                    }
                  />
                </div>
              </div>
              <footer className="cal-modal-foot">
                <p className="cal-modal-hint">
                  {t('원문', 'Source')} · {editingInbox.source_text}
                </p>
                <div className="cal-modal-actions">
                  <button
                    className="cal-btn ghost"
                    onClick={() => setEditingInbox(null)}
                    type="button"
                  >
                    {t('취소', 'Cancel')}
                  </button>
                  {/* 라벨은 "등록" 하나로 충분하다 — 고치는 것은 이 창이 하는
                      일이라 버튼이 다시 말할 필요가 없다. */}
                  <button
                    className="cal-btn primary"
                    onClick={acceptEditedInbox}
                    type="button"
                  >
                    {t('등록', 'Add')}
                  </button>
                </div>
                </footer>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

export default ScheduleInboxWorkspace;
