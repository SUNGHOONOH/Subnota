import { useState } from 'react';
import { Group, Pagination } from '@mantine/core';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

import { CalendarDays } from '@/components/icons';
import { ScheduleInboxRow } from '../../types';
import DateSchedulePopover from '../memo/components/DateSchedulePopover';
import DateScheduleField from '../memo/components/DateScheduleField';
import { validDate } from '../memo/components/dateScheduleTime';
import { toValidDate } from '../../lib/viewCrashGuards';

interface BriefingWorkspaceProps {
  inboxItems: ScheduleInboxRow[];
  onAcceptInbox: (item: ScheduleInboxRow) => void;
  onDismissInbox: (item: ScheduleInboxRow) => void;
}

// A candidate "has a time" only when it is not all-day and the extractor found a
// time phrase. Otherwise approving it opens the mini calendar to pick one.
const PAGE_SIZE = 6;

const hasScheduledTime = (item: ScheduleInboxRow) =>
  !item.all_day && item.time_text !== null;

const formatScheduleDate = (item: ScheduleInboxRow) => {
  const date = toValidDate(item.scheduled_at);
  if (!date) {
    return '날짜 확인 필요';
  }
  if (!hasScheduledTime(item)) {
    return `${format(date, 'M월 d일 (EEE)', { locale: ko })} · 시간 미정`;
  }
  return format(date, 'M월 d일 (EEE) · a h:mm', { locale: ko });
};

const formatCreatedAgo = (value: string) => {
  const date = toValidDate(value);
  return date
    ? formatDistanceToNow(date, { addSuffix: true, locale: ko })
    : '생성일 확인 필요';
};

const BriefingWorkspace = ({
  inboxItems,
  onAcceptInbox,
  onDismissInbox,
}: BriefingWorkspaceProps) => {
  const [editingInbox, setEditingInbox] = useState<ScheduleInboxRow | null>(null);
  const [editingTime, setEditingTime] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [approvingItem, setApprovingItem] = useState<ScheduleInboxRow | null>(
    null,
  );
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(inboxItems.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pagedItems = inboxItems.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const openInboxEditor = (item: ScheduleInboxRow) => {
    const scheduledAt = new Date(item.scheduled_at);

    setEditingInbox(item);
    setEditingTitle(item.title);
    setEditingTime(format(scheduledAt, "yyyy-MM-dd'T'HH:mm"));
  };

  const acceptEditedInbox = () => {
    if (!editingInbox) {
      return;
    }

    const scheduledAt = new Date(editingTime);
    if (!validDate(scheduledAt)) {
      return;
    }

    onAcceptInbox({
      ...editingInbox,
      scheduled_at: scheduledAt.toISOString(),
      title: editingTitle.trim() || editingInbox.title,
    });
    setEditingInbox(null);
  };

  // 승인: 시간이 있으면 바로 등록, 없으면 미니 캘린더로 날짜를 먼저 받는다.
  const handleApprove = (item: ScheduleInboxRow) => {
    if (hasScheduledTime(item)) {
      onAcceptInbox(item);
    } else {
      setApprovingItem(item);
    }
  };

  return (
    <div className="briefing-layout">
      <div className="schedule-approve-header">
        <strong>저장할 일정</strong>
        <span className="count">{inboxItems.length}</span>
        <span className="hint">메모에서 찾은 일정 후보예요</span>
      </div>

      <div className="schedule-approve-list">
        {inboxItems.length === 0 && (
          <p className="empty-text">아직 쌓인 일정 후보가 없습니다.</p>
        )}
        {pagedItems.map(item => (
          <article className="schedule-approve-card" key={item.id}>
            <div className="schedule-approve-title-row">
              <strong className="schedule-approve-title">{item.title}</strong>
              <span className="schedule-approve-ago">
                {formatCreatedAgo(item.created_at)}
              </span>
            </div>
            <div className="schedule-approve-date">
              <CalendarDays size={14} />
              {formatScheduleDate(item)}
            </div>
            <p className="schedule-approve-body">{item.source_text}</p>
            <div className="schedule-approve-actions">
              <button
                className="approve-btn"
                onClick={() => handleApprove(item)}
                type="button"
              >
                승인
              </button>
              <button
                className="edit-btn"
                onClick={() => openInboxEditor(item)}
                type="button"
              >
                수정
              </button>
              <button
                className="reject-btn"
                onClick={() => onDismissInbox(item)}
                type="button"
              >
                거절
              </button>
            </div>
            {approvingItem?.id === item.id && (
              <div className="schedule-approve-picker">
                <DateSchedulePopover
                  onApplyDate={(date, allDay) => {
                    onAcceptInbox({
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
          </article>
        ))}
      </div>

      {pageCount > 1 && (
        <Group justify="center" mt="md">
          <Pagination onChange={setPage} size="sm" total={pageCount} value={current} />
        </Group>
      )}

      {editingInbox && (
        <div className="modal-backdrop detail-backdrop" role="presentation">
          <section className="detail-panel compact-sheet">
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">일정 후보</p>
                <h2>시간 / 제목 수정</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => setEditingInbox(null)}
                type="button"
              >
                닫기
              </button>
            </div>
            <label>
              제목
              <input
                onChange={event => setEditingTitle(event.target.value)}
                value={editingTitle}
              />
            </label>
            <div className="sheet-field">
              <DateScheduleField
                allDay={false}
                date={new Date(editingTime)}
                label="시간"
                onChange={date =>
                  setEditingTime(format(date, "yyyy-MM-dd'T'HH:mm"))
                }
              />
            </div>
            <p className="empty-text">{editingInbox.source_text}</p>
            <div className="sheet-actions">
              <button
                className="primary-button"
                onClick={acceptEditedInbox}
                type="button"
              >
                수정해서 등록
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default BriefingWorkspace;
