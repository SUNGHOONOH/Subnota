import { useState } from 'react';
import { format } from 'date-fns';

import { formatBriefingDate } from '../../lib/date';
import { BriefingRow, ScheduleInboxRow } from '../../types';

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

const BriefingWorkspace = ({
  briefings,
  inboxItems,
  onAcceptInbox,
  onDismissInbox,
}: BriefingWorkspaceProps) => {
  const [isBriefingInboxOpen, setBriefingInboxOpen] = useState(false);
  const [isScheduleInboxOpen, setScheduleInboxOpen] = useState(false);
  const [editingInbox, setEditingInbox] = useState<ScheduleInboxRow | null>(null);
  const [editingTime, setEditingTime] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [selectedBriefing, setSelectedBriefing] = useState<BriefingRow | null>(
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

      <div className="briefing-cards">
        <button
          className="inbox-card filled"
          onClick={() => setBriefingInboxOpen(true)}
          type="button"
        >
          <div>
            <strong>과거 브리핑 인박스</strong>
            <span>
              {latestBriefing
                ? getPreview(latestBriefing.content)
                : '매일 저녁 생성된 브리핑이 쌓입니다'}
            </span>
          </div>
          <em>{briefings.length}</em>
        </button>

        <button
          className="inbox-card"
          onClick={() => setScheduleInboxOpen(true)}
          type="button"
        >
          <div>
            <strong>흩어진 일정 모아보기</strong>
            <span>저녁 batch가 찾은 후보를 정리합니다</span>
          </div>
          <em>{inboxItems.length}</em>
        </button>
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

      {isScheduleInboxOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="sheet-panel">
            <div className="sheet-handle" />
            <div className="sheet-title-row">
              <div>
                <p className="eyebrow">Schedule Inbox</p>
                <h2>흩어진 일정</h2>
              </div>
              <button
                className="secondary-button"
                onClick={() => setScheduleInboxOpen(false)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="schedule-card-row">
              {inboxItems.length === 0 && (
                <p className="empty-text">아직 쌓인 일정 후보가 없습니다.</p>
              )}
              {inboxItems.map(item => (
                <article className="schedule-card" key={item.id}>
                  <span>{format(new Date(item.scheduled_at), 'M월 d일 HH:mm')}</span>
                  <strong>{item.title}</strong>
                  <p>{item.source_text}</p>
                  <div>
                    <button
                      className="primary-button"
                      onClick={() => onAcceptInbox(item)}
                      type="button"
                    >
                      캘린더에 등록
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => openInboxEditor(item)}
                      type="button"
                    >
                      수정
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => onDismissInbox(item)}
                      type="button"
                    >
                      무시
                    </button>
                  </div>
                </article>
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
