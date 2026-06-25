import { FormEvent, useState } from 'react';
import { ExternalLink, RefreshCw } from '@/components/icons';

import { InboxSession } from '../../services/backend/inboxService';

interface InboxWorkspaceProps {
  inboxItems: InboxSession[];
  isLoading: boolean;
  onRefresh: () => void;
  onSaveUrl: (url: string) => Promise<void>;
}

const sourceLabels: Record<InboxSession['sourceType'], string> = {
  image: '이미지',
  instagram: 'Instagram',
  url: 'URL',
  youtube: 'YouTube',
};

const formatDuration = (duration: string | null) => {
  if (!duration) {
    return null;
  }

  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// Small brand-coloured favicon chip derived from the source type (no network fetch).
const SourceFavicon = ({ type }: { type: InboxSession['sourceType'] }) => {
  if (type === 'youtube') {
    return (
      <span className="inbox-favicon youtube">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    );
  }
  if (type === 'instagram') {
    return <span className="inbox-favicon instagram" aria-hidden="true" />;
  }
  if (type === 'image') {
    return (
      <span className="inbox-favicon image">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.5-3.5L7 21" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inbox-favicon url">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8a857c" strokeWidth="2.5" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      </svg>
    </span>
  );
};

const InboxWorkspace = ({
  inboxItems,
  isLoading,
  onRefresh,
  onSaveUrl,
}: InboxWorkspaceProps) => {
  const [draft, setDraft] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InboxSession | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const url = draft.trim();
    if (!url) {
      return;
    }

    setSaving(true);
    try {
      await onSaveUrl(url);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inbox-workspace">
      <form className="inbox-url-form" onSubmit={submit}>
        <input
          onChange={event => setDraft(event.target.value)}
          placeholder="링크 붙여넣기 — YouTube · Instagram · 웹페이지"
          type="url"
          value={draft}
        />
        <button disabled={isSaving || !draft.trim()} type="submit">
          {isSaving ? '저장 중' : '저장'}
        </button>
      </form>

      <div className="inbox-list-header">
        <strong>최근 수집함</strong>
        <button className="ghost-button" disabled={isLoading} onClick={onRefresh} type="button">
          <RefreshCw size={15} />
          {isLoading ? '불러오는 중' : '새로고침'}
        </button>
      </div>

      <section className="inbox-grid">
        {inboxItems.map(item => {
          const duration = formatDuration(item.duration);
          const oneLiner = item.summaryOneLiner ?? item.summary;
          const excerpt = item.thumbnailUrl ? null : item.summary ?? item.summaryOneLiner;
          return (
            <article
              className="inbox-card"
              key={item.id}
              onClick={() => setSelectedItem(item)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  setSelectedItem(item);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className={item.thumbnailUrl ? 'inbox-thumbnail' : 'inbox-thumbnail empty'}>
                {item.thumbnailUrl ? (
                  <img alt="" src={item.thumbnailUrl} />
                ) : excerpt ? (
                  <div className="inbox-thumbnail-text">{excerpt}</div>
                ) : null}
                {duration && <span className="inbox-duration">{duration}</span>}
              </div>
              <div className="inbox-card-body">
                <div className="inbox-card-title-row">
                  <SourceFavicon type={item.sourceType} />
                  <strong>{item.title ?? item.originalUrl ?? '제목을 가져오는 중'}</strong>
                </div>
                {(item.channelTitle || item.domain) && (
                  <p className="inbox-domain">{item.channelTitle ?? item.domain}</p>
                )}
                {oneLiner && oneLiner !== excerpt && (
                  <p className="inbox-one-liner">{oneLiner}</p>
                )}
              </div>
            </article>
          );
        })}

        {!isLoading && inboxItems.length === 0 && (
          <div className="empty-panel">
            <strong>아직 수집한 링크가 없습니다.</strong>
            <p>Chrome 확장 프로그램 또는 직접 붙여넣기로 링크를 저장하세요.</p>
          </div>
        )}
      </section>

      {selectedItem && (
        <div
          className="inbox-detail-backdrop"
          onClick={() => setSelectedItem(null)}
          role="presentation"
        >
          <section
            className="inbox-detail-panel"
            onClick={event => event.stopPropagation()}
          >
            <header>
              <div>
                <span>{sourceLabels[selectedItem.sourceType]}</span>
                <h3>{selectedItem.title ?? selectedItem.originalUrl ?? '수집한 링크'}</h3>
                {(selectedItem.channelTitle || selectedItem.domain) && (
                  <p>{selectedItem.channelTitle ?? selectedItem.domain}</p>
                )}
              </div>
              <button onClick={() => setSelectedItem(null)} type="button">
                닫기
              </button>
            </header>
            {selectedItem.summaryDetail ? (
              <pre>{selectedItem.summaryDetail}</pre>
            ) : (
              <p className="inbox-pending">상세 요약을 준비하고 있습니다.</p>
            )}
            {(selectedItem.canonicalUrl || selectedItem.originalUrl) && (
              <a
                href={selectedItem.canonicalUrl ?? selectedItem.originalUrl ?? ''}
                rel="noreferrer"
                target="_blank"
              >
                원문 열기
                <ExternalLink size={14} />
              </a>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default InboxWorkspace;
