import type { UiLanguage } from '../../../lib/appSettings';
import { localize } from '../../../lib/uiLanguage';
import { Sparkles } from '../../../components/icons';
import type { MemoRow, MemoFolderMode } from '../../../types';
import type { FolderRecommendation } from '../folderOrganization';
import { getMemoTitle } from '../memoWorkspaceUtils';

export interface MemoFolderRecommendationDraft {
  description: string;
  memoIds: string[];
  mode: MemoFolderMode;
  name: string;
  topicId: string;
}

interface MemoFolderRecommendationsProps {
  folderRecommendations: FolderRecommendation[];
  language: UiLanguage;
  memos: MemoRow[];
  onBeginReview: (recommendation: FolderRecommendation) => void;
  onCancel: () => void;
  onDraftChange: (patch: Partial<MemoFolderRecommendationDraft>) => void;
  onSubmit: () => void | Promise<void>;
  recommendationDraft: MemoFolderRecommendationDraft | null;
}

const MemoFolderRecommendations = ({
  folderRecommendations,
  language,
  memos,
  onBeginReview,
  onCancel,
  onDraftChange,
  onSubmit,
  recommendationDraft,
}: MemoFolderRecommendationsProps) => {
  const t = (korean: string, english: string) => localize(language, korean, english);

  if (folderRecommendations.length === 0) {
    return null;
  }

  return (
    <section className="memo-folder-recommendations">
      <strong>{t('폴더 제안', 'Folder suggestions')}</strong>
      {folderRecommendations.map(recommendation => {
        const previewTitles = recommendation.memoIds
          .map(memoId => memos.find(memo => memo.id === memoId))
          .filter((memo): memo is MemoRow => Boolean(memo))
          .slice(0, 2)
          .map(memo => getMemoTitle(memo, language));

        return (
          <div className="memo-folder-recommendation" key={recommendation.topicId}>
            <div>
              <span>{recommendation.name}</span>
              <em>
                {t(
                  `${recommendation.memoIds.length}개 메모`,
                  `${recommendation.memoIds.length} notes`,
                )}
              </em>
              {previewTitles.length > 0 && (
                <small>{previewTitles.join(' · ')}</small>
              )}
            </div>
            <button
              onClick={() => onBeginReview(recommendation)}
              type="button"
            >
              {t('검토', 'Review')}
            </button>
            {recommendationDraft?.topicId === recommendation.topicId && (
              <form
                className="memo-folder-recommendation-review"
                onSubmit={event => {
                  event.preventDefault();
                  void onSubmit();
                }}
              >
                <input
                  aria-label={t('폴더 이름', 'Folder name')}
                  autoFocus
                  maxLength={80}
                  onChange={event => onDraftChange({ name: event.target.value })}
                  value={recommendationDraft.name}
                />
                <input
                  aria-label={t('폴더 설명', 'Folder description')}
                  maxLength={500}
                  onChange={event => onDraftChange({ description: event.target.value })}
                  placeholder={t('한 줄 설명 (선택)', 'One-line description (optional)')}
                  value={recommendationDraft.description}
                />
                <div className="memo-folder-mode-picker">
                  <button
                    aria-pressed={recommendationDraft.mode === 'manual'}
                    onClick={() => onDraftChange({ mode: 'manual' })}
                    type="button"
                  >
                    {t('수동', 'Manual')}
                  </button>
                  <button
                    aria-pressed={recommendationDraft.mode === 'automatic'}
                    onClick={() => onDraftChange({ mode: 'automatic' })}
                    type="button"
                  >
                    <Sparkles size={12} />
                    {t('자동', 'Automatic')}
                  </button>
                </div>
                <p className="memo-folder-mode-help">
                  {recommendationDraft.mode === 'manual'
                    ? t(
                        '직접 넣은 메모만 유지합니다.',
                        'Keeps only notes you add yourself.',
                      )
                    : t(
                        '미분류 메모 중 어울리는 메모를 자동으로 추가합니다.',
                        'Automatically adds matching unfiled notes.',
                      )}
                </p>
                <div className="memo-folder-recommendation-actions">
                  <button onClick={onCancel} type="button">
                    {t('나중에', 'Later')}
                  </button>
                  <button
                    disabled={!recommendationDraft.name.trim()}
                    type="submit"
                  >
                    {t('폴더 만들기', 'Create folder')}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default MemoFolderRecommendations;
