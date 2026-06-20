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

const statusLabels: Record<InboxSession['summaryStatus'], string> = {
  failed: '요약 실패',
  partial: '일부 저장',
  pending: '요약 준비 중',
  ready: '핵심 요약 완료',
  unsupported: '요약 불가',
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
      <section className="inbox-capture-panel">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2>보고 있던 링크를 수집함에 저장합니다.</h2>
          <p>
            YouTube, Instagram, 공개 웹페이지를 자동으로 구분하고 핵심 요약을
            준비합니다.
          </p>
        </div>
        <form className="inbox-url-form" onSubmit={submit}>
          <input
            onChange={event => setDraft(event.target.value)}
            placeholder="https://..."
            type="url"
            value={draft}
          />
          <button disabled={isSaving || !draft.trim()} type="submit">
            {isSaving ? '저장 중' : '저장'}
          </button>
        </form>
      </section>

      <div className="inbox-list-header">
        <strong>최근 수집함</strong>
        <button className="ghost-button" disabled={isLoading} onClick={onRefresh} type="button">
          <RefreshCw size={15} />
          {isLoading ? '불러오는 중' : '새로고침'}
        </button>
      </div>

      <section className="inbox-grid">
        {inboxItems.map(item => {
          const href = item.canonicalUrl ?? item.originalUrl ?? '';
          const duration = formatDuration(item.duration);
          const oneLiner = item.summaryOneLiner ?? item.summary;
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
              {item.thumbnailUrl && (
                <div className="inbox-thumbnail">
                  <img alt="" src={item.thumbnailUrl} />
                  {duration && <span>{duration}</span>}
                </div>
              )}
              <div className="inbox-card-top">
                <span>{sourceLabels[item.sourceType]}</span>
                <em>{statusLabels[item.summaryStatus]}</em>
              </div>
              <h3>{item.title ?? item.originalUrl ?? '제목을 가져오는 중'}</h3>
              {(item.channelTitle || item.domain) && (
                <p className="inbox-domain">{item.channelTitle ?? item.domain}</p>
              )}
              {oneLiner ? (
                <p className="inbox-one-liner">{oneLiner}</p>
              ) : (
                <p className="inbox-pending">핵심 요약을 준비하고 있습니다.</p>
              )}
              {href && (
                <a
                  href={href}
                  onClick={event => event.stopPropagation()}
                  rel="noreferrer"
                  target="_blank"
                >
                  원문 열기
                  <ExternalLink size={14} />
                </a>
              )}
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
