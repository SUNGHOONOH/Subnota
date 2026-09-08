import type { UiLanguage } from '../../../lib/appSettings';
import { localize } from '../../../lib/uiLanguage';

type RelatedSentenceHighlight = {
  chunkText?: string;
  endIndex: number;
  startIndex: number;
};

interface RelatedSentenceCardProps {
  highlight?: RelatedSentenceHighlight | null;
  language: UiLanguage;
  onClose: () => void;
  value: string;
}

const RelatedSentenceCard = ({
  highlight,
  language,
  onClose,
  value,
}: RelatedSentenceCardProps) => {
  if (!highlight) {
    return null;
  }

  const startIndex = Math.max(0, highlight.startIndex);
  const endIndex = Math.max(startIndex, highlight.endIndex);
  const snippet =
    highlight.chunkText ||
    value.slice(startIndex, Math.min(value.length, endIndex));

  return (
    <div className="highlight-card">
      <div className="highlight-header">
        <span className="highlight-label">
          {localize(language, '관련 문장', 'Related sentence')}
        </span>
        <button
          onClick={onClose}
          className="highlight-close-btn"
        >
          ✕
        </button>
      </div>
      <p className="highlight-text">{snippet}</p>
    </div>
  );
};

export default RelatedSentenceCard;
