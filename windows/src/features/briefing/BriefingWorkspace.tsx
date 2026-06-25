import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { CalendarDays } from '@/components/icons';
import { formatBriefingDate } from '../../lib/date';
import { BriefingRow, ScheduleInboxRow } from '../../types';
import DateSchedulePopover from '../memo/components/DateSchedulePopover';

interface BriefingWorkspaceProps {
  briefings: BriefingRow[];
  inboxItems: ScheduleInboxRow[];
  onAcceptInbox: (item: ScheduleInboxRow) => void;
  onDismissInbox: (item: ScheduleInboxRow) => void;
}

const getPreview = (content: string) => {
  const line =
    content
      .split('\n')
      .map(value => value.trim())
      .find(Boolean) ?? '아직 브리핑이 없습니다.';

  return line.length > 70 ? `${line.slice(0, 70).trimEnd()}...` : line;
};

// A candidate "has a time" only when it is not all-day and the extractor found a
// time phrase. Otherwise approving it opens the mini calendar to pick one.
const hasScheduledTime = (item: ScheduleInboxRow) =>
  !item.all_day && item.time_text !== null;

const formatScheduleDate = (item: ScheduleInboxRow) => {
  const date = new Date(item.scheduled_at);
  if (!hasScheduledTime(item)) {
    return `${format(date, 'M월 d일 (EEE)', { locale: ko })} · 시간 미정`;
  }
  return format(date, 'M월 d일 (EEE) · a h:mm', { locale: ko });
};

const BriefingWorkspace = ({
  briefings,
  inboxItems,
  onAcceptInbox,
  onDismissInbox,
}: BriefingWorkspaceProps) => {
  const [isBriefingInboxOpen, setBriefingInboxOpen] = useState(false);
  const [editingInbox, setEditingInbox] = useState<ScheduleInboxRow | null>(null);
  const [editingTime, setEditingTime] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [selectedBriefing, setSelectedBriefing] = useState<BriefingRow | null>(
    null,
  );
  const [approvingItem, setApprovingItem] = useState<ScheduleInboxRow | null>(
    null,
  );
  const latestBriefing = briefings[0] ?? null;

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

    onAcceptInbox({
      ...editingInbox,
      scheduled_at: new Date(editingTime).toISOString(),
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
      <button
        className="latest-briefing-card"
        disabled={!latestBriefing}
        onClick={() => latestBriefing && setSelectedBriefing(latestBriefing)}
        type="button"
      >
        <span>최근 브리핑</span>
        <strong>
          {latestBriefing
            ? formatBriefingDate(latestBriefing.briefing_date, latestBriefing.created_at)
            : '아직 생성된 브리핑이 없습니다'}
        </strong>
        <p>
          {latestBriefing
            ? latestBriefing.content
            : '저녁 batch가 실행되면 내일 일정, 최근 메모, 한 달 전쯤의 생각을 엮은 브리핑이 표시됩니다.'}
        </p>
      </button>

      {briefings.length > 0 && (
        <button
          className="briefing-history-link"
          onClick={() => setBriefingInboxOpen(true)}
          type="button"
        >
          과거 브리핑 {briefings.length}개 보기
        </button>
      )}

      <div className="schedule-approve-header">
        <strong>저장할 일정</strong>
        <span className="count">{inboxItems.length}</span>
        <span className="hint">메모에서 찾은 일정 후보예요</span>
      </div>

      <div className="schedule-approve-list">
        {inboxItems.length === 0 && (
          <p className="empty-text">아직 쌓인 일정 후보가 없습니다.</p>
        )}
        {inboxItems.map(item => (
          <article className="schedule-approve-card" key={item.id}>
            <strong className="schedule-approve-title">{item.title}</strong>
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

      {isBriefingInboxOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="sheet-panel">
            <div className="sheet-handle" />
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Briefing Inbox</p>
                <h2>과거 브리핑</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => setBriefingInboxOpen(false)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="sheet-list">
              {briefings.length === 0 && (
                <p className="empty-text">아직 저장된 데일리 브리핑이 없습니다.</p>
              )}
              {briefings.map(item => (
                <button
                  className="briefing-row"
                  key={item.id}
                  onClick={() => setSelectedBriefing(item)}
                  type="button"
                >
                  <strong>{formatBriefingDate(item.briefing_date, item.created_at)}</strong>
                  <span>{getPreview(item.content)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {editingInbox && (
        <div className="modal-backdrop detail-backdrop" role="presentation">
          <section className="detail-panel compact-sheet">
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Schedule Candidate</p>
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
            <label>
              시간
              <input
                onChange={event => setEditingTime(event.target.value)}
                type="datetime-local"
                value={editingTime}
              />
            </label>
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

      {selectedBriefing && (
        <div className="modal-backdrop detail-backdrop" role="presentation">
          <section className="detail-panel">
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Daily Briefing</p>
                <h2>{formatBriefingDate(selectedBriefing.briefing_date, selectedBriefing.created_at)}</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => setSelectedBriefing(null)}
                type="button"
              >
                닫기
              </button>
            </div>
            <p className="briefing-detail-content">{selectedBriefing.content}</p>
          </section>
        </div>
      )}
    </div>
  );
};

export default BriefingWorkspace;
